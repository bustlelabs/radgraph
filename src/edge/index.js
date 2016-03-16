import _ from 'lodash'

// shared scripts

const efrom = `
local start = table.remove(ARGV)
local stop  = table.remove(ARGV) + start - 1

local ids   = redis.call("ZREVRANGE", KEYS[1], start, stop)
local results = {}
for _,to in ipairs(ids) do
  table.insert(results, redis.call("HMGET", KEYS[1]..to, unpack(ARGV)))
end
return results
`


const eto = `
local start = table.remove(ARGV)
local stop  = table.remove(ARGV) + start - 1

local ids   = redis.call("ZREVRANGE", KEYS[1], start, stop)
local results = {}
for _,from in ipairs(ids) do
  table.insert(results, redis.call("HMGET", from..KEYS[1], unpack(ARGV)))
end
return results
`

import { scripts as arrayScripts   } from './Array'
import { scripts as otmScripts     } from './OneToMany'
import { scripts as otoScripts     } from './OneToOne'
import { scripts as orderedScripts } from './Ordered'
import { scripts as semiOrdScripts } from './SemiOrdered'
import { scripts as simpleScripts  } from './Simple'

export const scripts = _.assign
  ( { efrom:    { numberOfKeys: 1, lua: efrom }
    , eto:      { numberOfKeys: 1, lua: eto }
    }
  , arrayScripts
  , otmScripts
  , otoScripts
  , orderedScripts
  , semiOrdScripts
  , simpleScripts
  )

export { default as ArrayEdge       } from './Array'
export { default as OneToMany       } from './OneToMany'
export { default as OneToOne        } from './OneToOne'
export { default as OrderedEdge     } from './Ordered'
export { default as SemiOrderedEdge } from './SemiOrdered'
export { default as SimpleEdge      } from './Simple'
