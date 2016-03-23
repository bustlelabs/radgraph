import RadQL from 'radql'
import { RadAPI
       , field
       , mutation
       , service
       , args
       } from 'radql'

import Radgraph from '../../src/radql'

const G = Radgraph("G", { db: 3 })

const UserType = G.Vertex
  ( "User"
  , { name: "string"
    , role: "integer"
    }
  )

class User extends UserType {

  @ service
  static create(root, name, role) {
    return UserType.create(root, { name, role })
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
    return this.e$.BDSM.from(this._id)
      .map(id => this.e$.User({ id }))
  }

  @ field([ "User" ])
  dominatedBy() {
    return this.e$.BDSM.to(this._id)
      .map(id => this.e$.User({ id }))
  }

}

const BDSM = G.Edge( "BDSM", "User", "Dominates", "User" )

class API extends RadAPI {

  @ field("User")
  @ args({ id: "id!" })
  user({ id }) {
    return this.e$.User({ id })
  }

  @ mutation("object")
  fixtures() {
    const { G, BDSM, User } = this.e$
    return G.redis.flushdb()
    .then(() => Promise.all
      ( [ User.create("Alice", 1)
        , User.create("Bob", 2)
        , User.create("Claire", 0)
        , User.create("David", 2)
        , BDSM.create(1, 2)
        , BDSM.create(1, 3)
        , BDSM.create(1, 4)
        , BDSM.create(2, 2)
        ]
      )
   )
  }

}

const { serve } = RadQL([ API ], [ User ], [ G, BDSM ])

export default serve
