import Promise from 'bluebird'
import { assert } from 'chai'
import { G, reset, assertError } from './G'

const E = G.OneToOne
  ( "A", "Matches", "B"
  , { foo: "string"
    , bar: "boolean"
    }
  )

describe ('OneToOne Edge', function() {

  before(reset)

  let e1, e2, e3

  describe('.set', function() {

    it ('should return the edge', function() {
      return E.set(1, 2)
      .then(e => {
        assert.isObject(e)
        assert.equal(e.from, 1)
        assert.equal(e.type, "A:Matches:B")
        assert.equal(e.to,   2)
        assert.isNumber(e.created_at)
        assert.isNumber(e.updated_at)
        e1 = e
      })
    })

    it ('should maintain the forward one-to-one invariant', function() {
      return E.set(1, 3)
      .then(e => {
        assert.isObject(e)
        assert.equal(e.from, 1)
        assert.equal(e.to,   3)
        e2 = e
      })
      .then(() => G.exec(
        [ E.job.of(1, 'all')
        , E.job.inv(2)
        , E.job.inv(3, 'all')
        ]
      ))
      .then(([ e, f, g ]) => {
        assert.deepEqual(e2, e)
        assert.isNull(f)
        assert.deepEqual(e2, g)
      })
    })

    it ('should maintain the backward one-to-one invariant', function() {
      return E.set(2, 3, { foo: "foo" })
      .then(e => {
        assert.isObject(e)
        assert.equal(e.from, 2)
        assert.equal(e.to,   3)
        assert.equal(e.foo, "foo")
        e3 = e
      })
      .then(() => G.exec(
        [ E.job.of (1, 'all')
        , E.job.of (2)
        , E.job.inv(3, 'all')
        ]
      ))
      .then(([ e, f, g ]) => {
        assert.isNull(e)
        assert.equal('3', f)
        assert.deepEqual(e3, g)
      })
    })

    it ('should update an existing relationship', function() {
      return E.set(2, 3, { foo: "prime", bar: true })
      .then(e => {
        assert.isObject(e)
        assert.equal(e.foo, "prime")
        assert.equal(e.bar, true)
        assert(e.updated_at >= e.created_at, "updated_at should be greater than created_at")
        e3 = e
      }).then(() => G.exec(
        [ E.job.of (2, 'all')
        , E.job.inv(3, [ 'foo', 'bar' ])
        ]
      )).then(([ e, f ]) => {
        assert.deepEqual(e3, e)
        assert.deepEqual(e3, f)
      })

    })

    it ('should create indices', function() {
      return E.all()
      .then(es => assert.sameDeepMembers(es, [ e3 ]))
    })

    it ('should create a forward adjacency', function() {
      return E.of(2)
      .then(e => assert.equal(e, '3'))
    })

    it ('should create a backward adjacency', function() {
      return E.inv(3, 'all')
      .then(e => assert.deepEqual(e, e3))
    })

  })

  describe('.delete', function() {
    it ('should return the deleted edge', function() {
      return E.delete(2)
      .then(e => {
        assert.deepEqual(e3, e)
      })
    })
    it ('should raise an error for deleting an invalid edge', function() {
      return assertError(() => E.delete(3))
    })
    it ('should delete index', function() {
      return E.all()
      .then(es => assert.lengthOf(es, 0))
    })
    it ('should delete forward adjacency', function() {
      return E.of(2, 'all')
      .then(e => assert.isNull(e))
    })
    it ('should delete backward adjacency', function() {
      return E.inv(3)
      .then(assert.isNull)
    })
  })

  describe('.deleteInv', function() {
    before(function() {
      return E.set(1, 2, { foo: 'test' })
      .then(e  => e1 = e)
      .then(() => E.all())
      .then(es => assert.sameDeepMembers(es, [ e1 ]))
    })
    it ('should return the deleted edge', function() {
      return E.deleteInv(2)
      .then(e => assert.deepEqual(e1, e))
    })
    it ('should raise an error deleting an invalid edge', function() {
      return assertError(() => E.deleteInv(3))
    })
    it ('should delete index', function() {
      return E.all()
      .then(es => assert.lengthOf(es, 0))
    })
    it ('should delete forward adjacency', function() {
      return E.of(1, 'all')
      .then(e => assert.isNull(e))
    })
    it ('should delete backward adjacency', function() {
      return E.inv(2)
      .then(e => assert.isNull(e))
    })
  })

  describe ('.all', function() {
    before (function() {
      return G.exec
        ( [ E.job.set(1, 2)
          , E.job.set(2, 3)
          , E.job.set(3, 1)
          ]
        )
      .then(([e, f, g]) => {
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
      return E.set(2, 3, { foo: 'test' })
      .then(e => e2 = e)
      .then(() => G.exec( [ E.job.all(), E.job.all({ index: 'updated_at' }) ] ))
      .then(([ es1, es2 ]) => {
        assert.notDeepEqual(es1, es2)
        assert.sameDeepMembers(es1, es2)
        assert.deepEqual(es2[0], e2)
      })
    })
    it ('should take a limit param', function() {
      return E.all({ index: 'updated_at', limit: 1 })
      .then(es => assert.sameDeepMembers(es, [ e2 ]))
    })
    it ('should take an offset param', function() {
      return E.all({ index: 'updated_at', offset: 1 })
      .then(es => assert.sameDeepMembers(es, [ e1, e3 ]))
    })
    it ('should take a properties param', function() {
      return E.all({ index: 'updated_at', limit: 1, properties: ['bar'] })
      .then(es => {
        assert.lengthOf(es, 1)
        assert.notDeepEqual(es[0], e2)
        assert.isUndefined(es[0].foo)
      })
    })
  })

  describe('.of', function() {
    it ('should get id', function() {
      return G.exec( [ E.job.of(1), E.job.of(2), E.job.of(3) ] )
      .then(es => assert.deepEqual(es, [ '2', '3', '1' ]))
    })
    it ('should take a properties param', function() {
      return G.exec
        ( [ E.job.of(1, []      )
          , E.job.of(2, ['foo'] )
          , E.job.of(3,  'all'  )
          ]
        )
      .then(es => assert.deepEqual(es, [ e1, e2, e3 ]))
    })
  })

  describe('.inv', function() {
    it ('should get id', function() {
      return G.exec( [ E.job.inv(1), E.job.inv(2), E.job.inv(3) ] )
      .then(es => assert.deepEqual(es, [ '3', '1', '2' ]))
    })
    it ('should take a properties param', function() {
      return G.exec
        ( [ E.job.inv(1, []      )
          , E.job.inv(2, ['foo'] )
          , E.job.inv(3,  'all'  )
          ]
        )
      .then(es => assert.deepEqual(es, [ e3, e1, e2 ]))
    })
  })

})
