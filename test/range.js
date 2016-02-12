import Promise    from 'bluebird'
import _          from 'lodash'
import { assert } from 'chai'

import { resetGraph
       // models
       , users
       , posts
       // associations
       , Authored
       , Rated
       } from './graph'

describe ('Radgraph', function() {

  before(function(done) {
    return resetGraph().then(() => done())
  })

  describe ('.range', function() {

    it ('should return all results', function() {
      return Authored.range(1)
        .then(r => {
          assert.lengthOf(r, 5)
          _.forEach
            ( r
            , e => {
                assert.propertyVal(e, 'type', 'Authored')
                assert.propertyVal(e, 'from', 1)
                assert.property(e, 'to')
                assert.isObject(posts[e.from])
                assert.isObject(posts[e.to])
              }
            )
        })
    })

    it ('should return inverse results', function() {
      return Authored.inv.range(4)
        .then(r => {
          assert.lengthOf(r, 1)
          const e = r[0]
          assert.propertyVal(e, 'type', 'AuthoredBy')
          assert.propertyVal(e, 'from', 4)
          assert.propertyVal(e, 'to'  , 2)
        })
    })

    it ('should take a limit param', function() {
      return Authored.range(3, { limit: 2 })
        .then(r => {
          assert.lengthOf(r, 2)
          assert.propertyVal(r[1], 'to', 6)
        })
    })

    it ('should take an offset param', function() {
      return Authored.range(2, { offset: 1 })
      .then(r => {
        assert.lengthOf(r, 1)
          assert.propertyVal(r[0], 'to', 3)
      })
    })

    it ('should take both limit and offset', function() {
      return Authored.range(1, { offset: 1, limit: 3 })
      .then(r => {
        assert.lengthOf(r, 3)
          assert.propertyVal(r[2], 'to', 2)
      })
    })

    it ('should augment responses with data', function() {
      return Rated.range(1)
      .then(r => {
        _.forEach(r, e => assert.property(e, 'data'))

        assert.notDeepProperty(r[2], 'data.rating')
        assert.notDeepProperty(r[2], 'data.note')


        assert.deepPropertyVal(r[1], 'data.rating', 5)
        assert.deepPropertyVal(r[1], 'data.note', 'foo')

        assert.deepPropertyVal(r[0], 'data.rating', 3)
        assert.notDeepProperty(r[0], 'data.note')

      })
    })

  })

})
