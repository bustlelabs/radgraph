// For performance reasons, we make the properties the first argument.
// Shifting an array is an expensive operation, but shortening is not.

// The following methods take the ARGV properties and converts them to a local vals table, preserving order

export const BUILD_VALS = `
local vals = {}
for i,v in ipairs(ARGV) do
  if i % 2 == 0 then
    table.insert(vals, v)
  end
end
`

export const APPEND_VAL = (name, value) => `
table.insert(ARGV, "${name}")
table.insert(ARGV, ${value})
table.insert(vals, ${value})
`

export const SET_IDX = (index, key, value = 'time') => `
redis.call("ZADD", type..":indices:${index}", ${value}, ${key})`

export const REM_IDX = (index, key) => `
redis.call("ZREM", type..":indices:${index}",           ${key})`

export const IDX_RANGE = `
local start = table.remove(ARGV)
local stop  = table.remove(ARGV) + start - 1
local keys  = redis.call("ZREVRANGE", KEYS[1], start, stop)

local results = {}
for _,key in ipairs(keys) do
  table.insert(results, redis.call("HMGET", key, unpack(ARGV)))
end

return results`
