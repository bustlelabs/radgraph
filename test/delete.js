import Promise    from 'bluebird'
import _          from 'lodash'
import { assert } from 'chai'

import { resetGraph
       , serial
       , Authored
       , Rated
       , Clipped
       } from './graph'

describe ('Radgraph', function() {

  before(function(done) {
    return resetGraph()
      .then(() => Promise.all
        ( [ Authored.deleteAll(1)
          , Authored.inv.deleteAll(8)
          , Authored.delete(3, 6)
          , Rated.delete(1, 2)
          , Clipped.inv.delete(8, 3)
          ] ))
      .then(() => done())
  })

  describe('.delete', function() {

    it ('should delete top edge', function() {
      return Rated.from(1)
        .then(r => {
          assert.lengthOf(r, 2)
          const [e1, e2] = r
          assert.propertyVal(e1, 'to', 4)
          assert.propertyVal(e2, 'to', 2)
          assert.notDeepProperty(e2, 'rating')
          assert.notDeepProperty(e2, 'note')
        })
    })

    it ('should delete inverse edge', function() {
      return Authored.inv.from(6)
        .then(r => {
          assert.lengthOf(r, 0)
        })
    })

    it ('should delete from inverse', function() {
      return Clipped.from(3)
        .then(r => {
          assert.lengthOf(r, 2)
          assert.deepPropertyVal(r, '0.to', 9)
          assert.deepPropertyVal(r, '1.to', 7)
        })
    })

    it ('should delete by time', function() {
      return Clipped.find(2, 1)
        .then(r => r[1].time)
        .then(time => Clipped.delete(2, 1, { time }))
        .then(() => Clipped.inv.of(1))
        .then(r => {
          assert.deepPropertyVal(r, 'data.title', 'bar')
        })
    })

    it ('should handle null cases', function() {
      return Promise.all
        ( [ Rated.delete(3, 8)
          , Rated.delete(3, 6, { time: 1 })
          ] )
        .then(() => Rated.from(3))
        .then(r => {
          assert.lengthOf(r, 2)
          const [e1, e2] = r
          assert.deepPropertyVal(e1, 'data.rating', 1)
          assert.deepPropertyVal(e1, 'data.note', 'fooooo')
          assert.isUndefined(e2.data.rating)
          assert.isUndefined(e2.data.note)
        })
    })

  })

  describe('.deleteAll', function() {

    it ('should delete all edges', function() {
      return Promise.all
        ( [ Authored.from(1)
          , Authored.inv.of(2)
          , Authored.find(1, 2)
          , Authored.get(1, 5)
          ] )
        .then(([r1, r2, r3, r4]) => {
          assert.lengthOf(r1, 0)
          assert.isUndefined(r2)
          assert.lengthOf(r3, 0)
          assert.isUndefined(r4)
        })
    })

    it ('should delete all inverse edges', function() {
      return Promise.all
        ( [ Authored.inv.from(8)
          , Authored.of(3)
          , Authored.find(3, 8)
          , Authored.inv.get(8, 3)
          ] )
        .then(([r1, r2, r3, r4]) => {
          assert.lengthOf(r1, 0)
          assert.isUndefined(r2)
          assert.lengthOf(r3, 0)
          assert.isUndefined(r4)
        })
    })


  })


})
