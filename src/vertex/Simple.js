import _       from 'lodash'
import Promise from 'bluebird'

import { throwError
       , assert
       } from '../utils'

// TODO: updated_at, created_at, indices, etc.
// i.e. make this converge to radredis

// A Simple vertex is a vertex with a hash map
// Id -> { k -> v }
// Unlike a KeyVertex, this allows for partial record retrieval
// Later, attribute indices will be introduced to catch up with radredis

class SimpleVertex {

  static type   = null
  static fields = {}

  // there's no good way to enumerate over inherited classes
  static services = [ 'create' ]

  static create(e$, hash) {
    const attrs = clean(hash, this.fields)
    const v =
      e$.do( 'vadd'
           , serialize(attrs, this.fields)
           , this.type
           , +Date.now()
           )
        .then(id => new this(e$, id, attrs))
    return v
  }

  static new(e$, id) {
    return e$.do('get', id)
             .then(type => assert(type === this.type, `Vertex "${id}" is not of type "${this.type}"`))
             .then(()   => new this(e$, id))
  }

  constructor(e$, id) {
    this.e$     = e$
    this.id     = id
    this.type   = this.constructor.type
    this._attrs = {}
  }

  attrs(...a) {
    return Promise.all(_.map(a, a => this.attr(a)))
  }

  attr(a) {
    return this._attrs[a]
      || ( this._attrs[a] =
             this.e$.do('hget', `${this.id}:attrs`, a)
                    .then(deserialize)
         )

  }

  setAttr(a, v) {
    return this._attrs[a] = Promise.resolve(v)
  }

  set(hash) {
    const attrs = clean(hash, this.constructor.fields)
    // clear version info
    this._attrs._v = null
    this._attrs.updated_at = null
    // perform mutation
    return this.e$
      .do ( 'vset'
          , `${this.id}:attrs`
          , serialize(attrs, this.constructor.fields)
          , +Date.now()
          )
      .then(() => _.forEach(attrs, (v, k) => this.setAttr(k, v)))
      .return(this)
  }

  delete() {
    return this.e$.do('vdel', this.id, `${this.id}:attrs`)
      .then(deserializeAll)
      .then(dump => _.forEach(dump, (v, k) => this.setAttr(k, v)))
      .return(this)
  }

}

// g.describe
//  .Vertex("Page", { title: "string", description: "string" })

// g.Page(id)
//  .then(v => v.attrs("title", "description"))

export default function(type, fields) {

  return class extends SimpleVertex {
    static type   = type
    static fields = fields
  }

}

function clean(attrs, fields) {
  return _.omitBy(attrs, (v, k) => !fields[k])
}

function serialize(attrs, fields) {
  const isOk = k => fields[k]
  // this can be optimized
  return _(attrs)
    .mapValues((v, k) => isOk(k) && JSON.stringify(v))
    .omitBy(_.isNull)
    .toPairs()
    .flatten()
    .value()
}

function deserialize(x) {
  return x
    && ( x !== '' )
    && JSON.parse(x)
}

function deserializeAll(attrs) {
  return _(attrs)
    .chunk(2)
    .fromPairs()
    .omitBy(_.isNull)
    .mapValues(deserialize)
    .value()
}

// MACROS

import { APPEND_VAL
       , GEN_ID
       } from '../macros'

// SCRIPTS

// VADD
// create a new vertex from the given attributes
// returns the new id

const VADD = `
local time = table.remove(ARGV) + 0
local type = table.remove(ARGV)
${GEN_ID}
redis.call("SET", id, type)
${APPEND_VAL("created_at", "time")}
${APPEND_VAL("updated_at", "time")}
${APPEND_VAL("_v", "1")}
redis.call("HMSET", id..":attrs", unpack(ARGV))
return id
`

// VSET
// updates a vertex with the provided attributes
// increments _v, and sets updated_at
// returns "OK" or raises an error

const VSET = `
local time = table.remove(ARGV) + 0
local _v   = redis.call("HGET", KEYS[1], '_v')
${APPEND_VAL("updated_at", "time")}
${APPEND_VAL("_v", "_v + 1")}
redis.call("HMSET", KEYS[1], unpack(ARGV))
return "OK"
`

// VDEL
// deletes a vertex by a given id
// returns an HGETALL dump of the vertex

const VDEL = `
local dump = redis.call("HGETALL", KEYS[2])
redis.call("DEL", KEYS[1], KEYS[2])
return dump
`

export const scripts =
  { vadd: { numberOfKeys: 0, lua: VADD }
  , vset: { numberOfKeys: 1, lua: VSET }
  , vdel: { numberOfKeys: 2, lua: VDEL }
  }
