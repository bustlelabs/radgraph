// For performance reasons, we make the properties the first argument.
// Shifting an array is an expensive operation, but shortening is not.

// The following methods take the ARGV properties and converts them to a local vals table, preserving order

export const APPEND_VAL = (name, value) => `
table.insert(ARGV, "${name}")
table.insert(ARGV, cjson.encode(${value}))`

// generates a unique 8 character id
export const GEN_ID = `
math.randomseed(time)
local CHAR_SET = "QWERTYUIOPASDFGHJKLZXCVBNMqwertyuiopasdfghjklzxcvbnm1234567890-_"
local rand = function(length)
  local s = ""
  for i=1,length do
    s=s..string.char(CHAR_SET:byte(math.random(1, 64)))
  end
  return s
end
local id = rand(8)
while redis.call("EXISTS", id) ~= 0 do
  id = rand(8)
end
`
