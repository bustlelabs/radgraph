// TODO: write documentation on the underlying data structure
// QUICK NOTES:
// Simple associations, though directed, are symmetric in time complexity
// Associations are ordered by reverse chron of time of last update
// A simple association is a tuple (from, type, to) denoted from-[type]->to
// There exists a hash for each association, (from, type, to) -> (k -> v)
// all hashes contain the fields:
//   - from
//   - type
//   - to
//   - created_at
//   - updated_at
// there exist 2 indices of edges, stored as ZSETs, meant to be utility functions for internal DB operations:
//   - TYPE:indices:created_at
//   - TYPE:indices:updated_at
// inverse associations can be queried (Edge.to(id))

import _ from 'lodash'

import { identity
       , fnMap
       , indexJob
       , wrapExec
       , parsers
       } from '../utils'

// macros

import { BUILD_VALS
       , APPEND_VAL
       , SET_IDX
       , REM_IDX
       } from '../macros'

const VALS = (from, type, to, created_at, updated_at) => `
${BUILD_VALS}
${APPEND_VAL("from"       , from)}
${APPEND_VAL("type"       , type)}
${APPEND_VAL("to"         , to)}
${APPEND_VAL("created_at" , created_at)}
${APPEND_VAL("updated_at" , updated_at)}
`

const VALIDATE = `
if not created then
  return { err = 'Edge "'..from..'-['..type..']->'..to..'" does not exist' }
end
`
const EDGE_KEY = 'from.."-["..type.."]->"..to'
const FROM_ADJ = 'from.."-["..type.."]->"'
const   TO_ADJ =       '"-["..type.."]->"..to'

const FROM_SET = `
redis.call("ZADD", ${FROM_ADJ}, time, to  )`
const FROM_REM = `
redis.call("ZREM", ${FROM_ADJ},       to  )`

const   TO_SET = `
redis.call("ZADD",   ${TO_ADJ}, time, from)`
const   TO_REM = `
redis.call("ZREM",   ${TO_ADJ},       from)`

const REM_IDXS = `
${REM_IDX("created_at", EDGE_KEY)}
${REM_IDX("updated_at", EDGE_KEY)}`

// scripts

// SIMPLE_EDGE:ADD
// ARGS:
//   ... properties
//   -4: from
//   -3: type
//   -2: to
//   -1: time

const seadd = `
local time = table.remove(ARGV)
local to   = table.remove(ARGV)
local type = table.remove(ARGV)
local from = table.remove(ARGV)

${VALS("from", "type", "to", "time", "time")}

redis.call("DEL",   ${EDGE_KEY}, unpack(ARGV))
redis.call("HMSET", ${EDGE_KEY}, unpack(ARGV))
${FROM_SET}
${TO_SET}
${SET_IDX("created_at", EDGE_KEY)}
${SET_IDX("updated_at", EDGE_KEY)}

return vals`

const seset = `
local time = table.remove(ARGV)
local to   = table.remove(ARGV)
local type = table.remove(ARGV)
local from = table.remove(ARGV)

local created = redis.call("HGET", ${EDGE_KEY}, "created_at")

${VALIDATE}
${VALS("from", "type", "to", "created", "time")}
redis.call("HMSET", ${EDGE_KEY}, unpack(ARGV))
${FROM_SET}
${TO_SET}
${SET_IDX("updated_at", EDGE_KEY)}

return vals
`

const sedel = `
local to   = table.remove(ARGV)
local type = table.remove(ARGV)
local from = table.remove(ARGV)

local cur  = redis.call("HMGET", ${EDGE_KEY}, unpack(ARGV))
local created = cur[table.getn(cur)-1]

${VALIDATE}
${REM_IDXS}
${FROM_REM}
${TO_REM}
redis.call("DEL", ${EDGE_KEY})

return cur`

const sedelfrom = `
local type = table.remove(ARGV)
local from = table.remove(ARGV)
local ids = redis.call("ZREVRANGE", ${FROM_ADJ}, 0, -1)

redis.call("DEL", ${FROM_ADJ})
for _,to in ipairs(ids) do
  ${REM_IDXS}
  ${TO_REM}
  redis.call("DEL", ${EDGE_KEY})
end

return ids
`

const sedelto = `
local to   = table.remove(ARGV)
local type = table.remove(ARGV)
local ids = redis.call("ZREVRANGE", ${TO_ADJ}, 0, -1)

redis.call("DEL", ${TO_ADJ})
for _,from in ipairs(ids) do
  ${REM_IDXS}
  ${FROM_REM}
  redis.call("DEL", ${EDGE_KEY})
end

return ids
`

export const scripts =
  { seadd     : { numberOfKeys: 0, lua: seadd     }
  , seset     : { numberOfKeys: 0, lua: seset     }
  , sedel     : { numberOfKeys: 0, lua: sedel     }
  , sedelfrom : { numberOfKeys: 0, lua: sedelfrom }
  , sedelto   : { numberOfKeys: 0, lua: sedelto   }
  }

// constructor

export default function (G, fType, eType, tType, fields) {

  const type = `${fType}:${eType}:${tType}`

  const props = _.assign
    ( { from:       'string'
      , to:         'string'
      , type:       'string'
      , created_at: 'integer'
      , updated_at: 'integer'
      }
    , fields
    )

  const parser = parsers(props, ['from', 'type', 'to', 'created_at', 'updated_at'])
  const { defaultProps
        , deserializer
        , mapDeserializer
        , serialize
        , normalize
        } = parser

  const jobs =

    { all: indexJob(type, parser)

    , from: (from, { offset = 0, limit = 30, properties } = {}) =>
        properties
        ? normalize(properties).do(properties =>
            [ 'efrom'
            , [ `${from}-[${type}]->`, properties, limit, offset ]
            , fnMap(deserializer(properties))
            ]
          )
        : [ 'zrevrange'
          , [ `${from}-[${type}]->`, offset, offset + limit - 1 ]
          , identity
          ]

    , to: (to, { offset = 0, limit = 30, properties } = {}) =>
        properties
        ? normalize(properties).do(properties =>
            [ 'eto'
            , [ `-[${type}]->${to}`, properties, limit, offset ]
            , fnMap(deserializer(properties))
            ]
          )
        : [ 'zrevrange'
          , [ `-[${type}]->${to}`, offset, offset + limit - 1 ]
          , identity
          ]

    , get: (from, to, properties = defaultProps) =>
        normalize(properties).do(properties =>
          [ 'hmget'
          , [ `${from}-[${type}]->${to}`, properties ]
          , deserializer(properties)
          ]
        )

    , create: (from, to, attrs) =>
        serialize(attrs).do((attrs, keys) =>
          [ 'seadd'
          , [ attrs, from, type, to, +Date.now() ]
          , deserializer(keys)
          ]
        )

    , update: (from, to, attrs) =>
        serialize(attrs).do((attrs, keys) =>
          [ 'seset'
          , [ attrs, from, type, to, +Date.now() ]
          , deserializer(keys)
          ]
        )

    , delete: (from, to) =>
        [ 'sedel'
        , [ defaultProps, from, type, to ]
        , deserializer(defaultProps)
        ]

    , deleteFrom: from =>
        [ 'sedelfrom'
        , [ from, type ]
        , identity
        ]

    , deleteTo: to =>
        [ 'sedelto'
        , [ type, to ]
        , identity
        ]

    }

  return wrapExec(G, jobs)

}
