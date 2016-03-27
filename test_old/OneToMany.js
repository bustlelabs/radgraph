import Promise from 'bluebird'
import { assert } from 'chai'
import { G, reset, assertError } from './G'

const EPSILON = 0.000001

const E = G.OneToMany
  ( "A", "Made", "B"
  , { foo: "number"
    , bar: "json"
    }
  )

describe ('OneToMany Edge', function() {

  before(reset)

  let e1, e2, e3

  // TODO: rewrite these mutation tests to be independent

  describe('.create', function() {

    it ('should return edge', function() {
      return E.create(1, 2, { foo: 1.5 })
      .then(e => {
        assert.isObject(e)
        assert.equal(e.from, 1)
        assert.equal(e.type, "A:Made:B")
        assert.equal(e.to,   2)
        assert.equal(e.foo,  1.5)
        assert.isNumber(e.created_at)
        assert.isNumber(e.updated_at)
        e2 = e
      })
    })

    it ('should maintain the one-to-many invariant', function() {
      return E.create(3, 2, { bar: [ 'test' ] })
      .then(e => e2 = e)
      .then(() => E.of(2, 'all'))
      .then(e => {
        assert.isObject(e)
        assert.equal(e.from, 3)
        assert.equal(e.type, "A:Made:B")
        assert.equal(e.to,   2)
        assert.isArray(e.bar)
        assert.equal(e.bar[0], 'test')
        assert.isUndefined(e.foo)
      })

    })

    it ('should serialize data attributes', function() {
      return E.create(3, 3, { bar: "test", foo: 0.1 })
      .then(e => {
        assert.isObject(e)
        assert.strictEqual(e.bar, "test")
        assert.approximately(e.foo, 0.1, EPSILON)
        e3 = e
      })
    })

    it ('should create index entries', function() {
      return E.all()
      .then(es => {
        assert.lengthOf(es, 2)
        assert.deepEqual(es[0], e3)
        assert.deepEqual(es[1], e2)
      })
    })

    it ('should create forward adjacency', function() {
      return E.from(3, { properties: 'all' })
      .then(es => {
        assert.lengthOf(es, 2)
        assert.deepEqual(es[0], e3)
        assert.deepEqual(es[1], e2)
      })
    })

    it ('should create backward adjacency', function() {
      return E.of(3, ['bar', 'foo'])
      .then(e => {
        assert.deepEqual(e, e3)
      })
    })

  })

  describe('.update', function() {
    it ('should return edge', function() {
      return E.update(2, { bar: "test" })
      .then(e => {
        assert.isObject(e)
        assert.equal(e.from, 3)
        assert.equal(e.type, "A:Made:B")
        assert.equal(e.to,   2)
        assert.equal(e.bar,  "test")
        assert.isNumber(e.created_at)
        assert.isNumber(e.updated_at)
        assert(e.updated_at >= e.created_at, "updated_at field is greater than created_at")
        e2 = e
      })
    })
    it ('should raise an error for nonexistent edges', function() {
      return assertError(() => E.update(1))
    })
    it ('should not allow a "from" attribute', function() {
      return E.update(2, { foo: 0.5, from: 1 })
      .then(e => {
        assert.isObject(e)
        assert.equal(e.from, 3)
        assert.equal(e.type, "A:Made:B")
        assert.equal(e.to,   2)
        assert.equal(e.foo,  0.5)
      })
      .then(() => E.of(2, ['foo', 'bar']))
      .then(e => {
        assert.equal(e.from, 3)
        assert.equal(e.foo, 0.5)
        assert.equal(e.bar, "test")
        e2 = e
      })
    })
    it ('should update indices', function() {
      return E.all({ index: 'updated_at' })
      .then(es => {
        assert.lengthOf(es, 2)
        assert.deepEqual(es[0], e2)
        assert.deepEqual(es[1], e3)
      })

    })
    it ('should update forward adjacency', function() {
      return E.from(3, { properties: 'all' })
      .then(es => {
        assert.lengthOf(es, 2)
        assert.deepEqual(es[0], e2)
        assert.deepEqual(es[1], e3)
      })
    })
    it ('should update backward adjacency', function() {
      return E.of(2, 'all')
      .then(e => {
        assert.deepEqual(e, e2)
      })
    })
  })

  describe('.delete', function() {
    it ('should return deleted edge', function() {
      return E.delete(2)
      .then(e => {
        assert.deepEqual(e, e2)
      })
    })
    it ('should raise an error for nonexistent edges', function() {
      return assertError(() => E.delete(1))
    })
    it ('should remove edge', function() {
      return E.all()
      .then(es => {
        assert.lengthOf(es, 1)
        assert.deepEqual(es[0], e3)
      })
    })
    it ('should remove forward adjacency', function() {
      return E.from(3, { properties: 'all' })
      .then(es => {
        assert.lengthOf(es, 1)
        assert.deepEqual(es[0], e3)
      })
    })
    it ('should remove backward adjacency', function() {
      return E.of(2)
      .then(e => {
        assert.isNull(e)
      })
    })
  })

  describe('.deleteFrom', function() {
    before(function() {
      return Promise.all
        ( [ E.create(1, 1)
          , E.create(1, 2)
          ]
        ).then(([e, f]) => {
          e1 = e
          e2 = f
        })
    })
    it ('should return deleted ids', function() {
      return E.deleteFrom(1)
      .then(ids => {
        assert.lengthOf(ids, 2)
        assert.sameMembers(ids, [ '1', '2' ])
      })
    })
    it ('should handle the empty case', function() {
      return E.deleteFrom(4)
      .then(ids => {
        assert.lengthOf(ids, 0)
      })
    })
    it ('should remove edges', function() {
      return E.all()
      .then(es => {
        assert.lengthOf(es, 1)
        assert.deepEqual(es[0], e3)
      })
    })
    it ('should remove forward adjacencies', function() {
      return E.from(1)
      .then(es => {
        assert.lengthOf(es, 0)
      })
    })
    it ('should remove backward adjacencies', function() {
      return Promise.all( [ E.of(1), E.of(2), E.of(3) ])
      .then(([ e, f, g ]) => {
        assert.isNull(e)
        assert.isNull(f)
        assert.equal(g, 3)
      })
    })
  })

  describe('.all', function() {
    before(function() {
      return reset()
      .then( () => Promise.all
        ( [ E.create(3, 1, { foo: 1 })
          , E.create(1, 2)
          , E.create(1, 3)
          ]
        ) )
      .then(([e,f,g]) => {
        e1 = e
        e2 = f
        e3 = g
      })
    })
    it ('should return all edges', function() {
      return E.all()
      .then(es => assert.sameDeepMembers(es, [ e1, e2, e3 ]))
    })
    it ('should take an index param', function() {
      return E.update(2, { foo: 1.5 })
      .then(e => e2 = e)
      .then(() => E.all({ index: 'updated_at' }))
      .then(es => {
        assert.deepEqual(es[0], e2)
        assert.sameDeepMembers(es, [ e1, e2, e3 ])
      })
    })
    it ('should take a limit param', function() {
      return E.all({ index: 'updated_at', limit: 1 })
      .then(es => assert.sameDeepMembers(es, [ e2 ]))
    })
    it ('should take a offset param', function() {
      return E.all({ index: 'updated_at', offset: 1 })
      .then(es => assert.sameDeepMembers(es, [ e1, e3 ]))
    })
    it ('should take a properties param', function() {
      return E.all({ properties: ['bar'] })
      .then(es => {
        assert.lengthOf(es, 3)
        assert.isUndefined(es[0].foo)
        assert.isUndefined(es[1].foo)
        assert.isUndefined(es[2].foo)
      })
    })

  })

  describe('.from', function() {
    it ('should get ids', function() {
      return E.from(1)
      .then(es => assert.sameMembers(es, [ '2', '3' ]))
    })
    it ('should take a properties param', function() {
      return E.from(1, { properties: 'foo' })
      .then(es => {
        assert.lengthOf(es, 2)
        assert.sameDeepMembers(es, [ e2, e3 ])
      })
    })
  })

  describe('.of', function() {
    it ('should get id', function() {
       return E.of(2)
       .then(id => assert.equal(id, 1))
    })
    it ('should take a properties param', function() {
      return E.of(2, 'all')
      .then(e => assert.deepEqual(e, e2))
    })
  })

})
