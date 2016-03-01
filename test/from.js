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
    return resetGraph().then(done)
  })

  describe ('.from', function() {

    it ('should return all results', function() {
      return Authored.from(1)
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
      return Authored.inv.from(4)
        .then(r => {
          assert.lengthOf(r, 1)
          const e = r[0]
          assert.propertyVal(e, 'type', 'AuthoredBy')
          assert.propertyVal(e, 'from', 4)
          assert.propertyVal(e, 'to'  , 2)
        })
    })

    it ('should take a limit param', function() {
      return Authored.from(3, { limit: 2 })
        .then(r => {
          assert.lengthOf(r, 2)
          assert.propertyVal(r[1], 'to', 6)
        })
    })

    it ('should take an offset param', function() {
      return Authored.from(2, { offset: 1 })
      .then(r => {
        assert.lengthOf(r, 1)
          assert.propertyVal(r[0], 'to', 3)
      })
    })

    it ('should take both limit and offset', function() {
      return Authored.from(1, { offset: 1, limit: 3 })
      .then(r => {
        assert.lengthOf(r, 3)
        assert.propertyVal(r[2], 'to', 2)
      })
    })

    it ('should handle the empty case', function() {
      return Authored.from(4)
      .then(r => {
        assert.lengthOf(r, 0)
      })
    })

    it ('should augment responses with data', function() {
      return Rated.from(1)
      .then(r => {
        _.forEach(r, e => assert.property(e, 'data'))

        assert.isUndefined(r[2].data.rating)
        assert.isUndefined(r[2].data.note)

        assert.deepPropertyVal(r[1], 'data.rating', 5)
        assert.deepPropertyVal(r[1], 'data.note', 'foo')

        assert.deepPropertyVal(r[0], 'data.rating', 3)
        assert.isUndefined(r[0].data.note)

      })
    })

    it ('should have a working "of" shorthand', function() {
      return Promise.all(
        [ Authored.inv.of(4)
        , Authored.inv.from(4)
        , Rated.of(1)
        , Rated.from(1)
        ]).then(([e1, [e2], e3, [e4]]) => {
          assert.deepEqual(e1, e2)
          assert.deepEqual(e3, e4)
        })
    })

  })

})
