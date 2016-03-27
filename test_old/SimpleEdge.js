import Promise from 'bluebird'
import { assert } from 'chai'
import { G
       , reset
       , assertError
       } from './G'

const E = G.Edge
  ( "A", "IsA", "B"
  , { foo: "boolean"
    , bar: "json"
    }
  )

// TODO: change these tests so that they're independent
// right now test state is threaded through the testing suite

describe ('SimpleEdge', function() {

  before(reset)

  let e1, e2, e3

  describe('.create', function() {

    it ('should return edge', function() {
      return E.create(1, 2)
      .then(e => {
        assert.isObject(e)
        assert.equal(e.from, 1)
        assert.equal(e.type, "A:IsA:B")
        assert.equal(e.to, 2)
        assert.isNumber(e.created_at)
        assert.isNumber(e.updated_at)
        e1 = e
      })
    })
    it ('should maintain edge uniqueness', function() {
      return E.create(1, 2)
      .then(e  => e1 = e)
      .then(() => E.from(1))
      .then(es => assert.lengthOf(es, 1))
    })
    it ('should serialize data attributes', function() {
      return E.create(1, "test", { foo: true, bar: "this is a test" })
      .then(e => {
        assert.isObject(e)
        assert.equal(e.from, 1)
        assert.equal(e.type, "A:IsA:B")
        assert.equal(e.to, "test")
        assert.isNumber(e.created_at)
        assert.isNumber(e.updated_at)
        assert.strictEqual(e.foo, true)
        assert.strictEqual(e.bar, "this is a test")
        e2 = e
      })
    })
    it ('should create index entries', function() {
      return E.all()
      .then(es => {
        assert.lengthOf(es, 2)
        assert.deepEqual(es[0], e2)
        assert.deepEqual(es[1], e1)
      })

    })
    it ('should create forward adjacency', function() {
      return E.from(1, { properties: 'all' })
      .then(es => {
        assert.lengthOf(es, 2)
        assert.deepEqual(es[0], e2)
        assert.deepEqual(es[1], e1)
      })
    })
    it ('should create backward adjacency', function() {
      return E.to("test", { properties: 'all' })
      .then(es => {
        assert.lengthOf(es, 1)
        assert.deepEqual(es[0], e2)
      })
    })

  })

  describe('.update', function() {
    it ('should return edge', function() {
      return E.update(1, 2, { bar: 5 })
      .then(e => {
        assert.isObject(e)
        assert.equal(e.from, 1)
        assert.equal(e.type, "A:IsA:B")
        assert.equal(e.to, 2)
        assert.equal(e.bar, 5)
        assert.isNumber(e.created_at)
        assert.isNumber(e.updated_at)
        assert(e.updated_at >= e.created_at, "updated_at field is greater than created_at")
        e1 = e
      })
    })
    it ('should raise an error for nonexistent edges', function() {
      return assertError(() => E.update(1, 3))
    })
    it ('should update index entries', function() {
      return Promise.all([ E.all(), E.all({ index: 'updated_at' }) ])
      .then(([ es1, es2 ]) => {
        assert.lengthOf(es1, 2)
        assert.lengthOf(es2, 2)
        assert.deepEqual(es1[1], es2[0])
        assert.deepEqual(es1[0], es2[1])
        assert.deepEqual(es2[0], e1)
        assert.deepEqual(es2[1], e2)
      })
    })
    it ('should update forward adjacency', function() {
      return E.from(1, { properties: [ 'bar' ] })
      .then(es => {
        assert.lengthOf(es, 2)
        assert.deepEqual(es[0], e1)
        assert.notDeepEqual(es[1], e1)
      })
    })
    it ('should update backward adjacency', function() {
      return E.to(2, { properties: 'all' })
      .then(es => {
        assert.lengthOf(es, 1)
        assert.deepEqual(es[0], e1)
      })
    })
  })

  describe('.delete', function() {
    it ('should return deleted edge', function() {
      return E.delete(1, "test")
      .then(e => {
        assert.deepEqual(e, e2)
      })
    })
    it ('should raise an error for nonexistent edges', function() {
      return assertError(() => E.delete(1, "foo"))
    })
    it ('should remove edge', function() {
      return E.all()
      .then(es => {
        assert.lengthOf(es, 1)
        assert.deepEqual(es[0], e1)
      })
    })
    it ('should remove forward adjacency', function() {
      return E.from(1, { properties: 'all' })
      .then(es => {
        assert.lengthOf(es, 1)
        assert.deepEqual(es[0], e1)
      })
    })
    it ('should remove backward adjacency', function() {
      return E.to("test")
      .then(es => {
        assert.lengthOf(es, 0)
      })
    })
  })

  describe('.deleteFrom', function() {

    before(function() {
      return Promise.all
        ( [ E.create(1, 3)
          , E.create(1, 4)
          , E.create(2, 3)
          ]
        ).then(([,,e]) => e3 = e)
        .then(() => Promise.all([ E.from(1), E.to(3) ]))
        .then(([ es1, es2 ]) => {
          assert.lengthOf(es1, 3)
          assert.lengthOf(es2, 2)
        })
    })

    it ('should return deleted ids', function() {
      return E.deleteFrom(1)
      .then(ids => {
        assert.lengthOf(ids, 3)
        assert.sameMembers(ids, ['2', '3', '4'])
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
        assert.deepEqual(es[0]. e3)
      })
    })
    it ('should remove forward adjacencies', function() {
      return E.from(1)
      .then(es => {
        assert.lengthOf(es, 0)
      })
    })
    it ('should remove backward adjacencies', function() {
      return E.to(3, { properties: [] })
      .then(es => {
        assert.lengthOf(es, 1)
        assert.deepEqual(es[0], e3)
      })
    })
  })

  describe('.deleteTo', function() {

    before(function() {
      return Promise.all
        ( [ E.create(1, 2)
          , E.create(1, "test")
          , E.create("test", 2)
          ]
        ).then(([,e,]) => e2 = e)
        .then(() => Promise.all([ E.from(1), E.to(2) ]))
        .then(([ es1, es2 ]) => {
          assert.lengthOf(es1, 2)
          assert.lengthOf(es2, 2)
        })
    })

    it ('should return deleted ids', function() {
      return E.deleteTo(2)
      .then(es => {
        assert.sameMembers(es, [ '1', 'test' ])
      })
    })
    it ('should remove edges', function() {
      return E.all()
      .then(es => {
        assert.lengthOf(es, 2)
        assert.deepEqual(es[0], e2)
        assert.deepEqual(es[1], e3)
      })
    })
    it ('should remove forward adjacencies', function() {
      return E.from(1, { properties: [] })
      .then(es => {
        assert.lengthOf(es, 1)
        assert.deepEqual(es[0], e2)
      })
    })
    it ('should remove backward adjacencies', function() {
      return E.to(2)
      .then(es => {
        assert.lengthOf(es, 0)
      })
    })
  })

  describe('.all', function() {

    before(function() {
      return reset()
      .then( () => Promise.all
        ( [ E.create(1, 2)
          , E.create(1, "test", { foo: false })
          , E.create(2, 3, { bar: [ 'test' ] })
          ]
        )
      )
      .then(([e,f,g]) => {
        e1 = e
        e2 = f
        e3 = g
      })
    })

    it ('should return all edges', function() {
      return E.all()
      .then(es => {
        assert.lengthOf(es, 3)
        assert.sameDeepMembers(es, [ e1, e2, e3 ])
      })
    })
    it ('should take an index param', function() {
      return E.update(1, "test", { foo: true })
      .then(e => e2 = e)
      .then(() => E.all({ index: 'updated_at' }))
      .then(es => {
        assert.lengthOf(es, 3)
        assert.deepEqual(es[0], e2)
        assert.sameDeepMembers(es, [ e1, e2, e3 ])
      })
    })
    it ('should take a limit param', function() {
      return E.all({ index: 'updated_at', limit: 1 })
      .then(es => {
        assert.lengthOf(es, 1)
        assert.deepEqual(es[0], e2)
      })
    })
    it ('should take an offset param', function() {
      return E.all({ index: 'updated_at', offset: 1 })
      .then(es => {
        assert.lengthOf(es, 2)
        assert.sameDeepMembers(es, [ e1, e3 ])
      })
    })
    it ('should take a properties param', function() {
      return E.all({ properties: [ 'foo' ] })
      .then(es => {
        assert.lengthOf(es, 3)
        assert.isUndefined(es[0].bar)
        assert.isUndefined(es[1].bar)
        assert.isUndefined(es[2].bar)
      })
    })
  })

  describe('.from', function() {
    it ('should get ids', function() {
      return E.from(1)
      .then(es => {
        assert.lengthOf(es, 2)
        assert.sameMembers(es, [ '2', 'test' ])
      })
    })

    it ('should take a properties param', function() {
      return E.from(1, { properties: 'foo'})
      .then(es => {
        assert.lengthOf(es, 2)
        assert.isObject(es[0])
        assert.isObject(es[1])
        assert.notDeepEqual(es[0], es[1])
        assert.equal(es[0].from, 1)
        assert.equal(es[0].type, "A:IsA:B")
        assert.oneOf(es[0].to, [ '2', 'test' ])
        assert.isNumber(es[0].created_at)
        assert.isNumber(es[0].updated_at)
        assert.includeDeepMembers(es, [ e2 ])
      })
    })
  })

  describe('.to', function() {
    it ('should get ids', function() {
      return E.to(3)
      .then(es => {
        assert.lengthOf(es, 1)
        assert.equal(es[0], '2')
      })

    })

    it ('should take a properties param', function() {
      return E.to(3, { properties: [ 'bar' ] })
      .then(es => {
        assert.lengthOf(es, 1)
        assert.deepEqual(es[0], e3)
      })
    })

  })

})
