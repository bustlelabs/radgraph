import Promise    from 'bluebird'
import _          from 'lodash'
import { assert } from 'chai'

import { resetGraph
       , serial
       , Clipped
       } from './graph'

describe ('Radgraph', function() {

  before(function(done) {
    return resetGraph().then(done)
  })

  describe('.set', function() {

    it ('should update the latest edge', function() {
      return Clipped.set(2, 1, { title: "Baz", description: "desc"})
        .then(r => {
          assert.propertyVal(r, 'from', 2)
          assert.propertyVal(r, 'to', 1)
          assert.deepPropertyVal(r, 'data.title', "Baz")
          assert.deepPropertyVal(r, 'data.description', "desc")
        })
        .then(() => Clipped.from(2, { offset: 2 }))
        .then(([e1, e2]) => {
          assert.deepPropertyVal(e1, 'data.title', "Baz")
          assert.deepPropertyVal(e1, 'data.description', "desc")
          assert.isUndefined(e2.data.description)
        })
    })

    it ('should update the inverse edge', function() {
      return Clipped.set(2, 2, { title: "foo", description: "bar" })
        .then(() => Promise.all
          ( [ Clipped.get(2, 2)
            , Clipped.inv.get(2, 2)
            ] ))
        .then(([e1, e2]) => {
          assert.deepPropertyVal(e1, 'data.title', "foo")
          assert.deepPropertyVal(e2, 'data.description', "bar")
          assert.deepEqual(e1.data, e2.data)
        })
    })

    it ('should update from inverse edge', function() {
      return Clipped.inv.set(3, 2, { title: "baz" })
        .then(r => {
          assert.propertyVal(r, 'type', 'ClippedBy')
          assert.deepPropertyVal(r, 'data.title', 'baz')
        })
        .then(() => Promise.all
          ( [ Clipped.get(2, 3)
            , Clipped.inv.get(3, 2)
            ] ))
        .then(([e1, e2]) => {
          assert.deepPropertyVal(e1, 'data.title', 'baz')
          assert.deepEqual(e1.data, e2.data)
        })

    })

    it ('should take a time attribute', function() {
      return Clipped.find(2, 1)
        .then(r => r[1].time)
        .then(time => Clipped.set(2, 1, { title: "foo", time }))
        .then(r => {
          assert.deepPropertyVal(r, 'data.title', 'foo')
        })
        .then(() => Clipped.find(2, 1))
        .then(r => {
          assert.deepPropertyVal(r, '1.data.title', 'foo')
        })
    })

    it ('should handle null cases', function() {
      return Promise.all
        ( [ Clipped.set(2, 5, { title: "test" })
          , Clipped.set(2, 1, { title: "test", time: 1 })
          ] )
        .then(([e1, e2]) => {
          assert.isNull(e1)
          assert.isNull(e2)
        })
        .then(() => Clipped.from(2))
        .then(r => {
          _.forEach
            ( r
            , e => {
              assert.deepPropertyNotVal(e, 'data.title', 'test')
            })
        })
    })

  })

})
