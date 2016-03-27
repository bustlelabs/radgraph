import Promise from 'bluebird'
import { assert } from 'chai'
import Radgraph   from '../src'
import { redisOpts, reset, assertError } from './utils'

const G = Radgraph("Test::01", redisOpts)

G.describe
  .Vertex
    ( "User"
    , { name: "string"
      , age:  "integer"
      , real: "boolean"
      , data: "json"
      }
    )

describe ('01 - Simple Vertex', function() {

  before(reset(G))

  describe('.create', function() {

    let user, attrs

    before(function() {
      return User.create
        ( { name: "Daria"
          , age: 17
          , real: false
          , data: "whatever"
          }
        )
        .then(v => user = v)
        .then(v => v.attrs('all'))
        .then(a => attrs = a)
    })

    it ('should create a vertex', function() {
      return user.dump()
        .then(attrs => {
          assert.isString(attrs.id)
          assert.isNumber(attrs.createdAt)
          assert.isNumber(attrs.updatedAt)
          assert.equal(attrs.type , "User")
          assert.equal(attrs.name , "Daria")
          assert.equal(attrs.age  , 17)
          assert.equal(attrs.real , true)
          assert.equal(attrs.data , "whatever")
        })
    })

    it ('should persist general vertex to store', function() {
      return G.V(user.id).attr('id', 'created_at', 'updated_at', 'type')
        .spread((id, created_at, updated_at, type) => {
          assert.equal(id         , attrs.id)
          assert.equal(created_at , attrs.created_at)
          assert.equal(updated_at , attrs.updated_at)
          assert.equal(type       , "User")
        })
    })

    it ('should persist typed vertex to store', function() {
      return G.V(user.id).check("User")
        .then(v => v.attr('name', 'age', 'real', 'data'))
        .spread((name, age, real, data) => {
          assert.equal(name , "Daria")
          assert.equal(age  , 17)
          assert.equal(real , true)
          assert.equal(data , "whatever")
        })
    })

  })

  describe('.update', function() {

  })

  describe('.verify', function() {
  })

  describe('RadQL Integration', function() {

  })

})
