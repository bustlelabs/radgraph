// TODO: write documentation on the underlying data structure
// QUICK NOTES:
// An array association is meant for a list of associations with a predictable length
// An array association is uniquely identified by a tuple (from, type, index)
// An array association contains the fields:
//   - from
//   - type
//   - to
//   - index
//   - created_at
//   - updated_at

import _ from 'lodash'

import { identity
       , head
       , fnHead
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

const VALS = (from, type, to, index, created_at, updated_at) => `
${BUILD_VALS}
${APPEND_VAL("from"       , from)}
${APPEND_VAL("type"       , type)}
${APPEND_VAL("to"         , to)}
${APPEND_VAL("index"      , index)}
${APPEND_VAL("created_at" , created_at)}
${APPEND_VAL("updated_at" , updated_at)}`

const EDGE_KEY = 'from.."~["..type.."]=>:"..index'
const FROM_ADJ = 'from.."~["..type.."]=>"'
const   TO_ADJ =       '"~["..type.."]=>"..to'

// scripts

const aefrom = `
local start = table.remove(ARGV) + 0
local stop  = table.remove(ARGV) + 0

local results = {}
for i=start,stop do
  table.insert(results, redis.call("HMGET", KEYS[1]..':'..i, unpack(ARGV)))
end

return results`

// TODO: abstract these from/to scripts to not suck as much
const aeto = `
local start = table.remove(ARGV)
local stop  = table.remove(ARGV) + start - 1

local keys  = redis.call("ZREVRANGE", KEYS[1], start, stop)
local results = {}
for _,key in ipairs(keys) do
  table.insert(results, redis.call("HMGET", key, unpack(ARGV)))
end

return results`

const aeset = `
local time  = table.remove(ARGV)
local index = table.remove(ARGV)
local to    = table.remove(ARGV)
local type  = table.remove(ARGV)
local from  = table.remove(ARGV)

local edge_key = ${EDGE_KEY}
local cur      = redis.call("HMGET", edge_key, 'to', 'created_at')

local didcreate = false
local created = time
if cur[1] then
  if cur[1] ~= to then
    redis.call("ZREM", "~["..type.."]=>"..cur[1], edge_key)
    didcreate = true
    -- no need to remove indexes, they will get updated
  else
    created = cur[2]
  end
else
  didcreate = true
end
${VALS("from", "type", "to", "index", "created", "time")}
redis.call("HMSET",    edge_key, unpack(ARGV)          )
redis.call( "HSET", ${FROM_ADJ},        index,       to)
redis.call( "ZADD",   ${TO_ADJ},         time, edge_key)
if didcreate then ${SET_IDX("created_at", "edge_key")} end
${SET_IDX("updated_at", "edge_key")}

return vals`

const aeswap = `
local pos1 = table.remove(ARGV) + 0
local pos2 = table.remove(ARGV) + 0
local type = table.remove(ARGV)
local from = table.remove(ARGV)

local from_key = from.."~["..type.."]=>"
local k1       =             from_key..":"..pos1
local k2       =             from_key..":"..pos2

local hm1  = redis.call("HGETALL", k1)
local hm2  = redis.call("HGETALL", k2)

local to1, to2, created1, created2, updated1, updated2 = nil
for i,v in ipairs(hm1) do
  if v == "to"          then to1      = hm1[i+1] end
  if v == "created_at"  then created1 = hm1[i+1] end
  if v == "updated_at"  then updated1 = hm1[i+1] end
  if v == "index"       then hm1[i+1] = pos2     end
end
for i,v in ipairs(hm2) do
  if v == "to"          then to2      = hm2[i+1] end
  if v == "created_at"  then created2 = hm2[i+1] end
  if v == "updated_at"  then updated2 = hm2[i+1] end
  if v == "index"       then hm2[i+1] = pos1     end
end

if not to1 and not to2 then
  return { {}, {} }
end

-- swap index scores
if to2 then
  ${SET_IDX("created_at", "k1", "created2")}
  ${SET_IDX("updated_at", "k1", "updated2")}
else
  ${REM_IDX("created_at", "k1")}
  ${REM_IDX("updated_at", "k1")}
end
if to1 then
  ${SET_IDX("created_at", "k2", "created1")}
  ${SET_IDX("updated_at", "k2", "updated1")}
else
  ${REM_IDX("created_at", "k2")}
  ${REM_IDX("updated_at", "k2")}
end

-- swap adjacencies and edges
redis.call("DEL"  , k1, k2)
if to2 then
  redis.call("HSET", from_key, pos1, to2 )
  redis.call("ZREM", "~["..type.."]=>"..to2,           k2)
  redis.call("ZADD", "~["..type.."]=>"..to2, updated2, k1)
  redis.call("HMSET", k1, unpack(hm2))
else
  redis.call("HDEL", from_key, pos1)
end

if to1 then
  redis.call("HSET", from_key, pos2, to1 )
  redis.call("ZREM", "~["..type.."]=>"..to1,           k1)
  redis.call("ZADD", "~["..type.."]=>"..to1, updated2, k2)
  redis.call("HMSET", k2, unpack(hm1))
else
  redis.call("HDEL", from_key, pos2)
end

return { redis.call("HMGET", k1, unpack(ARGV))
       , redis.call("HMGET", k2, unpack(ARGV))
       }`

const aedel = `
local index = table.remove(ARGV)
local type  = table.remove(ARGV)
local from  = table.remove(ARGV)

local edge_key = ${EDGE_KEY}
local cur = redis.call("HMGET", edge_key, unpack(ARGV))
local to  = cur[table.getn(cur)-3]
${REM_IDX("created_at", "edge_key")}
${REM_IDX("updated_at", "edge_key")}
redis.call("ZREM",   ${TO_ADJ}, edge_key)
redis.call("HDEL", ${FROM_ADJ},    index)
redis.call("DEL", edge_key)

return cur`

const aedelfrom = `
local type = table.remove(ARGV)
local from = table.remove(ARGV)

local from_key = ${FROM_ADJ}
local deleted = {}

local entries = redis.call("HGETALL", from_key)
local pos = nil
for i,to in ipairs(entries) do
  if i % 2 == 1 then
    pos = to
  else
    local edge_key = from_key..":"..pos
    redis.call("ZREM", ${TO_ADJ}, edge_key)
    ${REM_IDX("updated_at", "edge_key")}
    ${REM_IDX("created_at", "edge_key")}
    redis.call("DEL", edge_key)
    table.insert(deleted, { pos, to })
  end
end
redis.call("DEL", from_key)

return deleted`

const aedelto = `
local to   = table.remove(ARGV)
local type = table.remove(ARGV)

local to_key = ${TO_ADJ}
local keys = redis.call("ZREVRANGE", to_key, 0, -1)
for _,key in ipairs(keys) do
  local from,_,index = key:match("([^~]+)~%[([%w:]+)%]=>:(%d+)")
  local edge_key = ${EDGE_KEY}
  ${REM_IDX("created_at", "edge_key")}
  ${REM_IDX("updated_at", "edge_key")}
  redis.call("HDEL", ${FROM_ADJ}, index)
  redis.call("DEL", edge_key)
end
redis.call("DEL", to_key)

return keys`

export const scripts =
  { aefrom:    { numberOfKeys: 1, lua: aefrom    }
  , aeto:      { numberOfKeys: 1, lua: aeto      }
  , aeset:     { numberOfKeys: 0, lua: aeset     }
  , aeswap:    { numberOfKeys: 0, lua: aeswap    }
  , aedel:     { numberOfKeys: 0, lua: aedel     }
  , aedelfrom: { numberOfKeys: 0, lua: aedelfrom }
  , aedelto:   { numberOfKeys: 0, lua: aedelto   }
  }

export default function(G, fType, eType, tType, fields) {

  const type = `${fType}:${eType}:${tType}`

  const props = _.assign
    ( { from:       'string'
      , to:         'string'
      , type:       'string'
      , index:      'integer'
      , created_at: 'integer'
      , updated_at: 'integer'
      }
    , fields
    )

  const parser = parsers(props, ['from', 'type', 'to', 'index', 'created_at', 'updated_at'])
  const { defaultProps
        , deserializer
        , serialize
        , normalize
        } = parser

  const jobs =

    { all: indexJob(type, parser)

    , from: (from, start, stop, properties) =>
        properties
        ? normalize(properties).do(properties =>
            [ 'aefrom'
            , [ `${from}~[${type}]=>`, properties, stop, start ]
            , fnMap(deserializer(properties))
            ]
          )
        : [ 'hmget'
          , [ `${from}~[${type}]=>`, _.range(start, stop+1) ]
          , identity
          ]

    , to: (to, { limit = 30, offset = 0, properties } = {}) =>
        properties
        ? normalize(properties).do(properties =>
            [ 'aeto'
            , [ `~[${type}]=>${to}`, properties, type, to, limit, offset ]
            , fnMap(deserializer(properties))
            ]
          )
        : [ 'zrevrange'
          , [ `~[${type}]=>${to}`, offset, offset + limit - 1 ]
          , parseTo
          ]

    // CONVENIENCE METHODS
    , at: (from, position, properties) =>
        properties
        ? normalize(properties).do(properties =>
            [ 'aefrom'
            , [ `${from}~[${type}]=>`, properties, position, position ]
            , fnHead(deserializer(properties))
            ]
          )
        : [ 'hget'
          , [ `${from}~[${type}]=>`, position ]
          , identity
          ]

    , set: (from, position, to, attrs) =>
        serialize(attrs).do((attrs, keys) =>
          [ 'aeset'
          , [ attrs, from, type, to, position, +Date.now() ]
          , deserializer(keys)
          ]
        )

    , swap: (from, pos1, pos2) =>
        [ 'aeswap'
        , [ defaultProps, from, type, pos2, pos1 ]
        , fnMap(deserializer(defaultProps))
        ]

    , delete: (from, position) =>
        [ 'aedel'
        , [ defaultProps, from, type, position ]
        , deserializer(defaultProps)
        ]

    , deleteFrom: from =>
        [ 'aedelfrom'
        , [ from, type ]
        , parseFrom
        ]

    , deleteTo: to =>
        [ 'aedelto'
        , [ type, to ]
        , parseTo
        ]

    }

  return wrapExec(G, jobs)

}

// TODO: parse this into a better format, i.e. an array
function parseFrom(keys) {
  return _(keys)
    .map(([ p, k ]) => [ parseInt(p, 10), k ])
    .fromPairs()
    .value()
}

function parseTo(keys) {
  return _.map
    ( keys
    , key => {
        let k = key.split('~[')
        return [ k[0] , parseInt(k[1].split(']=>:')[1], 10) ]
      }
    )
}
