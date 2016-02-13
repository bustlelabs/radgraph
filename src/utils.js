import _ from 'lodash'

export function head(arr) {
  return arr && arr[0]
}

export function response([err, val]) {
  if (err) throw err
  return val
}

export function ParseAdj(type, from) {
  return function(val) {
    const s = val.split(':')
    return val &&
      { type
      , from
      , to: parseInt(s[0], 10)
      , created_at: s[1]
      }
  }
}

export function ParseFullAdj(type, from, to) {
  return function (time) {
    return time &&
      { type
      , from
      , to
      , created_at: time
      }
  }
}

export function invertSchema(schema, inverse) {
  return { name: schema.inverse
         , from: schema.to
         , to: schema.from
         , _inverse: inverse
         , properties: schema.properties
         }
}

export function Deserialize(schema) {
  return function(attributes) {
    return _.mapValues
      ( attributes
      , ( value, key ) => {
          const prop = schema.properties[key]
          const type = prop && prop.type
          if (type === 'array' || type === 'object')
            return (typeof value === 'string')
              ? JSON.parse(value)
              : value
          else if (type === 'integer')
            return parseInt(value, 10)
          return value
        }
      )
  }
}

export function serialize(attributes) {
  return _.mapValues
    ( attributes
    , val => _.isObject(val)
        ? JSON.stringify(val)
        : val
    )
}
