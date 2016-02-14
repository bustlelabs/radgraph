import Promise   from 'bluebird'
import _         from 'lodash'

import Radgraph  from '../src'
import flush     from './flushdb'
import redisOpts from './redis-opts'

// Starter graph for tests

const authoredSchema =
  { name: 'Authored'
  , inverse: 'AuthoredBy'
  , from: 'User'
  , to: 'Post'
  }

const ratedSchema =
  { name: 'Rated'
  , from: 'User'
  , to: 'Post'
  , properties:
    { rating: { type: 'integer' }
    , note: { type: 'string' }
    }
  }

const clippedSchema =
  { name: 'Clipped'
  , inverse: 'ClippedBy'
  , from: 'User'
  , to: 'Post'
  , properties:
    { title: { type: 'string' }
    , description: { type: 'string' }
    }
  }

// objects:
export const users =
  [ undefined
  , { id: 1, name: "Alice" }
  , { id: 2, name: "Bob" }
  , { id: 3, name: "Carol" }
  , { id: 4, name: "Dave" }
  ]

export const posts =
  [ undefined
  , { id: 1,  title: "Foo" }
  , { id: 2,  title: "Bar" }
  , { id: 3,  title: "Baz" }
  , { id: 4,  title: "Qux" }
  , { id: 5,  title: "Quux" }
  , { id: 6,  title: "Corge" }
  , { id: 7,  title: "Grault" }
  , { id: 8,  title: "Garply" }
  , { id: 9,  title: "Waldo" }
  , { id: 10, title: "Fred" }
  ]

// associations:
export const Authored = Radgraph(authoredSchema, null, redisOpts)
export const Clipped  = Radgraph(clippedSchema, null, redisOpts)
export const Rated    = Radgraph(ratedSchema, null, redisOpts)

export function serial(promises) {
  promises[0] = promises[0]()
  return _.reduce(promises, (s, p) => s.then(p))
}

export function resetGraph() {
  return flush().then(function() {
    return serial
      // Add authoring relationships
      ( [ () => Authored.add(1, 1)
        , () => Authored.add(1, 2)
        , () => Authored.add(2, 3)
        , () => Authored.add(2, 4)
        , () => Authored.add(1, 5)
        , () => Authored.add(3, 6)
        , () => Authored.add(1, 7)
        , () => Authored.add(3, 8)
        , () => Authored.add(1, 9)

      // Add rating relationships
        , () => Rated.add(1, 2)
        , () => Promise.delay(2)
        , () => Rated.add(1, 2, { rating: 5, note: "foo" })
        , () => Promise.delay(2)
        , () => Rated.add(1, 4, { rating: 3 })
        , () => Rated.add(2, 2, { rating: 1, note: "fooo" })
        , () => Rated.add(4, 6)
        , () => Promise.delay(2)
        , () => Rated.add(4, 6, { rating: 2 })
        , () => Promise.delay(2)
        , () => Rated.add(4, 6, { rating: 4, note: "foooo" })
        , () => Rated.add(3, 6)
        , () => Promise.delay(2)
        , () => Rated.add(3, 6, { rating: 1, note: "fooooo" })

        , () => Clipped.add(2, 1, { title: "Bar" })
        , () => Promise.delay(2)
        , () => Clipped.add(2, 1, { title: "bar" })
        , () => Clipped.add(2, 2, { title: "Foo" })
        , () => Clipped.add(2, 3, { title: "Qux" })
        , () => Clipped.add(3, 7, { title: "Seven" })
        , () => Clipped.add(3, 8, { title: "Eight" })
        , () => Clipped.add(3, 9, { title: "Nine" })

        ]
      ).return()
  })
}
