// TODO: write documentation on underlying data structure
// QUICK NOTES:
// A semi ordered association lives between a simple association and an ordered association
// Pretty much, whenever you need to curate a feed of items without duplicates
// Semi ordered associations are optimized for reverse chron, and as a consequence, does not maintain a "strict" ordering
//   i.e. there is no guarantee of the ZSCORE of an item given its position
//        this allows for more efficient insertions and deletions when ordering is less strict than an "owns" relationship
// Therefore, there is no position attribute associated with an edge, although position attributes can still be taken for pushing and popping items
//
// A semi-ordered association is uniquely identified by a tuple (from, type, to):
// A semi-ordered association contains the following fields:
//   - from
//   - type
//   - to
//   - created_at
//   - updated_at
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
  return { err = 'Edge "'..from..'~-['..type..']->'..to..'" does not exist' }
end
`

const EDGE_KEY = `from.."~-["..type.."]->"..to`
const FROM_ADJ = `from.."~-["..type.."]->"`
const   TO_ADJ =       `"~-["..type.."]->"..to`

const SHIFT = amt => `
for _,id in ipairs(displaced) do
  redis.call("ZINCRBY", from_key, ${amt}, id)
end
`
// scripts

// TODO: optimize these movement scripts so only necessary edges are moved, i.e. taking advantage of blank spaces

const soeinsert = `
local time   = table.remove(ARGV)
local offset = table.remove(ARGV)
local to     = table.remove(ARGV)
local type   = table.remove(ARGV)
local from   = table.remove(ARGV)

local from_key = ${FROM_ADJ}
local edge_key = ${EDGE_KEY}
local above    = redis.call("ZREVRANGE", from_key, offset, offset, "WITHSCORES")[2]
local score    = (above or 0) + 1

local displaced = redis.call("ZRANGEBYSCORE", from_key, score, "+inf")
${SHIFT(1)}

${VALS("from", "type", "to", "time", "time")}
redis.call("ZADD",  from_key, score,   to)
redis.call("ZADD", ${TO_ADJ},  time, from)
redis.call("HMSET", edge_key, unpack(ARGV))
${SET_IDX("created_at", "edge_key")}
${SET_IDX("updated_at", "edge_key")}

return vals`

const soemove = `
local offset  = table.remove(ARGV)
local to      = table.remove(ARGV)
local type    = table.remove(ARGV)
local from    = table.remove(ARGV)

local edge_key = ${EDGE_KEY}
local from_key = ${FROM_ADJ}

local cur      = redis.call("HMGET",  edge_key, unpack(ARGV))
local created  = cur[table.getn(cur)-1]
local curpos   = redis.call("ZSCORE", from_key, to) + 0
local above    = redis.call("ZREVRANGE", from_key, offset, offset, "WITHSCORES")[2]
local score    = (above or 0) + 0

${VALIDATE}
if curpos <= score then
  local displaced = redis.call("ZRANGEBYSCORE", from_key, curpos, score)
  ${SHIFT(-1)}
else
  local displaced = redis.call("ZRANGEBYSCORE", from_key, score, curpos)
  ${SHIFT(1)}
end
redis.call("ZADD", from_key, score, to)

return cur`

const soeset = `
local time = table.remove(ARGV)
local to   = table.remove(ARGV)
local type = table.remove(ARGV)
local from = table.remove(ARGV)

local edge_key = ${EDGE_KEY}
local from_key = ${FROM_ADJ}

local created = redis.call("HGET", edge_key, 'created_at')

${VALIDATE}
${VALS("from", "type", "to", "created", "time")}
redis.call("HMSET", edge_key, unpack(ARGV))
redis.call("ZADD", ${TO_ADJ}, time, from)
${SET_IDX("updated_at", "edge_key")}

return vals`

const soedel = `
local to   = table.remove(ARGV)
local type = table.remove(ARGV)
local from = table.remove(ARGV)

local from_key = ${FROM_ADJ}
local edge_key = ${EDGE_KEY}

local cur = redis.call("HMGET", edge_key, unpack(ARGV))
local created = cur[table.getn(cur)-1]

${VALIDATE}
redis.call("ZREM",  from_key,   to)
redis.call("ZREM", ${TO_ADJ}, from)
${REM_IDX("updated_at", "edge_key")}
${REM_IDX("created_at", "edge_key")}
redis.call("DEL",   edge_key)

return cur`

const soedelfrom = `
local type = table.remove(ARGV)
local from = table.remove(ARGV)

