import Promise from 'bluebird'
import { assert } from 'chai'
import { G, reset, assertError } from './G'

const N1 = G.Vertex
  ( "N1"
  , { foo: "integer"
    , bar: "boolean"
    }
  )

const N2 = G.Vertex
  ( "N2"
  , { foo: "number"
    , bar: "json"
    }
  )

// TODO: write these tests
// this is a little less urgent because this is really just a step sideways from radredis

describe ('SimpleVertex', function() {

  before(reset)

  let v1, v2, v3

  describe('.create', function() {

    it ('should create vertices', function() {
      return N1.create({ foo: 5, bar: true })
      .then(v => {
        assert.isObject(v)
        assert.equal(v.id, 1)
        assert.equal(v.foo, 5)
        assert.equal(v.bar, true)
        assert.isNumber(v.created_at)
        assert.isNumber(v.updated_at)
        v1 = v
      })
    })

    it ('should persist vertices', function() {
      return N1.get(v1.id)
      .then(v => assert.deepEqual(v, v1))
    })

    it ('should serialize attributes', function() {
      return N2.create({ foo: 1.2, bar: [ 'array', { of: 'objects' } ] })
      .then(v => {
        assert.isObject(v)
        assert.equal(v.foo, 1.2)
        assert.deepEqual(v.bar, [ 'array', { of: 'objects' } ])
        v2 = v
      })
    })

    it ('should update indices', function() {
      return G.exec
        ( [ G.job.N1.all()
          , G.job.N2.all()
          ]
        )
      .then(([ vs1, vs2 ]) => {
        assert.deepEqual(vs1, [ v1 ])
        assert.deepEqual(vs2, [ v2 ])
      })
    })

  })

  describe('.update', function() {

    before(function() {
      return N1.create({ foo: 6, bar: false })
      .then(v => v3 = v)
      .then(() => Promise.delay(1))
    })

    it ('should update vertices', function() {
      return N1.update(1, { foo: 6 })
      .then(v => {
        assert.isObject(v)
        assert.equal(v.foo, 6)
        v1 = v
        v1.bar = true
      })
    })

    it ('should set updated_at attribute', function() {
      return N1.get(1)
      .then(v => {
         assert(v1.updated_at >= v1.created_at, "updated_at should be greater than created_at")
      })

    })

    it ('should confirm types before updating', function() {
      return assertError(() => N1.update(2, { foo: 8 }))
    })

    it ('should update indices', function() {
      return N1.all({ index: 'updated_at' })
      .then(vs => assert.deepEqual(vs, [ v1, v3 ]))
    })

  })

  describe('.delete', function() {

    it ('should return the deleted vertex', function() {
      return N1.delete(v1.id)
      .then(v => assert.deepEqual(v, v1))
    })

    it ('should delete the vertex', function() {
      return N1.get(v1.id)
      .then(assert.isNull)
    })

  })

  describe('.all', function() {

    before(function() {
      return reset()
      .then(() => G.exec
        ( [ N1.job.create({ foo: 1 })
          , N1.job.create({ foo: 2 })
          , N1.job.create({ foo: 3 })
          , N2.job.create({ foo: 4.2 })
          ]
        )
      )
      .then(([u,v,w]) => {
       v1 = u
       v2 = v
       v3 = w
      })
    })

    it ('should return all vertices', function() {
      return N1.all()
      .then(vs => assert.deepEqual(vs, [v3, v2, v1]))
    })

    it ('should take a limit param', function() {
      return N1.all({ limit: 2 })
      .then(vs => assert.deepEqual(vs, [v3, v2]))
    })

    it ('should take an offset param', function() {
      return N1.all({ offset: 1 })
      .then(vs => assert.deepEqual(vs, [v2, v1]))
    })

    it ('should take a properties param', function() {
      return N1.all({ properties: [ 'bar' ] })
      .map(v => assert.isUndefined(v.foo))
    })

  })

  describe('.get', function() {

    it ('should get a vertex', function() {
    })

    it ('should take a properties param', function() {

    })

  })

  describe ('.attr', function() {
    it ('should allow individual attribute requests', function() {
      return N1.attrs(v1.id, [ 'id', 'created_at', 'foo' ])
      .then(v => {
        assert.isObject(v)
        assert.equal(v.id, v1.id)
        assert.equal(v.created_at, v1.created_at)
        assert.equal(v.foo, v1.foo)
        assert.isUndefined(v.type)
        assert.isUndefined(v.updated_at)
      })
    })

    it ('should allow requests for individual fields', function() {
      return N1.attrs(v1.id, 'type')
      .then(type => assert.equal(type, v1.type))
    })

    it ('should allow global vertex requests', function() {
      return G.exec
        ( [ G.job.V(1, 'type')
          , G.job.V(2, 'type')
          , G.job.V(3, 'type')
          , G.job.V(4, 'type')
          ]
        )
      .then(attrs => assert.deepEqual(attrs, [ "N1", "N1", "N1", "N2" ]))
    })

  })

})
