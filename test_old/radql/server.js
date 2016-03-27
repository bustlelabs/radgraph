import RadQL from 'radql'
import { RadAPI
       , field
       , mutation
       , service
       , type
       , args
       , delegate
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

  @ field([ "Media" ])
  uploaded() {
    return this.e$.G.User.Uploaded.Media.from(this._id)
      .map(key => this.e$.Media({ key }))
  }

  @ mutation("User")
  @ args({ name: "string!" })
  changeName({ name }) {
    this.setAttr("name", name)
    return this._save()
  }

}

G.Edge( "User", "Dominates", "User" )

const MediaKey = G.Key("Media")

G.OneToMany( "User", "Uploaded", "Media" )

class Media extends MediaKey.Type {

  @ service
  @ type("Media")
  @ args({ key: "string!", value: "string!", user_id: "ID!" })
  static create(root, { key, value, user_id }) {
    const { G } = root.e$
    return G.Media.set(key, JSON.parse(value))
      .then(val => G.User.Uploaded.Media.create(user_id, key).return(val))
      .then(val => new this(root, key, val))
  }

  @ field("string")
  key() {
    return this._key
  }

  @ field("integer")
  size() {
    return this._attrs.size
  }

  @ field("User")
  uploader() {
    const { G, User } = this.e$
    return G.User.Uploaded.Media.of(this._key)
      .then(id => User({ id }))
  }

}

class API extends RadAPI {

  @ field("User")
  @ args({ id: "id!" })
  user({ id }) {
    return this.e$.User({ id })
  }

  @ mutation("object")
  fixtures() {

    const { G, User, Media } = this.e$
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
        , Media.create({ key: "selfie1.jpg", value: JSON.stringify({ size: 420   }), user_id: 1 })
        , Media.create({ key: "selfie2.jpg", value: JSON.stringify({ size: 42069 }), user_id: 1 })
        , Media.create({ key: "selfie3.jpg", value: JSON.stringify({ size: 69420 }), user_id: 2 })
        ]
      )

   )
  }

  @ mutation("string")
  @ args({ id: "id!", name: "string!" })
  changeName({ id, name }) {
    return this.e$.User({ id })
      .then(u => u && u.changeName({ name }))
      .then(u => u.name())
  }

  @ mutation("User")
  @ args({ id: "id!" })
  deleteUser({ id }) {
    return this.e$.User({ id })
      .then( u => u && u._delete() )
  }

  @ delegate("Mutation")
  createMedia() { return { to: "Media", service: "create" } }
}

const { serve } = RadQL( [ API ], [ User, Media ], [ G.Source ] )

export default serve