local from_key = ${FROM_ADJ}
local keys     = redis.call("ZRANGE", from_key, 0, -1)

redis.call("DEL", from_key)
for _,to in ipairs(keys) do
  local edge_key = ${EDGE_KEY}
  redis.call("ZREM", ${TO_ADJ}, from)
  ${REM_IDX("updated_at", "edge_key")}
  ${REM_IDX("created_at", "edge_key")}
  redis.call("DEL" ,  edge_key)
end

return keys`

const soedelto = `
local to   = table.remove(ARGV)
local type = table.remove(ARGV)

local to_key = ${TO_ADJ}
local keys   = redis.call("ZRANGE", to_key, 0, -1)

redis.call("DEL", to_key)
for _,from in ipairs(keys) do
  local edge_key = ${EDGE_KEY}
  redis.call("ZREM", ${FROM_ADJ}, to)
  ${REM_IDX("updated_at", "edge_key")}
  ${REM_IDX("created_at", "edge_key")}
  redis.call("DEL" ,  edge_key)
end

return keys`

export const scripts =
  { soeinsert:  { numberOfKeys: 0, lua: soeinsert }
  , soemove:    { numberOfKeys: 0, lua: soemove }
  , soeset:     { numberOfKeys: 0, lua: soeset }
  , soedel:     { numberOfKeys: 0, lua: soedel }
  , soedelfrom: { numberOfKeys: 0, lua: soedelfrom }
  , soedelto:   { numberOfKeys: 0, lua: soedelto }
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

    , from: ( from, { limit = 30, offset = 0, properties } = {} ) =>
        properties
        ? normalize(properties).do(properties =>
            [ 'efrom'
            , [ `${from}~-[${type}]->`, properties, limit, offset ]
            , fnMap(deserializer(properties))
            ]
          )
        : [ 'zrevrange'
          , [ `${from}~-[${type}]->`, offset, offset + limit - 1 ]
          , identity
          ]

    , to: ( to, { limit = 30, offset = 0, properties } = {} ) =>
        properties
        ? normalize(properties).do(properties =>
            [ 'eto'
            , [ `~-[${type}]->${to}`, properties, limit, offset ]
            , fnMap(deserializer(properties))
            ]
          )
        : [ 'zrevrange'
          , [ `~-[${type}]->${to}`, offset, offset + limit - 1 ]
          , identity
          ]

    // CONVENIENCE METHODS:
    , at: ( from, offset, properties ) =>
        properties
        ? normalize(properties).do(properties =>
            [ 'efrom'
            , [ `${from}~-[${type}]->`, properties, 1, offset ]
            , fnHead(deserializer(properties))
            ]
          )
        : [ 'zrevrange'
          , [ `${from}~-[${type}]->`, offset, offset ]
          , head
          ]

    , of: ( to, properties ) =>
        properties
        ? normalize(properties).do(properties =>
            [ 'eto'
            , [ `~-[${type}]->${to}`, properties, 1, 0 ]
            , fnHead(deserializer(properties))
            ]
          )
        : [ 'zrevrange'
          , [ `~-[${type}]->${to}`, 0, 1 ]
          , head
          ]

    , get: (from, to, properties) =>
        normalize(properties).do(properties =>
          [ 'hmget'
          , [ `${from}~-[${type}]->${to}`, properties ]
          , deserializer(properties)
          ]
        )

    , push: (from, to, attrs) => jobs.insert(from, to, 0, attrs)

    , insert: (from, to, offset, attrs) =>
        serialize(attrs).do((attrs, keys) =>
          [ 'soeinsert'
          , [ attrs, from, type, to, offset, +Date.now() ]
          , deserializer(keys)
          ]
        )

    , update: (from, to, attrs) =>
        serialize(attrs).do((attrs, keys) =>
          [ 'soeset'
          , [ attrs, from, type, to, +Date.now() ]
          , deserializer(keys)
          ]
        )

    , move: (from, to, offset) =>
        [ 'soemove'
        , [ defaultProps, from, type, to, offset ]
        , deserializer(defaultProps)
        ]

    , delete: (from, to) =>
        [ 'soedel'
        , [ defaultProps, from, type, to ]
        , deserializer(defaultProps)
        ]

    , deleteFrom: from =>
        [ 'soedelfrom'
        , [ from, type ]
        , identity
        ]

    , deleteTo: to =>
        [ 'soedelto'
        , [ type, to ]
        , identity
        ]

    }

  return wrapExec(G, jobs)

}
