// TODO: write documentation on the underlying data structure
// QUICK NOTES:
// there exists a global ID generator __G:id
// vertices are stored at integer ids
// a vertex is a redis Hash
// all vertices contain the fields:
//   - id
//   - type
//   - created_at
//   - updated_at
// there exist 2 indices of ids, stored as ZSETs, meant to be utility function for internal DB operations only
//   - TYPE:indices:created_at
//   - TYPE:indices:updated_at
// to express more complicated indices, create attributes and use graph operations

import _ from 'lodash'

import { identity
       , indexJob
       , wrapExec
       , parsers
       } from '../utils'

// macros

import { BUILD_VALS
       , APPEND_VAL
       } from '../macros'

const VALS = (id, created_at, updated_at, type) => `
${BUILD_VALS}
${APPEND_VAL("id"         , id)}
${APPEND_VAL("created_at" , created_at)}
${APPEND_VAL("updated_at" , updated_at)}
${APPEND_VAL("type"       , type)}
`

const VALIDATE_CUR = (idIdx, typeIdx) => `
if not cur[${idIdx}] then
  return { err = 'Vertex "'..id..'" not found' }
end
if type ~= cur[${typeIdx}] then
  return { err = 'Vertex "'..id..'" is of type "'..cur[${typeIdx}]..'", expected "'..type..'"' }
end
`

const SET_IDX = (index, val) => `
redis.call("ZADD", type..":indices:${index}", ${val}, id)
`

const REM_IDX = index => `
redis.call("ZREM", type..":indices:${index}", id)
`

// scripts

const vadd = `
local time = table.remove(ARGV)
local type = table.remove(ARGV)
local id   = redis.call("INCR", "__G:id")

${VALS("id", "time", "time", "type")}
redis.call("HMSET", id, unpack(ARGV))
${SET_IDX("created_at", "time")}
${SET_IDX("updated_at", "time")}

return vals`

const vset = `
local time = table.remove(ARGV)
local type = table.remove(ARGV)
local id   = table.remove(ARGV)
local cur  = redis.call("HMGET", id, "id", "type", "created_at")

${VALIDATE_CUR(1, 2)}
${VALS("id", "cur[3]", "time", "type")}
redis.call("HMSET", id, unpack(ARGV))
${SET_IDX("updated_at", "time")}

return vals
`

const vrem = `
local type = table.remove(ARGV)
local id   = table.remove(ARGV)
local cur  = redis.call("HMGET", id, unpack(ARGV))

${VALIDATE_CUR("table.getn(cur)-3", "table.getn(cur)")}
${REM_IDX("created_at")}
${REM_IDX("updated_at")}
redis.call("DEL", id)

return cur
`

export const scripts =
  { vadd   : { numberOfKeys: 0, lua: vadd }
  , vset   : { numberOfKeys: 0, lua: vset }
  , vrem   : { numberOfKeys: 0, lua: vrem }
  }

// NOTE: this is a placeholder implementation
// ideally this would be more deeply integrated with radredis
export default function (G, type, fields) {

  const keyspace = type

  const props = _.assign
    ( { id:         'integer'
      , created_at: 'integer'
      , updated_at: 'integer'
      , type:       'string'
      }
    , fields
    )
  const parser = parsers(props, ['id', 'created_at', 'updated_at', 'type'])
  const { defaultProps
        , deserializer
        , serialize
        , normalize
        } = parser

  const jobs =

    { all: indexJob(keyspace, parser)

    , get: (id, properties = defaultProps) =>
        normalize(properties).do(properties =>
          [ `hmget`
          , [ id, properties ]
          , deserializer(properties)
          ]
        )

    , create: attrs =>
        serialize(attrs).do((attrs, keys) =>
          [ 'vadd'
          , [ attrs, type, +Date.now() ]
          , deserializer(keys)
          ]
        )

    , update: (id, attrs) =>
        serialize(attrs).do((attrs, keys) =>
          [ 'vset'
          , [ attrs, id, type, +Date.now() ]
          , deserializer(keys)
          ]
        )

    , delete: id =>
        [ 'vrem'
        , [ defaultProps, id, type ]
        , deserializer(defaultProps)
        ]

    }

  return wrapExec(G, jobs)

}
