import _          from 'lodash'
import { assert } from 'chai'
import Promise    from 'bluebird'
import Radgraph   from '../src'

export const G = Radgraph
  ( { db: 2
    }
  )

export function reset() {
  return G.redis.flushdb().return(undefined)
}

export function assertError(fn) {
  return fn()
  .then(a => assert.fail(a, undefined))
  .catch(assert.isOk)
}

export function serial(jobs) {
  return _.reduce
    ( jobs
    , (p, job) =>
        p.then
          ( r =>
            job().then
              ( v =>
                ( r.push(v), r)
              )
          )
    , Promise.resolve([])
    )
}
