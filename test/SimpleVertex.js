import { G, reset } from './G'

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

  describe('.create', function() {

    it ('should create vertices', function() {

    })

    it ('should normalize returned attributes', function() {

    })

    it ('should persist vertices', function() {

    })

    it ('should serialize attributes', function() {

    })

  })

  describe('.update', function() {

    it ('should update vertices', function() {

    })

    it ('should set updated_at attribute', function() {

    })

    it ('should confirm types before updating', function() {

    })

    it ('should update indices', function() {

    })

  })

  describe('.all', function() {

    it ('should return all vertices', function() {

    })

    it ('should take a limit param', function() {

    })

    it ('should take an offset param', function() {

    })

    it ('should take a properties param', function() {

    })

  })

  describe('.get', function() {

    it ('should get a vertex', function() {
    })

    it ('should take a properties param', function() {

    })

  })

  describe('.delete', function() {

    it ('should delete the vertex', function() {

    })

    it ('should return the deleted vertex', function() {

    })

  })

})
