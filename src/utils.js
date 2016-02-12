import _ from 'lodash'

export function head(arr) {
  return arr && arr[0]
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

  }
}

export function serialize(attributes) {

}
