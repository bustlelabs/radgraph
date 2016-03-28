import _ from 'lodash'
import Promise from 'bluebird'

import { deserialize
       , deserializeHash
       , serialize
       } from '../utils'

export default function(type, fields) {

  const props = _.keys(fields).concat('id', 'created_at', 'updated_at')
  const deserializeAll = a => _(props)
    .zipObject(a)
    .omitBy(_.isNull)
    .mapValues(deserialize)
    .value()


  const Type =

    { get: (e$, id) =>
        e$.Vertex("V", id)

    , create: (e$, attrs) =>
        e$.do('tvadd', serialize(attrs, fields), type, +Date.now())
          .then(deserializeHash)
          .then(v => instance(e$, v.id, v))

    , instance
    }

  return Type

  function instance(e$, id, attrs) {

    const _attrs = {}

    const getAttr = k => _attrs[k]
      || ( _attrs[k] =
            e$.do('hget', id, k)
              .then(deserialize)
         )

    const setAttr = (v, k) =>
      _attrs[k] = Promise.resolve(v)

    const setAttrs = m =>
      ( _.forEach(m, (v, k) => _attrs[k] = Promise.resolve(v))
      , m
      )

    setAttrs(attrs)

    const v =
      { id
      , type
      , in:   label => e$.Adjacency(label, 'in',  id)
      , out:  label => e$.Adjacency(label, 'out', id)

      , dump: () =>
          e$.do('hmget', id, props)
            .then(deserializeAll)

      , attr: (...a) => a[1]
          ? Promise.all(_.map(a, getAttr))
          : getAttr(a[0])

      , exists: () =>
          e$.do('hget', id, '_type')
            .then(t => (t === type))

      // returns self if exists, useful for chaining
      , verify: () =>
           v.exists()
            .then(t => t && v)

      , set: attrs =>
          e$.do('tvset', id, serialize(attrs, fields), +Date.now())
            .then(deserializeHash)
            .then(setAttrs)

      , delete: () =>
          e$.do('tvdel', id, props)
            .then(deserializeAll)
            .then(setAttrs)
      }

    return v

  }

}

// MACROS

import { APPEND_VAL
       , GEN_ID
       } from '../macros'

// SCRIPTS

// TODO: manage indices

const TVADD = `
local time = table.remove(ARGV) + 0
local type = table.remove(ARGV)
${GEN_ID}

${APPEND_VAL("id",         "id")}
${APPEND_VAL("created_at", "time")}
${APPEND_VAL("updated_at", "time")}
${APPEND_VAL("_type",      "type")}

redis.call("HMSET", id, unpack(ARGV))

return ARGV`

const TVSET = `
local time = table.remove(ARGV) + 0
local type = table.remove(ARGV)

local t = redis.call("HGET", KEYS[1], "_type")
t = t and cjson.decode(t)

if not t then
  return { err = 'Node "'..KEYS[1]'" does not have a type, it should be mutated via the generic "V"' }
else if t ~= type then
  return { err = 'Node "'..KEYS[1]'" is of type "'..t..'", expected type "'..type..'"' }
end

${APPEND_VAL("id",         "KEYS[1]")}
${APPEND_VAL("updated_at", "time")}
redis.call("HMSET", KEYS[1], unpack(ARGV))

return ARGV`

const TVDEL = `
local cur = redis.call("HMGET", id, unpack(ARGV))
redis.call("DEL", KEYS[1])
return cur
`

export const scripts =
  { tvadd : { numberOfKeys: 0, lua: TVADD }
  , tvset : { numberOfKeys: 1, lua: TVSET }
  , tvdel : { numberOfKeys: 1, lua: TVDEL }
  }
