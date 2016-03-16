import Promise from 'bluebird'
import { assert } from 'chai'
import { G, reset, assertError } from './G'

const E = G.ArrayEdge
  ( "A", "Places", "B"
  , { foo: "integer"
    , bar: "string"
    }
  )

describe ('Array Edge', function() {

  before(reset)

  let e1, e2, e3, e4

  describe('.set', function() {

    it ('should return the set edge', function() {
      return E.set(1, 3, 3, { foo: 4 })
      .then(e => {
        assert.isObject(e)
        assert.equal(e.from  , 1)
        assert.equal(e.type  , "A:Places:B")
        assert.equal(e.to    , 3)
        assert.equal(e.index , 3)
        assert.equal(e.foo   , 4)
        assert.isNumber(e.created_at)
        assert.isNumber(e.updated_at)
        e1 = e
      })
    })

    it ('should allow duplicate adjacencies', function() {
      return E.set(1, 1, 3)
      .then(e => {
        assert.isObject(e)
        assert.equal(e.from  , 1)
        assert.equal(e.type  , "A:Places:B")
        assert.equal(e.to    , 3)
        assert.equal(e.index , 1)
        assert.isUndefined(e.foo)
        assert.isNumber(e.created_at)
        assert.isNumber(e.updated_at)
        e2 = e
      })
      .then(() => E.all())
      .then(es => assert.deepEqual(es, [e2, e1]))
      .then(() => E.to(3))
      .then(es => assert.deepEqual(es, [ [ '1', 1 ], [ '1', 3 ] ]))

    })

    it ('should overwrite positions', function() {
      return E.set(1, 1, 2)
      .then(e => {
        assert.isObject(e)
        assert.equal(e.from, 1)
        assert.equal(e.to,   2)
        e2 = e
      })
      .then(() => E.all())
      .then(es => assert.deepEqual(es, [e2, e1]))
    })

    it ('should update existing edges', function() {
      return E.set(1, 3, 3, { foo: 3 })
      .then(e => {
        assert.isObject(e)
        assert.equal(e.from, 1)
        assert.equal(e.to,   3)
        assert(e.updated_at >= e.created_at, "updated_at should be greater than created_at")
        e1 = e
      })
      .then(() => E.all({ index: 'updated_at' }))
      .then(es => assert.deepEqual(es, [ e1, e2 ]))
    })

    it ('should create index entries', function() {
      return E.all()
      .then(es => assert.deepEqual(es, [ e2, e1 ]))
    })

    it ('should create forward adjacency', function() {
      return E.from(1, 0, 5, 'all')
      .then(es => assert.deepEqual(es, [ null, e2, null, e1, null, null ]))
    })

    it ('should create backward adjacency', function() {
      return E.to(3, { properties: 'all' })
      .then(es => assert.deepEqual(es, [ e1 ]))
    })

  })

  describe('.swap', function() {
    before(function() {
      return G.exec
        ( [ E.job.set(1, 2, 1, { foo: 1 })
          , E.job.set(1, 4, 3, { bar: 'test' })
          ]
        )
      .then(([ e, f ]) => {
        e3 = e
        e4 = f
      })
    })
    it ('should return swapped edges', function() {
      return E.swap(1, 2, 4)
      .then(([ e, f ]) => {
        e4.index = 2
        e3.index = 4
        assert.deepEqual(e4, e)
        assert.deepEqual(e3, f)
      })
      .then(() => E.from(1, 1, 4, 'all'))
      .then(es => assert.deepEqual(es, [ e2, e4, e1, e3 ]))
    })

    it ('should handle swap with an empty position', function() {
      return E.swap(1, 0, 1)
      .then(([ e, f ]) => {
        e2.index = 0
        assert.deepEqual(e2, e)
        assert.isNull(f)
      })
      .then(() => E.from(1, 0, 4, ['foo', 'bar']))
      .then(es => assert.deepEqual(es [ e2, null, e4, e1, e3 ]))
    })

    it ('should handle a null swap', function() {
      return E.swap(1, 1, 5)
      .then(es => assert.deepEqual(es, [ null, null ]))
    })

    it ('should not affect indices', function() {
      return E.all({ index: 'updated_at' })
      .then(es => assert.deepEqual(es, [ e3, e4, e1, e2 ]))
    })

    it ('should update forward adjacency', function() {
      return E.from(1, 0, 5, ['foo', 'bar'])
      .then(es => assert.deepEqual(es, [ e2, null, e4, e1, e3, null ]))
    })

    it ('should update backwards adjacences', function() {
      return G.exec
        ( [ E.job.to(1, { properties: 'all' })
          , E.job.to(2, { properties: 'all' })
          , E.job.to(3, { properties: 'all' })
          ]
        )
      .then(([ es1, es2, es3 ]) => {
        assert.sameDeepMembers(es1, [ e3 ])
        assert.sameDeepMembers(es2, [ e2 ])
        assert.sameDeepMembers(es3, [ e1, e4 ])
      })
    })

  })

  describe('.delete', function() {
    it ('should return the deleted edge', function() {
      return E.delete(1, 2)
      .then(e => assert.deepEqual(e4, e))
    })
    it ('should remove index entry', function() {
      return E.all()
      .then(es => assert.sameDeepMembers(es, [e1, e2, e3]))
    })
    it ('should remove forward adjacency', function() {
      return E.from(1, 0, 4)
      .then(es => assert.deepEqual(es, [ '2', null, null, '3', '1' ]))
      .then(() => E.from(1, 0, 4, 'all'))
      .then(es => assert.deepEqual(es, [ e2, null, null, e1, e3 ]))
    })
    it ('should remove backward adjacency', function() {
      return E.to(3)
      .then(es => assert.deepEqual(es, [ [ '1', 3 ] ]))
    })
  })

  describe('.deleteFrom', function() {
    before(function() {
      return E.set(2, 1, 3)
      .then(e => e4 = e)
    })

    it ('should return deleted ids and positions', function() {
      return E.deleteFrom(1)
      .then(es => assert.deepEqual(es, { '0': '2', '3': '3', '4': '1' }))
    })
    it ('should remove indices', function() {
      return E.all()
      .then(es => assert.deepEqual(es, [ e4 ]))
    })
    it ('should remove forward adjacencies', function() {
      return E.from(1, 0, 5)
      .then(es => assert.deepEqual(es, [ null, null, null, null, null, null ]))
    })
    it ('should remove backward adjacencies', function() {
      return G.exec
        ( [ E.job.to(1)
          , E.job.to(2)
          , E.job.to(3, { properties: 'all' })
          ]
        )
      .then(([ es1, es2, es3 ]) => {
        assert.deepEqual(es1, [])
        assert.deepEqual(es2, [])
        assert.deepEqual(es3, [ e4 ])
      })
    })
  })

  describe('.deleteTo', function() {
    before(function() {
      return G.exec
        ( [ E.job.set(2, 1, 3)
          , E.job.set(3, 1, 3)
          , E.job.set(1, 2, 3)
          , E.job.set(2, 2, 2)
          ]
        )
      .then(([e, f, g, h]) => {
        e1 = e
        e2 = f
        e3 = g
        e4 = h
      })
    })
    it ('should return deleted ids and positions', function() {
      return E.deleteTo(3)
      .then(es => assert.sameDeepMembers(es, [ ['3', 1], ['1', 2], ['2', 1] ]))
    })
    it ('should update indices', function() {
      return E.all()
      .then(es => assert.sameDeepMembers(es, [ e4 ]))
    })
    it ('should update forward adjacencies', function() {
      return E.from(2, 1, 2)
      .then(es => assert.deepEqual(es, [ null, '2' ]))
    })
    it ('should update backward adjacencies', function() {
      return G.exec
        ( [ E.job.to(2, { properties: 'all' })
          , E.job.to(3)
          ]
        )
      .then(([ es1, es2 ]) => {
        assert.deepEqual(es1, [ e4 ])
        assert.deepEqual(es2, [])
      })

    })

  })

  describe('.all', function() {
    before(function() {
      return reset()
      .then(() => G.exec(
        [ E.job.set(1, 1, 2)
        , E.job.set(1, 2, 3)
        , E.job.set(1, 4, 1)
        , E.job.set(2, 1, 2)
        ]
      )).then(([ e, f, g, h ]) => {
        e1 = e
        e2 = f
        e3 = g
        e4 = h
      })
    })
    it ('should work', function() {
      return E.all()
      .then(es => assert.sameDeepMembers(es, [ e1, e2, e3, e4 ]))
    })
    // TODO: this should be the same as all the other ones though
  })

  describe('.from', function() {
    it ('should return ids in order, allowing nulls', function() {
      return E.from(1, 1, 4)
      .then(es => assert.deepEqual(es, [ '2', '3', null, '1' ]))
    })
    it ('should allow subranges', function() {
      return E.from(1, 1, 3)
      .then(es => assert.deepEqual(es, [ '2', '3', null ]))
    })
    it ('should take a properties param', function() {
      return E.from(1, 1, 4, { properties: 'all' })
      .then(es => assert.deepEqual(es, [ e1, e2, null, e3 ]))
    })
    it ('should have a working .at shorthand', function() {
      return G.exec
        ( [ E.job.from(1, 2, 2)
          , E.job.from(1, 2, 2, 'all')
          , E.job.at(1, 2)
          , E.job.at(1, 2, 'all')
          ]
        )
      .then(([[e], [f], g, h]) => {
        assert.deepEqual(e, g)
        assert.deepEqual(e2, f)
        assert.deepEqual(f, h)
      })
    })
  })

  describe('.to', function() {
    it ('should return ids/position pairs', function() {
      return E.to(2)
      .then(es => assert.sameDeepMembers(es, [ [ '1', 1 ], [ '2', 1 ] ]))
    })
    it ('should take a properties param', function() {
      return E.to(2, { properties: 'all' })
      .then(es => assert.sameDeepMembers(es, [e1, e4]))
    })
    it ('should handle multi graphs', function() {
      let e5
      return E.set(1, 4, 2, { foo: 5 })
      .then(e  => e5 = e)
      .then(() => E.to(2, { properties: ['foo'] }))
      .then(es => assert.sameDeepMembers(es, [ e1, e4, e5 ]))
    })
  })



})
