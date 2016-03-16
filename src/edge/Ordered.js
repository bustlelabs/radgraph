// TODO: write documentation on the underlying data structure
// QUICK NOTES:
// An ordered association is optimized for querying off the top of the list
//   ideal for structured associations, i.e. A -[owns]-> B with some ordering
//
// An ordered association is uniquely identified by a tuple (from, type, to):
// An ordered association contains the fields:
//   - from
//   - type
//   - to
//   - position
//   - created_at
//   - updated_at
// there exist 2 indices of edges, stored as ZSETs, meant to be utility functions for internal database operations
// The inverse association DOES NOT contain an ordering

import _ from 'lodash'

import { identity
       , head
       , fnMap
       , fnHead
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

const VALS = (from, type, to, position, created_at, updated_at) => `
${BUILD_VALS}
${APPEND_VAL("from"       , from)}
${APPEND_VAL("type"       , type)}
${APPEND_VAL("to"         , to)}
${APPEND_VAL("position"   , position)}
${APPEND_VAL("created_at" , created_at)}
${APPEND_VAL("updated_at" , updated_at)}
`

const VALIDATE = `
if not created then
  return { err = 'Edge "'..from..'~['..type..']->'..to..'" does not exist' }
end
`

const EDGE_KEY = `from.."~["..type.."]->"..to`
const FROM_ADJ = `from.."~["..type.."]->"`
const   TO_ADJ =       `"~["..type.."]->"..to`

const FROM_SET = `
redis.call("ZADD", ${FROM_ADJ}, position, to   )`
const FROM_REM = `
redis.call("ZREM", ${FROM_ADJ},           to   )`

const   TO_SET = `
redis.call("ZADD",   ${TO_ADJ}, time    , from )`
const   TO_REM = `
redis.call("ZREM",   ${TO_ADJ},           from )`

const EDGE_SET = `
redis.call("HMSET", ${EDGE_KEY}, unpack(ARGV))`
const EDGE_REM = `
redis.call("DEL",   ${EDGE_KEY}, unpack(ARGV))`

const REM_IDXS = `
${REM_IDX("created_at", EDGE_KEY)}
${REM_IDX("updated_at", EDGE_KEY)}`

const SHIFT_UP = `
for _,to in ipairs(ids) do
  local score = redis.call("ZINCRBY", ${FROM_ADJ}, -1, to)
  redis.call("HSET", ${EDGE_KEY}, 'position', score)
end`

const SHIFT_DOWN = `
for _,to in ipairs(ids) do
  local score = redis.call("ZINCRBY", ${FROM_ADJ}, 1, to)
  redis.call("HSET", ${EDGE_KEY}, 'position', score)
end`

// scripts
// TODO: turn this into a macro
const oefrom = `
local start = table.remove(ARGV)
local stop  = table.remove(ARGV) + 0

if stop <= 0 then stop = '+inf' end

local ids   = redis.call("ZRANGEBYSCORE", KEYS[1], start, stop)
local results = {}
for _,to in ipairs(ids) do
  table.insert(results, redis.call("HMGET", KEYS[1]..to, unpack(ARGV)))
end
return results
`

const oeinsert = `
local time = table.remove(ARGV)
local pos  = table.remove(ARGV)
local to   = table.remove(ARGV)
local type = table.remove(ARGV)
local from = table.remove(ARGV)

local position
local curpos = redis.call("ZSCORE", ${FROM_ADJ}, to)
local card   = redis.call("ZCARD", ${FROM_ADJ})

if pos == "PUSH" then
  position = card + (curpos and 0 or 1)
elseif pos + (curpos and 1 or 0) <= card + 1 then
  position = pos
else
  return { err = 'Index out of range' }
end

${VALS("from", "type", "to", "position", "time", "time")}
if curpos then
  if curpos <= position then
    local ids = redis.call("ZRANGEBYSCORE", ${FROM_ADJ}, curpos, position)
    ${SHIFT_UP}
  else
    local ids = redis.call("ZRANGEBYSCORE", ${FROM_ADJ}, position, curpos)
    ${SHIFT_DOWN}
  end
else
  local ids = redis.call("ZRANGEBYSCORE", ${FROM_ADJ}, position, '+inf')
  ${SHIFT_DOWN}
end
${TO_SET}
${FROM_SET}
${EDGE_SET}
${SET_IDX("created_at", EDGE_KEY)}
${SET_IDX("updated_at", EDGE_KEY)}

return vals`

const oemove = `
local pos  = table.remove(ARGV)
local to   = table.remove(ARGV)
local type = table.remove(ARGV)
local from = table.remove(ARGV)

local position = pos + 0
local card     = redis.call("ZCARD", ${FROM_ADJ})

if position > card then
  return { err = 'Index out of range' }
end

local cur     = redis.call("HMGET", ${EDGE_KEY}, unpack(ARGV))
local created = cur[table.getn(cur)-1]
local curpos  = redis.call("ZSCORE", ${FROM_ADJ}, to) + 0

${VALIDATE}
if curpos <= position then
  local ids = redis.call("ZRANGEBYSCORE", ${FROM_ADJ}, curpos, position)
  ${SHIFT_UP}
else
  local ids = redis.call("ZRANGEBYSCORE", ${FROM_ADJ}, position, curpos)
  ${SHIFT_DOWN}
end
${FROM_SET}
redis.call("HSET", ${EDGE_KEY}, 'position', position)

cur[table.getn(cur)-2] = position
return cur`

const oeset = `
local time = table.remove(ARGV)
local to   = table.remove(ARGV)
local type = table.remove(ARGV)
local from = table.remove(ARGV)

local created  = redis.call("HGET", ${EDGE_KEY}, 'created_at')

local position = redis.call("ZSCORE", ${FROM_ADJ}, to)

${VALIDATE}
${VALS("from", "type", "to", "position", "created", "time")}

${EDGE_SET}
${TO_SET}
${SET_IDX("updated_at", EDGE_KEY)}

return vals`

const oedel = `
local to   = table.remove(ARGV)
local type = table.remove(ARGV)
local from = table.remove(ARGV)

local cur  = redis.call("HMGET", ${EDGE_KEY}, unpack(ARGV))
local position = redis.call("ZSCORE", ${FROM_ADJ}, to)
local created = cur[table.getn(cur)-1]

${VALIDATE}
${REM_IDXS}
${FROM_REM}
${TO_REM}
${EDGE_REM}
local ids = redis.call("ZRANGEBYSCORE", ${FROM_ADJ}, position, '+inf')
${SHIFT_UP}

return cur`

const oedelfrom = `
local type = table.remove(ARGV)
local from = table.remove(ARGV)
local keys = redis.call("ZRANGE", ${FROM_ADJ}, 0, -1)
redis.call("DEL", ${FROM_ADJ})
for _,to in ipairs(keys) do
  ${REM_IDXS}
  ${TO_REM}
  ${EDGE_REM}
end
return keys`

const oedelto = `
local to   = table.remove(ARGV)
local type = table.remove(ARGV)
local keys = redis.call("ZREVRANGE", ${TO_ADJ}, 0, -1)
redis.call("DEL", ${TO_ADJ})
for _,from in ipairs(keys) do
  ${REM_IDXS}
  local position = redis.call("ZSCORE", ${FROM_ADJ}, to)
  ${FROM_REM}
  local ids = redis.call("ZRANGEBYSCORE", ${FROM_ADJ}, position, '+inf')
  ${SHIFT_UP}
  ${EDGE_REM}
end
return keys`

export const scripts =
  { oefrom:    { numberOfKeys: 1, lua: oefrom }
  , oeinsert:  { numberOfKeys: 0, lua: oeinsert }
  , oemove:    { numberOfKeys: 0, lua: oemove }
  , oeset:     { numberOfKeys: 0, lua: oeset }
  , oedel:     { numberOfKeys: 0, lua: oedel }
  , oedelfrom: { numberOfKeys: 0, lua: oedelfrom }
  , oedelto:   { numberOfKeys: 0, lua: oedelto }
  }

export default function(G, fType, eType, tType, fields) {

  const type = `${fType}:${eType}:${tType}`

  const props = _.assign
    ( { from:       'string'
      , to:         'string'
      , type:       'string'
      , position:   'integer'
      , created_at: 'integer'
      , updated_at: 'integer'
      }
    , fields
    )

  const parser = parsers(props, ['from', 'type', 'to', 'position', 'created_at', 'updated_at'])
  const { defaultProps
        , deserializer
        , serialize
        , normalize
        } = parser


  const jobs =

    { all: indexJob(type, parser)

    , from: ( from, { start = 1, stop = 0, properties } = {} ) =>
        properties
        ? normalize(properties).do(properties =>
            [ 'oefrom'
            , [ `${from}~[${type}]->`, properties, stop, start ]
            , fnMap(deserializer(properties))
            ]
          )
        : [ 'zrangebyscore'
          , [ `${from}~[${type}]->`, start, (stop > 0) ? stop : '+inf' ]
          , identity
          ]

    , to: ( to, { limit = 30, offset = 0, properties } = {} ) =>
        properties
        ? normalize(properties).do(properties =>
            [ 'eto'
            , [ `~[${type}]->${to}`, properties, limit, offset ]
            , fnMap(deserializer(properties))
            ]
          )
        : [ 'zrevrange'
          , [ `~[${type}]->${to}`, offset, offset + limit - 1 ]
          , identity
          ]

    // CONVENIENCE METHODS:
    , at: ( from, position, properties ) =>
        properties
        ? normalize(properties).do(properties =>
            [ 'oefrom'
            , [ `${from}~[${type}]->`, properties, position, position ]
            , fnHead(deserializer(properties))
            ]
          )
        : [ 'zrangebyscore'
          , [ `${from}~[${type}]->`, position, position ]
          , head
          ]

    , of: ( to, properties ) =>
        properties
        ? normalize(properties).do(properties =>
            [ 'eto'
            , [ `~[${type}]->${to}`, properties, 1, 0 ]
            , fnHead(deserializer(properties))
            ]
          )
        : [ 'zrevrange'
          , [ `~[${type}]->${to}`, 0, 1 ]
          , head
          ]

    , get: (from, to, properties) =>
        normalize(properties).do(properties =>
          [ 'hmget'
          , [ `${from}~[${type}]->${to}`, properties ]
          , deserializer(properties)
          ]
        )

    , push: (from, to, attrs) =>
        serialize(attrs).do((attrs, keys) =>
          [ 'oeinsert'
          , [ attrs, from, type, to, 'PUSH', +Date.now() ]
          , deserializer(keys)
          ]
        )

    , insert: (from, to, offset, attrs) =>
        serialize(attrs).do((attrs, keys) =>
          [ 'oeinsert'
          , [ attrs, from, type, to, offset, +Date.now() ]
          , deserializer(keys)
          ]
        )

    , update: (from, to, attrs) =>
        serialize(attrs).do((attrs, keys) =>
          [ 'oeset'
          , [ attrs, from, type, to, +Date.now() ]
          , deserializer(keys)
          ]
        )

    , move: (from, to, offset) =>
        [ 'oemove'
        , [ defaultProps, from, type, to, offset ]
        , deserializer(defaultProps)
        ]

    , delete: (from, to) =>
        [ 'oedel'
        , [ defaultProps, from, type, to ]
        , deserializer(defaultProps)
        ]

    , deleteFrom: from =>
        [ 'oedelfrom'
        , [ from, type ]
        , identity
        ]

    , deleteTo: to =>
        [ 'oedelto'
        , [ type, to ]
        , identity
        ]

    }

  return wrapExec(G, jobs)

}
