import _       from 'lodash'
import Promise from 'bluebird'

import { assert
       , deserialize
       } from '../utils'

// A Key vertex is a schemaless vertex with a unique secondary key used for quick lookups, i.e. a URLs
// This Id -> Key mapping should be a bijection

// Id -> Key
// Key -> Id
// Id -> JSON

// To the client, this should be indistinguishable from Key -> JSON

class KeyVertex {

  static type = null

  // there's no good way to enumerate over inherited classes
  static services = [ 'get', 'set' ]

  static new(e$, id) {
    return e$.do('get', id)
             .then(type => assert(type === this.type, `Vertex "${id}" is not of type "${this.type}"`))
             // eagerly fetch values
             .then(() => e$.do('hmget', `${id}:attrs`, 'key', 'data'))
             .spread((key, data) => new this(e$, id, key, deserialize(data)))
  }

  static get(e$, key) {
    // TODO: use an actual hash method to create index buckets
    return e$.do('hget', `${this.type}:index`, key)
             .then(id => assert(id, `Key "${id}" is not set for type "${this.type}"`))
             .then(id => new this(e$, id, key))
  }

  static set(e$, key, val) {
    return e$.do( 'kvset'
                , `${this.type}:index`
                , this.type
                , key
                , JSON.stringify(val)
                , +Date.now()
                )
             .then(id => new this(e$, id, key, val))
  }

  constructor(e$, id, key, val) {
    this.e$   = e$
    this.id   = id
    this.key  = key
    this.type = this.constructor.type
    this._val = val && Promise.resolve(val)
  }

  value() {
    return this._val
      || ( this._val = this.e$.do('hget', `${this.id}:attrs`, 'data').then(JSON.parse) )
  }

  // note there is no .set() method
  // these values should be thought of as immutable

  delete() {
    return this.e$.do('kvdel', `${this.type}:index`, this.id, this.key)
      .then(deserialize)
      .then(v => this._val = Promise.resolve(v))
      .return(this)
  }

}

// g.describe
//  .Key("Embed")

// g.Key.get(url)
//  .then(v => v.value())

// g.Key.set(url, data)
//  .then(v => v.data())
//  .then(d => assert(d === data))

export default function(type) {
  return class extends KeyVertex {
    static type = type
  }
}

// MACROS

import { APPEND_VAL
       , GEN_ID
       } from '../macros'

// SCRIPTS

// KVSET
// sets a value for a KeyVertex, creating an instance if it does not exist
// returns id of KeyVertex
const KVSET = `
local type = ARGV[1]
local key  = ARGV[2]
local data = ARGV[3]
local time = ARGV[4]

local curid = redis.call("HGET", KEYS[1], key)
if curid then
  redis.call("HSET", curid..":attrs", "data", data)
  return curid
else
  ${GEN_ID}
  redis.call("SET", id, type)
  redis.call("HSET", KEYS[1], key, id)
  redis.call("HMSET", id..":attrs", "key", key, "data", data)
  return id
end
`

// KVDEL
// deletes a KeyVertex based on the provided index, id, and key
// returns stored data value

const KVDEL = `
local idx = KEYS[1]
local id  = KEYS[2]
local key = ARGV[1]
redis.call("HDEL", idx, key)
local data = redis.call("HGET", id..":attrs", 'data')
redis.call("DEL", id..":attrs")
redis.call("DEL", id)

return data
`

export const scripts =
  { kvset: { numberOfKeys: 1, lua: KVSET }
  , kvdel: { numberOfKeys: 2, lua: KVDEL }
  }
