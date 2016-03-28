import Promise from 'bluebird'
import { assert } from 'chai'
import Radgraph   from '../src'
import { redisOpts, reset, assertError } from './utils'

import RadQL
   , { field
     , mutation
     , service
     , type
     , args
     , delegate
     , RadAPI
     , RadType
     } from 'radql'

const G = Radgraph("G_01", redisOpts)

 G.describe
  .Vertex
    ( "User"
    , { name: "string"
      , age:  "number"
      }
    )
  .Vertex
    ( "Post"
    , { title: "string"
      , body:  "json"
      }
    )

const g = G.Executor()

describe ('01 - Simple Vertex', function() {

  let v1, v2, v3

  // really this should be called once per describe block
  // but were ok for now

  before(function() {
    return Promise.all
    ( [ g.User.create({ name: "Daria"   , age: 17 })
      , g.User.create({ name: "Jane"    , age: 17, brother: "Trent" })
      , g.Post.create({ title: "My Post", body: [ 'a', { b: 'b' }, 'c' ] })
      ]
    ).spread((u1, u2, u3) => {
      v1 = u1
      v2 = u2
      v3 = u3
    })
  })

  describe ('create', function() {

    it ('should return a valid vertex object', function() {
      assert.equal(v1.type, "User")
      assert.isString(v1.id)

      assert.equal(v2.type, "User")
      assert.isString(v2.id)

      assert.equal(v3.type, "Post")
      assert.isString(v3.id)
    })

    it ('should not save unspecified values', function() {
      return v2.attr('brother')
        .then(assert.isNull)
    })

    it ('should set system properties', function() {
      return v1.attrs('created_at', 'updated_at', '_v')
      .spread((created_at, updated_at, _v) => {
        assert.isNumber(created_at)
        assert.isNumber(updated_at)
        assert.equal(_v, 1)
      })
    })

    it ('should serialize JSON', function() {
      return v3.attr('body')
      .then(b => assert.deepEqual(b, [ 'a', { b: 'b' }, 'c' ]))

    })

    // TODO: it should perform input validations

  })

  describe ('get', function() {

    it ('should implement a vertex factory', function() {
      return g.User(v1.id)
      .then(v => {
        assert.equal(v.id,   v1.id)
        assert.equal(v.type, "User")
        return v.attrs('name', 'age')
      }).spread((name, age) => {
        assert.equal(name, "Daria")
        assert.equal(age, 17)
      })
    })

    it ('should check the type', function() {
      return assertError(() => g.Post(v1.id))
    })

    it ('should be accessible through the .V() method', function() {
      return g.V(v3.id)
      .then(v => {
        assert.equal(v.id  , v3.id)
        assert.equal(v.type, "Post")
        return v.attrs('title', 'body')
      }).spread((title, body) => {
        assert.equal(title, "My Post")
        assert.deepEqual(body, [ 'a', { b: 'b' }, 'c' ])
      })
    })

  })

  describe ('.attr', function() {

    it ('should work', function() {
      return v2.attr('name')
      .then(n => assert.equal(n, "Jane"))
    })

    it ('should have a .attrs shorthand', function() {
      return v2.attrs('name', 'age')
      .then(as => assert.deepEqual(as, [ 'Jane', 17 ]))
    })

    it ('should return null for unset attrs', function() {
      return v2.attr('asdf')
      .then(assert.isNull)
    })

  })

  describe ('.set', function() {

    before(function() {
      return v1.set({ name: "D-dizzle", age: 18, sister: "Quinn" })
        .then(v => assert.equal(v, v1))
        .then(() => Promise.delay(1))
        .then(() => v3.set({ title: "My New Title" }))
    })

    it ('should update the local value', function() {
      return v1.attrs('name', 'age', '_v')
      .spread((name, age, _v) => {
        assert.equal(name, "D-dizzle")
        assert.equal(age,  18)
        assert.equal(_v, 2)
      })
    })

    it ('should persist mutation', function() {
      return g.V(v1.id)
      .then(v => v.attrs('name', 'age', '_v'))
      .spread((name, age, _v) => {
        assert.equal(name, "D-dizzle")
        assert.equal(age,  18)
        assert.equal(_v, 2)
      })
    })

    it ('should allow partial updates', function() {
      return g.Post(v3.id)
      .then(v => v.attrs('title', 'body', '_v'))
      .spread((title, body, _v) => {
        assert.equal(title, "My New Title")
        assert.deepEqual(body, [ 'a', { b: 'b' }, 'c' ])
        assert.equal(_v, 2)
      })
    })

    it ('should change the updated_at value', function() {
      return v3.attrs('updated_at', 'created_at')
      .spread((updated_at, created_at) => {
        assert(updated_at > created_at)
      })
    })

    it ('should omit extraneous values', function() {
      return v1.attr('sister')
        .then(assert.isNull)
    })

    it ('should return the same vertex', function() {
      return v2.set()
        .then(v => assert.equal(v, v2))
    })

  })

  describe ('.delete', function() {

    before(function() {
      return v1.delete()
    })

    it ('should persist the deletion', function() {
      return assertError(() => g.V(v1.delete()))
    })

    it ('should save a full dump of the vertex', function() {
      return v3.delete()
        .then(v => v.attrs('title', 'body', '_v', 'updated_at', 'created_at'))
        .spread((title, body, _v, updated_at, created_at) => {
          assert.equal(title, "My New Title")
          assert.deepEqual(body, [ 'a', { b: 'b' }, 'c' ])
          assert.equal(_v, 2)
          assert.isNumber(updated_at)
          assert.isNumber(created_at)
          assert(updated_at > created_at)
        })
    })

  })

  describe ('RadQL Integration', function() {

    class API extends RadAPI {

      @ field("User")
      @ args({ id: "id!" })
      user({ id }) {
        return this.e$.User({ id })
      }

      @ delegate("mutation")
      new() { return { to: "User", service: "create" } }
    }

    class User extends G.VertexType("User") {

      @ service
      @ type("User")
      @ args({ name: "string!", age: "integer" })
      static create(root, { name, age }) {
        const G = root.e$.G_01
        return G.User.create({ name, age })
          .then(v => new this(root, v))
      }

      @ field("id!")
      id() { return this.v.id }

      @ field("string")
      name() { return this.v.attr('name') }

      @ field("integer")
      age() { return this.v.attr('age') }

    }

    const { serve } = RadQL( [ API ], [ User ], [ G.Source() ] )

    let id = null

    before(function() {
      return serve(`mutation { API__new(name: "Daria", age: 17) { id name age } }`)
        .then(d => id = d.data.API__new.id)
    })

    it ('should work', function() {
      return serve(`{ API { user(id : "${id}") { id name age } } }`)
      .then(d => {
        const user = d.data.API.user
        assert.equal(user.id, id)
        assert.equal(user.name, "Daria")
        assert.equal(user.age, 17)
      })

    })

  })

})

