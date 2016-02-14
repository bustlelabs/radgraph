import Promise    from 'bluebird'
import _          from 'lodash'
import { assert } from 'chai'

import { resetGraph
       , serial
       , Clipped
       , Rated
       } from './graph'

describe ('Radgraph', function() {

  before(function(done) {
    return resetGraph().then(done)
  })

  describe('.add', function() {

    it ('should work', function() {
      return Rated.add(1, 5, { rating: 5, note: "bar" })
        .then(r => {
          assert.propertyVal(r, 'type', 'Rated')
          assert.propertyVal(r, 'from', 1)
          assert.propertyVal(r, 'to', 5)
          assert.deepPropertyVal(r, 'data.rating', 5)
          assert.deepPropertyVal(r, 'data.note', "bar")
          return r.created_at
        })
        .then(time => Rated.get(1, 5, { time }))
        .then(r => {
          assert.propertyVal(r, 'type', 'Rated')
          assert.propertyVal(r, 'from', 1)
          assert.propertyVal(r, 'to', 5)
          assert.deepPropertyVal(r, 'data.rating', 5)
          assert.deepPropertyVal(r, 'data.note', "bar")
          return r.created_at
        })
    })

    it ('should create inverse edges', function() {
      return Clipped.add(1, 5, { title: "Quuxxx" })
        .then(r => r.created_at)
        .then(time => Promise.all
          ( [ Clipped.get(1, 5, { time })
            , Clipped.inv.get(5, 1, { time })
            ] ))
        .then(([e1, e2]) => {
          assert.propertyVal(e1, 'from', 1)
          assert.propertyVal(e1, 'to',   5)
          assert.propertyVal(e2, 'from', 5)
          assert.propertyVal(e2, 'to',   1)
          assert.deepPropertyVal(e1, 'data.title', 'Quuxxx')
          assert.deepEqual(e1.data, e2.data)
        })
    })

    it ('should create edges from inverses', function() {
       return Clipped.inv.add(6, 1, { title: "Foobar" })
        .then(r => r.created_at)
        .then(time => Promise.all
          ( [ Clipped.get(1, 6, { time })
            , Clipped.inv.get(6, 1, { time })
            ] ))
        .then(([e1, e2]) => {
          assert.propertyVal(e1, 'from', 1)
          assert.propertyVal(e1, 'to',   6)
          assert.propertyVal(e2, 'from', 6)
          assert.propertyVal(e2, 'to',   1)
          assert.deepPropertyVal(e1, 'data.title', 'Foobar')
          assert.deepEqual(e1.data, e2.data)
        })
    })

    it ('should handle duplicate edges', function() {
      return serial
        ( [ () => Clipped.add(1, 3, { title: "three" })
          , () => Promise.delay(2)
          , () => Clipped.add(1, 3, { title: "two" })
          , () => Promise.delay(2)
          , () => Clipped.add(1, 3, { title: "one" })
          ] )
        .then(() => Clipped.all(1, 3))
        .then(([e1, e2, e3]) => {
          assert.deepPropertyVal(e1, 'data.title', 'one')
          assert.deepPropertyVal(e2, 'data.title', 'two')
          assert.deepPropertyVal(e3, 'data.title', 'three')
        })
    })

    it ('should maintain order', function() {
      return Rated.add(3, 3, { rating: 1, note: "bar" })
        .then(() => Rated.from(3))
        .then(r => {
          assert.lengthOf(r, 3)
          const [e1, e2, e3] = r
          assert.propertyVal(e1, 'to', 3)
          assert.propertyVal(e2, 'to', 6)
          assert.propertyVal(e3, 'to', 6)
        })

    })

  })

})
