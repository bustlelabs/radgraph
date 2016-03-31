import Promise from 'bluebird'
import { assert } from 'chai'
import { G, reset, assertError } from './G'

const E = G.SemiOrderedEdge
  ( "A", "Has", "B"
  , { foo: "integer"
    , bar: "string"
    }
  )

// TODO: Revisit these tests, this is just a tiny edit of the Ordered Edge tests to accommodate the reverse chron
// Since this doesn't guarantee contiguous ordering, further tests are needed
describe ('Semi-Ordered Edge', function() {

  before(reset)

  let e1, e2, e3, e4

  describe('.push', function() {
    // 1
    it ('should return the edge', function() {
      return E.push(1, 1, { foo: 1 })
      .then(e => {
        assert.isObject(e)
        assert.equal(e.from, 1)
        assert.equal(e.type, "A:Has:B")
        assert.equal(e.to,   1)
        assert.equal(e.foo,  1)
        assert.isNumber(e.created_at)
        assert.isNumber(e.updated_at)
        e1 = e
      })
    })
    // 1, 2
    it ('should maintain ordering', function() {
      return G.exec
        ( [ E.job.push(1, 2, { foo: 2 })
          , E.job.push(2, 3, { foo: 3 })
          ]
        )
      .then(([e, f]) => {
        assert.isObject(e)
        assert.isObject(f)
        e2 = e
        e3 = f
      })
    })
    it ('should create index entries', function() {
      return E.all()
      .then(es => assert.sameDeepMembers(es, [ e1, e2, e3 ]))
    })
    it ('should create forward adjacency', function() {
      return E.from(1, { properties: 'all' })
      .then(es => {
        assert.deepEqual(es, [ e2, e1 ])
      })
    })
    it ('should create backward adjacency', function() {
      return E.to(1, { properties: [ 'foo' ] })
      .then(es => {
        assert.lengthOf(es, 1)
        assert.deepEqual(es[0], e1)
      })
    })
  })

  describe('.insert', function() {

    // 1, 2, 3
    it ('should take an offset parameter', function() {
      return E.insert(1, 3, 2, { foo: 4 })
      .then(e => {
        assert.isObject(e)
        assert.equal(e.foo, 4)
        e4 = e
      })
    })
    // 2, 3, 1
    it ('should handle shifting/uniqueness', function() {
      return E.insert(1, 1, 3, { foo: 0 })
      .then(e => {
        assert.isObject(e)
        assert.equal(e.foo, 0)
        e1 = e
      })
    })

    it ('should create indices', function() {
      return E.all()
      .then(es => assert.sameDeepMembers(es, [ e1, e2, e3, e4 ]))
    })

    // 2, 3, 1
    it ('should handle forward adjacencies', function() {
      return E.from(1, { properties: 'all' })
      .then(es => assert.deepEqual(es, [ e2, e4, e1 ]))
    })

    it ('should handle backward adjacencies', function() {
      return E.to(3)
      .then(es => assert.sameMembers(es, ['2', '1']))
    })

  })

  describe('.move', function() {

    // 2, 1, 3
    it ('should return the moved edge', function() {
      return E.move(1, 1, 1)
      .then(e  => e1 = e)
      .then(() => E.from(1))
      .then(es => assert.deepEqual(es, [ '2', '1', '3' ]))
    })

    // 1, 3, 2
    it ('should handle downward shifts', function() {
      return E.move(1, 2, 2)
      .then(e  => e2 = e)
      .then(() => E.from(1))
      .then(es => assert.deepEqual(es, [ '1', '3', '2' ]))

    })
    it ('should raise an error if the edge does not exist', function() {
      return assertError(() => E.move(1, 4, 1))
    })
    it ('should update forward adjacency', function() {
      return E.from(1, { properties: 'all' })
      .then(es => assert.deepEqual(es, [ e1, e4, e2 ]))
    })
    it ('should update backwards adjacency', function() {
      return E.to(2, { properties: 'all' })
      .then(es => assert.deepEqual(es, [ e2 ]))
    })
  })

  describe ('.update', function() {
    it ('should return the edge', function() {
      return E.update(1, 2, { bar: "test" })
      .then(e => {
        assert.isObject(e)
        assert.equal(e.from, 1)
        assert.equal(e.to, 2)
        assert.equal(e.bar, "test")
        e2 = e
      })
    })
    it ('should update the index', function() {
      return E.all({ index: 'updated_at', properties: [ 'bar' ], limit: 1})
      .then(es => assert.sameDeepMembers( es, [ e2 ] ))
    })
    it ('should update the backward adjacency', function() {
      return E.of(2, [ 'bar' ])
      .then(e => assert.deepEqual(e, e2))
    })
  })

  describe ('.delete', function() {
    it('should return the edge', function() {
      return E.to(3, { properties: 'all' })
      .then(([ , e ]) => e3 = e)
      .then(() => E.delete(2, 3))
      .then(e => assert.deepEqual(e, e3))
    })
    it ('should remove edges', function() {
      return E.all()
      .then(e => assert.lengthOf(e, 3))
      .then(() => E.get(2, 3))
      .then(assert.isNull)
    })
    it ('should update forward adjacency', function() {
      return E.from(2)
      .then(e => assert.lengthOf(e, 0))
    })
    it ('should update backward adjacency', function() {
      return E.to(3)
      .then(e => assert.lengthOf(e, 1))
    })
  })

  describe ('.deleteFrom', function() {
    it ('should return the deleted ids', function() {
      return E.deleteFrom(1)
      .then(e => assert.sameMembers(e, [ '1', '2', '3' ]))
    })
    it ('should remove edges', function() {
      return E.all()
      .then(e => assert.lengthOf(e, 0))
      .then(() => E.get(1, 2))
      .then(assert.isNull)
    })
    it ('should remove forward adjacency', function() {
      return E.from(1)
      .then(es => assert.lengthOf(es, 0))
    })
    it ('should remove backward adjacency', function() {
      return E.to(3)
      .then(e => assert.lengthOf(e, 0))
    })

  })

  describe ('.deleteTo', function() {

    before(function() {
      return G.exec
        ( [ E.job.push(1, 1)
          , E.job.push(1, 2)
          , E.job.push(1, 3)
          , E.job.push(2, 2)
          ] )
    })

    it ('should return the deleted ids', function() {
      return E.deleteTo(2)
      .then(es => assert.sameMembers(es, [ '1', '2' ]))
    })

    it ('should remove indices', function() {
      return E.all()
      .then(es => assert.lengthOf(es, 2))
    })

    it ('should remove forward adjacency maintaining order', function() {
      return E.from(1)
      .then(es => assert.sameMembers(es, [ '1', '3' ]))
    })

    it ('should remove backward adjacency', function() {
      return E.to(2)
      .then(es => assert.lengthOf(es, 0))
    })

  })

  describe ('.all', function() {
    before(function() {
      return reset()
      .then(() => G.exec(
        [ E.job.push(1, 2)
        , E.job.push(2, 3)
        , E.job.push(1, 3)
        , E.job.push(1, 1)
        ]
      )).then(([e,f,g,h]) => {
        e1 = e
        e2 = f
        e3 = g
        e4 = h
      })
    })
    it ('should work', function() {
      return E.all()
      .then(es => assert.sameDeepMembers(es, [e1, e2, e3, e4]))
    })
    // TODO: this should be the same as all the other ones though
  })

  // NOTE: for semi-ordered groups, we use the offset not the position
  // be careful of off-by-one errors
  describe ('.from', function() {
    it ('should return ids in order', function() {
      return E.from(1)
      .then(es => assert.deepEqual(es, ['1', '3', '2']))
    })
    it ('should take a properties param', function() {
      return E.from(1, { properties: 'all' })
      .then(es => assert.deepEqual(es, [ e4, e3, e1 ]))
    })
    it ('should have a working .at shorthand', function() {
      return G.exec
        ( [ E.job.from(1, { offset: 1, limit: 1, properties: 'all' })
          , E.job.from(1, { offset: 1, limit: 1 })
          , E.job.at(1, 1, 'all')
          , E.job.at(1, 1)
          ]
        )
      .then(([[e], [f], g, h]) => {
        assert.deepEqual(e3, e)
        assert.deepEqual(e, g)
        assert.equal(f, h)
      })

    })
  })

  describe ('.to', function() {
    it ('should return ids', function() {
      return E.to(3)
      .then(es => assert.sameMembers(es, ['1', '2']))
    })
    it ('should take a properties param', function() {
      return E.to(3, { offset: 0, limit: 2, properties: ['foo'] })
      .then(es => assert.sameDeepMembers(es, [ e2, e3 ]))
    })
    it ('should have a working .of shorthand', function() {
      return G.exec
        ( [ E.job.to(3, { offset: 0, limit: 1, properties: ['foo'] })
          , E.job.of(3, ['foo'])
          ]
        )
      .then(([[e], f]) => assert.deepEqual(e, f))

    })
  })

})
