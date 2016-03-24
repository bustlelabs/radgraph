import RadQL from 'radql'
import { RadAPI
       , field
       , mutation
       , service
       , args
       } from 'radql'

import Radgraph from '../../src'

const G = Radgraph("G", { db: 3 })

const UserVertex = G.Vertex
  ( "User"
  , { name: "string"
    , role: "integer"
    }
  )

class User extends UserVertex.Type {

  @ service
  static create(root, name, role) {
    const { G } = root.e$
    return G.User.create({ name, role })
  }

  @ field("string")
  name() {
    return this.attr('name')
  }

  @ field("integer")
  role() {
    return this.attr('role')
  }

  @ field([ "User" ])
  dominates() {
    return this.e$.G.User.Dominates.User.from(this._id)
      .map(id => this.e$.User({ id }))
  }

  @ field([ "User" ])
  dominatedBy() {
    return this.e$.G.User.Dominates.User.to(this._id)
      .map(id => this.e$.User({ id }))
  }

}

const BDSM = G.Edge( "User", "Dominates", "User" )

class API extends RadAPI {

  @ field("User")
  @ args({ id: "id!" })
  user({ id }) {
    return this.e$.User({ id })
  }

  @ mutation("object")
  fixtures() {

    const { G, User } = this.e$
    const Dominates = G.User.Dominates.User

    return G.redis.flushdb()
    .then(() => Promise.all
      ( [ User.create("Alice", 1)
        , User.create("Bob", 2)
        , User.create("Claire", 0)
        , User.create("David", 2)
        , Dominates.create(1, 2)
        , Dominates.create(1, 3)
        , Dominates.create(1, 4)
        , Dominates.create(2, 2)
        ]
      )

   )
  }

}

const { serve } = RadQL( [ API ], [ User ], [ G.Source ] )

export default serve
