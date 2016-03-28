import { assert } from 'chai'
import Promise    from 'bluebird'

export const redisOpts =
  { db: 2 }

export function reset(G) {
  return function() {
    return G.redis
      .flushdb()
      .return(undefined)
  }
}

export function assertError(p) {
  return Promise.resolve(p)
    .then(a => assert.fail(a, undefined))
    .catch(assert.isOk)
}
