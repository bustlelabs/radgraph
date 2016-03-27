import Promise    from 'bluebird'
import { assert } from 'chai'
import Radgraph   from '../src'
import { redisOpts, reset, assertError } from './utils'

const G = Radgraph("G_01", redisOpts)

 G.describe
//  .Vertex("")
//  .Edge("Site", "Owns", "Page")

const g = G.Executor()

describe ('01 - Vertex', function() {

  before(reset(G))

  describe('.create', function() {

    let vertex, attrs

    // create a vertex and save it local scope
    before(function() {
      return g.V.create({ foo: "foo", bar: 0 })
        .then(v => vertex = v)
        .then(v => v.dump())
        .then(a => attrs = a)
    })

    it ('should return a valid vertex object', function() {
      return vertex.attr('id', 'foo', 'bar', 'created_at', 'updated_at')
        .spread((id, foo, bar, created_at, updated_at) => {
          assert.equal(id,  vertex.id)
          assert.equal(id,  attrs.id)
          assert.equal(foo, attrs.foo)
          assert.equal(bar, attrs.bar)
          assert.isNumber(created_at)
          assert.isNumber(updated_at)
        })
    })

    it ('should persist the vertex', function() {
      return g.V(vertex.id).dump()
        .then(d => assert.deepEqual(d, attrs))
    })

  })

  describe('.get', function() {

    let v1, v2, v3

    before(function() {
      return Promise.all
        ( [ g.V.create({ a: "foo" })
          , g.V.create({ b: "bar" })
          , g.V.create({ c: "qux" })
          ]
        ).spread((a, b, c) => {
          v1 = a
          v2 = b
          v3 = c
        })
    })

    it ('should perform var dumps', function() {
      return g.V(v1.id).dump()
        .then(d => {
          assert.equal(v1.id, d.id)
          assert.isNumber(d.created_at)
          assert.isNumber(d.updated_at)
          assert.equal(d.a, "foo")
        })
    })

    it ('should return null attributes', function() {
      return g.V().attr('id')
        .then(assert.isNull)
    })

    it ('should check existence', function() {
      return Promise.all
        ( [ g.V(v1.id).exists()
          , g.V(v2.id).exists()
          , g.V(v3.id).exists()
          , g.V("_my_fake_id_").exists()
          ]
        ).spread((a, b, c, d) => {
          assert.isOk(a)
          assert.isOk(b)
          assert.isOk(c)
          assert.isNotOk(d)
        })
    })

  })

  describe('.set', function() {

    let vertex, oldAttrs, newAttrs

    // create a vertex, wait 1ms, update it
    before(function() {
      return g.V.create({ a: "b", c: [ "d" ] })
        .then(v => vertex = v)
        .then(v => v.dump())
        .then(a => oldAttrs = a)
        .then(() => Promise.delay(1))
        .then(() => vertex.set({ a: "d", d: "a" }))
        .then(a => newAttrs = a)
    })

    it ('should return the attributes', function() {
      assert.equal(newAttrs.id, oldAttrs.id)
      assert(newAttrs.updated_at > oldAttrs.created_at)
      assert.equal(newAttrs.a, "d")
      assert.equal(newAttrs.d, "a")
    })

    it ('should persist the mutation', function() {
      return g.V(vertex.id).attr('id', 'created_at', 'updated_at', 'a', 'c', 'd')
        .spread((id, created_at, updated_at, a, c, d) => {
          assert.equal(id,         newAttrs.id)
          assert.equal(created_at, oldAttrs.created_at)
          assert.equal(updated_at, newAttrs.updated_at)
          assert.equal(a, "d")
          assert.deepEqual(c, [ "d" ])
          assert.equal(d, "a")
        })
    })

  })

  describe('.delete', function() {

    let vertex, attrs, del

    before(function() {
      return g.V.create({ foo: "bar" })
        .then(v => vertex = v)
        .then(v => v.dump())
        .then(a => attrs = a)
        .then(() => vertex.delete())
        .then(d => del = d)
    })

    it ('should return the attributes', function() {
      assert.deepEqual(attrs, del)
    })

    it ('should maintain the vertex object', function() {
      return vertex.attr('id', 'created_at', 'updated_at', 'foo')
        .spread((id, created_at, updated_at, foo) => {
          assert.deepEqual({ id, created_at, updated_at, foo }, attrs)
        })
    })

    it ('should delete the record', function() {
      return g.V(vertex.id).exists()
        .then(assert.isNotOk)
    })

  })

})

// RADQL INTEGRATION TEST

import RadQL
   , { field
     , mutation
     , service
     , args
     , RadAPI
     } from 'radql'

const S = G.Source()

class API extends RadAPI {

  @ field("V")
  @ args({ id: "id!" })
  node({ id }) { return this.e$.V({ id }) }

  @ mutation("V")
  @ args({ raw: "string!" })
  new({ raw }) { return this.e$.V.create(JSON.parse(raw)) }
}

class V extends G.VertexType("V") {

  @ service
  static create(root, attrs) {
    return root.e$.G_01.V.create(attrs)
      .then(v => new this(root, v))
  }

  @ field("id!")
  id() { return this.v.id }

  @ field("object")
  dump() { return this.v.dump() }

  @ field("object")
  @ args({ name: "string!" })
  field({ name }) { return this.v.attr(name) }

}

const { serve } = RadQL([ API ], [ V ], [ S ])

describe ('01 - Vertex', function() {

  describe('RadQL Integration', function() {

    let id
    before(function() {
      return serve
        ( `mutation($raw: String!) {
             API__new(raw: $raw) {
               id
               foo: field(name: "foo")
             }
          }`
        , { raw: JSON.stringify({ foo: "test", bar: 1 }) }
        )
        .then(d => {
          id = d.data.API__new.id
        })
    })

    it ('should work', function() {
      return serve
        ( `{
            API {
              node(id: "${id}") {
                id
                foo: field(name: "foo")
                bar: field(name: "bar")
              }
            }
          }`
        ).then(d => assert.deepEqual(d.data.API.node, { id, foo: "test", bar: 1 }))

    })

  })
})
