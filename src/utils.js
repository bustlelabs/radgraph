import _ from 'lodash'
import Promise from 'bluebird'

export function throwError(message) {
  throw new Error(message)
  return Promise.reject(message)
}

export function assert(condition, message) {
  return condition || Promise.reject(message)
}
