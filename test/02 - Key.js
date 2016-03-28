import Promise    from 'bluebird'
import { assert } from 'chai'
import { redisOpts, reset, assertError } from './utils'
import Radgraph   from '../src'

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

const G = Radgraph("G_02", redisOpts)


 G.describe

  .Vertex ( "Clip"
          , { title: "string"
            , url  : "string"
            }
          )

  .Key    ("Embed")

  .Key    ("Media")

const g = G.Executor()

describe ('02 - Key Vertex', function() {

  let v1, v2, v3, v4

  before(reset(G))
  before(function() {
    return Promise.all
      ( [ g.Embed.set("www.bustle.com", { name: "Bustle", description: "the og bustle dot com" })
        , g.Embed.set("www.romper.com", { name: "Romper", description: "bustle 4 moms" })
        , g.Media.set("/me/selfie.jpg", { size: 1024    , contentType: "image/jpeg" })
        , g.Clip.create({ title: "My Clip", url: "www.bustle.com" })
        ]
      ).spread((u1, u2, u3, u4) => {
        v1 = u1
        v2 = u2
        v3 = u3
        v4 = u4
      })
  })

  describe ('set', function() {

    it ('should return a vertex instance', function() {
      assert.isOk(v1.id)
      assert.equal(v1.key, "www.bustle.com")
      assert.equal(v1.type, "Embed")
      assert.isFunction(v1.value)
      assert.isFunction(v1.delete)
    })

    it ('should persist value', function() {
      return v2.value()
      .then(v => assert.deepEqual(v, { name: "Romper", description: "bustle 4 moms" }))
    })

    it ('should produce a valid id', function() {
      return g.V(v1.id)
      .then(v => v.value())
      .then(v => assert.deepEqual(v, { name: "Bustle", description: "the og bustle dot com" }))
    })

    it ('should replace an existing value', function() {
      return g.Media.set("/me/selfie.jpg", { size: 1023, contentType: "image/jpg" })
        .then(() => g.Media.get("/me/selfie.jpg"))
        .then(v => v.value())
        .then(v => assert.deepEqual(v, { size: 1023, contentType: "image/jpg" }))

    })

  })

  describe ('get', function() {

    it ('should search for a vertex by key', function() {
      return g.Embed.get("www.bustle.com")
      .then(v => {
        assert.equal(v.id, v1.id)
        assert.equal(v.type, "Embed")
        assert.equal(v.key, "www.bustle.com")
        return v.value()
      })
      .then(v => assert.deepEqual(v, { name: "Bustle", description: "the og bustle dot com" }))
    })

    it ('should reject an invalid key', function() {
      return assertError(g.Embed.get("/me/selfie.jpg"))
    })

    it ('should reject an invalid id', function() {
      return assertError(g.Media(v1.id))
    })

  })

  describe ('.value()', function() {

    it ('should work', function() {
      return g.Media.get("/me/selfie.jpg")
        .then(v => v.value())
        .then(v => assert.deepEqual(v, { size: 1023, contentType: "image/jpg" }))
    })

    it ('should work for vertices returned by g.V()', function() {
      return g.V(v3.id)
        .then(v => v.value())
        .then(v => assert.deepEqual(v, { size: 1023, contentType: "image/jpg" }))
    })

  })

  describe ('.delete()', function() {

    let vertex, deleted

    before(function() {
      return g.Embed.get("www.romper.com")
        .then(v => vertex = v)
        .then(v => v.delete())
        .then(v => deleted = v)
    })

    it ('should return the vertex instance', function() {
      assert.equal(vertex, deleted)
    })

    it ('should dump the value for posthumous access', function() {
      return deleted.value()
        .then(v => assert.deepEqual(v, { name: "Romper", description: "bustle 4 moms" }))
    })

  })

  describe ('RadQL integration', function() {

    class API extends RadAPI {

      @ field("Clip")
      @ args({ id: "id!" })
      clip({ id }) {
        return this.e$.Clip({ id })
      }

    }

    class Clip extends G.VertexType("Clip") {

      @ field("string")
      title() {
        return this.v.attr('title')
      }

      @ field("Embed")
      embed() {
        return this.v.attr('url')
          .then(url => this.e$.Embed.get(url))
      }

    }

    class Embed extends G.VertexType("Embed") {

      @ service
      static get(root, url) {
        const G = root.e$.G_02
        return G.Embed.get(url)
          .then(v => new this(root, v))
      }

      @ field("string")
      url() {
        return this.v.key
      }

      @ field("string")
      name() {
        return this.v.value()
          .then(v => v.name)
      }

      @ field("string")
      description() {
        return this.v.value()
          .then(v => v.description)
      }

    }

    const { serve } = RadQL( [ API ], [ Clip, Embed ], [ G.Source() ] )

    it ('should work', function() {
      return serve
      ( `{
          API {
            clip(id: "${v4.id}") {
              title
              embed {
                url
                name
              }
            }
          }
        }`
      ).then(d =>
        assert.deepEqual
          ( d.data.API.clip
          , { title: "My Clip"
            , embed:
              { url: "www.bustle.com"
              , name: "Bustle"
              }
            }
          )
      )

    })

  })

})
