import _ from 'lodash'
import Promise from 'bluebird'

const SYSTEM_FIELDS =
  [ 'id'
  , 'created_at'
  , 'updated_at'
  , '_from'
  , '_type'
  , '_to'
  ]

export function deserialize(v) {
  return v && (v !== "") && JSON.parse(v)
}

export function deserializeHash(hash) {
  return _(hash)
    .chunk(2)
    .fromPairs()
    .mapValues(deserialize)
    .value()
}

export function serialize(attrs, fields) {
  // TODO: validate types
  const isOk = fields
    ? (k => fields[k])
    : (k => !~SYSTEM_FIELDS.indexOf(k))
  return _.flatMap
    ( attrs
    , (v, k) => isOk(k)
        ? [ k, JSON.stringify(v) ]
        : []
    )
}
