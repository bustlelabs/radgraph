// TODO: write documentation on the underlying data structure
// QUICK NOTES:
// A OneToMany association is pretty much the same as a simple edge
// A OneToMany edge is uniquely identified by a type (type, to)

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
if not from then
  return { err = 'Edge "-['..type..')->'..to..'" does not exist' }
end`

const FROM_ADJ = 'from.."-["..type..")->"'
const EDGE_KEY =       '"-["..type..")->"..to'

const FROM_SET = `
redis.call("ZADD", ${FROM_ADJ}, time, to)`
const FROM_REM = `
redis.call("ZREM", ${FROM_ADJ},       to)`

const   TO_SET = `
redis.call("HMSET", ${EDGE_KEY}, unpack(ARGV))`
const   TO_REM = `
redis.call("DEL", ${EDGE_KEY})`

const REM_IDXS =  `${REM_IDX("created_at", EDGE_KEY)} ${REM_IDX("updated_at", EDGE_KEY)}`

// scripts
const otmfrom = `
local start = table.remove(ARGV)
local stop  = table.remove(ARGV) + start - 1
local type  = table.remove(ARGV)

local ids   = redis.call("ZREVRANGE", KEYS[1], start, stop)
local results = {}
for _,to in ipairs(ids) do
  table.insert(results, redis.call("HMGET", ${EDGE_KEY}, unpack(ARGV)))
end

return results
`

const otmadd = `
local time = table.remove(ARGV)
local to   = table.remove(ARGV)
local type = table.remove(ARGV)

local from = redis.call("HGET", ${EDGE_KEY}, 'from')
if from then
  ${FROM_REM}
  ${TO_REM}
  ${REM_IDXS}
end

from = table.remove(ARGV)
${VALS("from", "type", "to", "time", "time")}

${TO_SET}
${FROM_SET}
${SET_IDX("updated_at", EDGE_KEY)}
${SET_IDX("created_at", EDGE_KEY)}

return vals
`

const otmset = `
local time = table.remove(ARGV)
local to   = table.remove(ARGV)
local type = table.remove(ARGV)

local cur     = redis.call("HMGET", ${EDGE_KEY}, 'from', 'created_at')
local from    = cur[1]
local created = cur[2]

${VALIDATE}
${VALS("from", "type", "to", "created", "time")}
${FROM_SET}
${TO_SET}
${SET_IDX("updated_at", EDGE_KEY)}

return vals`

const otmdel = `
local to   = table.remove(ARGV)
local type = table.remove(ARGV)
local cur  = redis.call("HMGET", ${EDGE_KEY}, unpack(ARGV))
local from = cur[table.getn(cur)-4]

${VALIDATE}
${REM_IDXS}
${FROM_REM}
${TO_REM}

return cur
`

const otmdelfrom = `
local type = table.remove(ARGV)
local from = table.remove(ARGV)
local ids  = redis.call("ZREVRANGE", ${FROM_ADJ}, 0, -1)

redis.call("DEL", ${FROM_ADJ})
for _,to in ipairs(ids) do
  ${REM_IDXS}
  ${TO_REM}
end

return ids
`

export const scripts =
  { otmfrom:    { numberOfKeys: 1, lua: otmfrom }
  , otmadd:     { numberOfKeys: 0, lua: otmadd }
  , otmset:     { numberOfKeys: 0, lua: otmset }
  , otmdel:     { numberOfKeys: 0, lua: otmdel }
  , otmdelfrom: { numberOfKeys: 0, lua: otmdelfrom }
  }
export default function(G, fType, eType, tType, fields) {

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
        , serialize
        , normalize
        } = parser

  const jobs =

    { all: indexJob(type, parser)

    , from: (from, { offset = 0, limit = 30, properties } = {}) =>
        properties
        ? normalize(properties).do(properties =>
            [ 'otmfrom'
            , [ `${from}-[${type})->`, properties, type, limit, offset ]
            , fnMap(deserializer(properties))
            ]
          )
        : [ 'zrevrange'
          , [ `${from}-[${type})->`, offset, offset + limit - 1 ]
          , identity
          ]

    , of: (to, properties) =>
        properties
        ? normalize(properties).do(properties =>
            [ 'hmget'
            , [ `-[${type})->${to}`, properties ]
            , deserializer(properties)
            ]
          )
        : [ 'hget'
          , [ `-[${type})->${to}`, 'from' ]
          , identity
          ]

    , create: (from, to, attrs) =>
        serialize(attrs).do((attrs, keys) =>
          [ 'otmadd'
          , [ attrs, from, type, to, +Date.now() ]
          , deserializer(keys)
          ]
        )
    , update: (to, attrs) =>
        serialize(attrs).do((attrs, keys) =>
          [ 'otmset'
          , [ attrs, type, to, +Date.now() ]
          , deserializer(keys)
          ]
        )

    , delete: to =>
        [ 'otmdel'
        , [ defaultProps, type, to ]
        , deserializer(defaultProps)
        ]

    , deleteFrom: from =>
        [ 'otmdelfrom'
        , [ from, type ]
        , identity
        ]

    }

  return wrapExec(G, jobs)

}
