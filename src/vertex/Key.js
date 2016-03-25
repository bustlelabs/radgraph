// TODO: write documentation on the underlying data structure
// QUICK NOTES:
// a Key is a graph node which points to some arbitrary JSON payload
// a Key is a mapping G.K :: String -> JSON
// Keys are used to form connections, i.e. G.Key("Media") might describe some mapping
// from a key "/998/uploads/selfie.jpg" -> some info { size: 1996, height: 500, width: 400 }
// Keys are schemaless, you either grab the whole payload or none of it
// Keys are stateless and non-temporal
// Keys are a thin wrapper over the built-in redis GET, SET, and DEL commands
// Keys are often used soley as extensions of vertices
//   i.e. consider Post = G.Vertex("Post", fields)
//                Media = G.Key("Media")
//        Primary_Media = G.OneToOne("Post", "HasPrimaryMedia", "Media")
// Given a Media key, we can determine which post is using it as a primary media
//   and given a Post, we can quickly retrieve the related media if required

import _ from 'lodash'

import { wrapExec } from '../utils'
import { KeyType } from '../radql'

export default function (G, type) {

  const jobs =

    { get: key =>
        [ 'get'
        , [ `${type}:${key}` ]
        , JSON.parse
        ]

    , set: (key, value) =>
        [ 'set'
        , [ `${type}:${key}`, JSON.stringify(value) ]
        , _ => value
        ]

    , del: key =>
        [ 'del'
        , [ `${type}:${key}` ]
        , _ => key
        ]

    }

  let Type = null

  return _.assign
    ( wrapExec(G, jobs)
    , { get Type() {
          return Type
            || ( Type = KeyType(G, type, jobs) )
        }
      }
    )

}
