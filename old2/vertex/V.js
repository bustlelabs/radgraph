import _ from 'lodash'
import Promise from 'bluebird'

import { deserialize
       , deserializeHash
       , serialize
       } from '../utils'

const V =

  { get: (e$, id) =>
      e$.Vertex("V", id)

  , create: (e$, attrs) =>
      e$.do('vadd', serialize(attrs), +Date.now())
        .then(deserializeHash)
        .then(v => instance(e$, v.id, v))

  , instance

  }

export default V

function instance(e$, id, attrs) {

  let   _exists = null
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
    , to:  type  => e$.Vertex   (type, id, _attrs)
    , in:  label => e$.Adjacency(label, 'in',  id)
    , out: label => e$.Adjacency(label, 'out', id)

    , dump: () =>
        e$.do('hgetall', id)
          .then(o => _.mapValues(o, deserialize))

    , attr: (...a) => a[1]
        ? Promise.all(_.map(a, getAttr))
        : getAttr(a[0])

    , type: getAttr('_type')

    , exists: () =>
        e$.do('exists', id)

    , verify: () =>
         v.exists()
          .then(t => t && v)

    , set: attrs =>
        e$.do('vset', id, serialize(attrs), +Date.now())
          .then(deserializeHash)
          .then(setAttrs)

    , delete: () =>
        e$.do('vdel', id)
          .then(deserializeHash)
          .then(setAttrs)
    }

  return v

}

// MACROS

import { APPEND_VAL
       , GEN_ID
       } from '../macros'

// SCRIPTS

// TODO: manage indices
const VADD = `
local time = table.remove(ARGV) + 0
${GEN_ID}

${APPEND_VAL("id", "id")}
${APPEND_VAL("created_at", "time")}
${APPEND_VAL("updated_at", "time")}

redis.call("HMSET", id, unpack(ARGV))

return ARGV
`

const VSET = `
local time = table.remove(ARGV) + 0
local type = redis.call("HGET", KEYS[1], "_type")

if type then
  return { err = 'Node "'..KEYS[1]..'" has type "'..type..'", it is unsafe to mutate via the generic "V"' }
end

${APPEND_VAL("id", "KEYS[1]")}
${APPEND_VAL("updated_at", "time")}
redis.call("HMSET", KEYS[1], unpack(ARGV))

return ARGV
`

const VDEL = `
local cur = redis.call("HGETALL", KEYS[1], unpack(ARGV))
redis.call("DEL", KEYS[1])
return cur
`

export const scripts =
  { vadd : { numberOfKeys: 0, lua: VADD }
  , vset : { numberOfKeys: 1, lua: VSET }
  , vdel : { numberOfKeys: 1, lua: VDEL }
  }
