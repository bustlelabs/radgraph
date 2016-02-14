import Promise    from 'bluebird'
import _          from 'lodash'
import { assert } from 'chai'

import { resetGraph
       , Authored
       , Rated
       } from './graph'

describe('Radgraph', function() {

  before(function(done) {
    return resetGraph().then(done)
  })

  describe('.get', function() {

    it ('should work as a shorthand for .find', function() {
      return Promise.all
        ( [ Authored.find(1, 2)
          , Authored.get(1, 2)
          , Authored.inv.find(2, 1)
          , Authored.inv.get(2, 1)
          ] )
        .then(([[e1], e2, [e3], e4]) => {
          assert.deepEqual(e1, e2)
          assert.deepEqual(e2, e1)
          assert.deepEqual(e3, e4)
          assert.deepEqual(e4, e3)
        })
    })

    it ('should handle the empty case', function() {
      return Authored.get(1, 3)
        .then(r => {
          assert.isUndefined(r)
        })
    })

    it ('should augment results', function() {
      return Rated.get(1, 2)
        .then(r => {
          assert.property(r, 'data')
          assert.deepPropertyVal(r, 'data.rating', 5)
          assert.deepPropertyVal(r, 'data.note', 'foo')
        })
    })

    it ('should be able to query by time', function() {
      return Rated.find(1, 2)
        .then(r => r[1].time)
        .then(time => Rated.get(1, 2, { time }))
        .then(r => {
          assert.notDeepProperty(r, 'data.rating')
          assert.notDeepProperty(r, 'data.note')
        })
    })

    it ('should be able to handle unfound edges', function() {
      return Rated.get(1, 2, { time: 1 })
        .then(r => {
          assert.isNull(r)
        })
    })

  })

})
