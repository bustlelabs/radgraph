import Promise    from 'bluebird'
import _          from 'lodash'
import { assert } from 'chai'

import { resetGraph
       , Authored
       , Rated
       } from './graph'

describe ('Radgraph', function() {

  before(function(done) {
    return resetGraph().then(done)
  })

  describe('.find', function() {

    it ('should return all results', function() {
      return Rated.find(4, 6)
        .then(r => {
          assert.lengthOf(r, 3)
          assert.notDeepEqual(r[0], r[1])
          assert.notDeepEqual(r[1], r[2])
          assert.notDeepEqual(r[2], r[0])
          _.forEach
            ( r
            , e => {
              assert.propertyVal(e, 'type', 'Rated')
              assert.propertyVal(e, 'from', 4)
              assert.propertyVal(e, 'to'  , 6)
            })
        })
    })

    it ('should work on inverse edges', function() {
      return Promise.all
        ( [ Authored.find(1, 2)
          , Authored.inv.find(2, 1)
          ] )
        .then(([r1, r2]) => {
          assert.lengthOf(r1, 1)
          assert.lengthOf(r2, 1)
          const e1 = r1[0]
          const e2 = r2[0]
          assert.propertyVal(e1, 'type', 'Authored')
          assert.propertyVal(e2, 'type', 'AuthoredBy')
          assert.equal(e1.from, e2.to)
          assert.equal(e1.to, e2.from)
        })
    })

    it ('should take both limit and offset', function() {
      return Rated.find(4, 6, { offset: 1, limit: 1 })
        .then(r => {
          assert.lengthOf(r, 1)
          assert.deepPropertyVal(r, '0.data.rating', 2)
          assert.isUndefined(r[0].data.note)
        })
    })

    it ('should handle the empty case', function() {
      return Rated.find(1, 5)
        .then(r => {
          assert.lengthOf(r, 0)
        })
    })

  })

})
