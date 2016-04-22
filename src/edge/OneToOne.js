// TODO: write documentation on the underlying data structure
// QUICK NOTES:
// A one-to-one association is uniquely identified by the tuple (from, type)
// Querying forward is more performant than querying backwards, choose the direction of the relationship accordingly
// A one-to-one association contains the fields:
//   - from
//   - type
//   - to
//   - created_at
//   - updated_at

import _ from 'lodash'

import { identity
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

const VALIDATE = v => `
if not ${v} then
  if not to then
    to = ""
  end
  return { err = 'Edge "'..from..'-('..type..')->'..to..'" does not exist' }
end`

const EDGE_KEY = 'from.."-("..type..")->"'
const   TO_ADJ =       '"-("..type..")->"..to'

const REM_IDXS = `${REM_IDX("created_at", EDGE_KEY)} ${REM_IDX("updated_at", EDGE_KEY)}`

// scripts

const otoinv = `
local to   = table.remove(ARGV)
local type = table.remove(ARGV)
local from = redis.call("GET", ${TO_ADJ})
return redis.call("HMGET", ${EDGE_KEY}, unpack(ARGV))
`

const otoset = `
local time = table.remove(ARGV)
local to   = table.remove(ARGV)
local type = table.remove(ARGV)

local from = redis.call("GET", ${TO_ADJ})
if from and from ~= ARGV[table.getn(ARGV)] then
  redis.call("DEL", ${EDGE_KEY})
  ${REM_IDXS}
end

from = table.remove(ARGV)

local cur = redis.call("HMGET", ${EDGE_KEY}, 'to', 'created_at')
if cur[1] and cur[1] ~= to then
  redis.call("DEL", "-("..type..")->"..cur[1])
  redis.call("DEL", ${EDGE_KEY})
  -- no need to remove this idx, it will be reset
end

local created = time
if cur[1] == to then
  created = cur[2]
else
  ${SET_IDX("created_at", EDGE_KEY)}
end
${SET_IDX("updated_at", EDGE_KEY)}

${VALS("from", "type", "to", "created", "time")}
redis.call("HMSET", ${EDGE_KEY}, unpack(ARGV))
redis.call(  "SET",   ${TO_ADJ}, from)

return vals
`

const otodelfrom = `
local type = table.remove(ARGV)
local from = table.remove(ARGV)

local cur  = redis.call("HMGET", ${EDGE_KEY}, unpack(ARGV))
local to   = cur[table.getn(cur)-2]

${VALIDATE("to")}
${REM_IDXS}
redis.call("DEL", ${EDGE_KEY})
redis.call("DEL",   ${TO_ADJ})
return cur
`

const otodelto = `
local to   = table.remove(ARGV)
local type = table.remove(ARGV)
local from = redis.call("GET", ${TO_ADJ})

${VALIDATE("from")}

local cur  = redis.call("HMGET", ${EDGE_KEY}, unpack(ARGV))
${REM_IDXS}
redis.call("DEL", ${EDGE_KEY})
redis.call("DEL",   ${TO_ADJ})
return cur
`

export const scripts =
  { otoinv:     { numberOfKeys: 0, lua: otoinv }
  , otoset:     { numberOfKeys: 0, lua: otoset }
  , otodelfrom: { numberOfKeys: 0, lua: otodelfrom }
  , otodelto:   { numberOfKeys: 0, lua: otodelto }
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

    , of: (from, properties) =>
        properties
        ? normalize(properties).do(properties =>
            [ 'hmget'
            , [ `${from}-(${type})->`, properties ]
            , deserializer(properties)
            ]
          )
        : [ 'hget'
          , [ `${from}-(${type})->`, 'to' ]
          , identity
          ]

    , inv: (to, properties) =>
        properties
        ? normalize(properties).do(properties =>
            [ 'otoinv'
            , [ properties, type, to ]
            , deserializer(properties)
            ]
          )
        : [ 'get'
          , [ `-(${type})->${to}` ]
          , identity
          ]

    , set: (from, to, attrs) =>
        serialize(attrs).do((attrs, keys) =>
          [ 'otoset'
          , [ attrs, from, type, to, +Date.now() ]
          , deserializer(keys)
          ]
        )

    , delete: from =>
        [ 'otodelfrom'
        , [ defaultProps, from, type ]
        , deserializer(defaultProps)
        ]

    , deleteInv: to =>
        [ 'otodelto'
        , [ defaultProps, type, to ]
        , deserializer(defaultProps)
        ]

    }

  return wrapExec(G, jobs)

}
