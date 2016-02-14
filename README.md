# Radgraph

Based loosely on Facebook's [TAO spec](https://cs.uwaterloo.ca/~brecht/courses/854-Emerging-2014/readings/data-store/tao-facebook-distributed-datastore-atc-2013.pdf).

Radgraph is a simple object association service designed primarily to complement [Radredis](https://github.com/bustlelabs/radredis).
However, the only assumption Radgraph makes about your object store is that each object has a unique integer id, and can be used for arbitrary integer associations.

Radgraph allows you to store associations between integers, automatically handles inverse association, and can optionally attach data to associations.

## Setup

```js
const Radgraph = require('radgraph')
const redisOpts = { db: 15, keyPrefix: 'your-app:' }
const transforms = {} // not yet implemented

const schema =
  { title: "Authored"
  , inverse: "AuthoredBy"
  , from: "User"
  , to: "Post"
  , properties:
    { status: { type: "integer" }
    , category: { type: "string" }
    , tags: { type: "array" }
    }
  }

const Authored = Radgraph(schema, transforms, redisOpts)
const AuthoredBy = Authored.inv
```

Note that if no inverse name is specified, Radgraph will assume that you do not want an inverse edge and `Authored.inv` will be `undefined`. Ensure that the `inverse` field is specified if you intend to use both directions.

See [`ioredis`](https://github.com/luin/ioredis/blob/master/API.md#new_Redis_new) for more information on redis connection options.

## Response type

All Radgraph methods return promises. Edges are of the format:
```js
const Edge = 
  { type: "Authored"
  , from: 1
  , to: 2
  , time: 1455486968000
  , data:
    { status: 0
    , category: "filthy, disgusting mfa trash"
    , tags: [ "wiwt", "pickup", "frugal" ]
    }
  }
```

## `.from(from, { limit = 30, offset = 0 })`

Queries all attributes pointing away from a specified node, using limit and offset for pagination

```js
Authored.from(1)
  .then(console.log)
// => [ Edge, Edge, ..., Edge ]

Authored.inv.from(5)
  .then(console.log)
// => [ Edge ]

Authored.from(2, { limit: 3, offset: 2 })
  .then(console.log)
// => [ Edge, Edge, Edge ]

```

The `.of(from)` shorthand is provided to get the head of the array returned from a `.from(from, { limit: 1, offset: 0 })` query.
This is primarily a convenience method for inverse queries on one-to-many relationships.

```js
Authored.inv.of(5)
  .then(console.log)
// => { type: 'AuthoredBy'
      , from: 5
      , to: 3
      , time: 1455487422000
      , data: { ... }
      }
```

## `.get(from, to, { time })`

Retrieves an edge between two nodes. If no `{ time }` parameter is specified, the latest edge will be retrieved.

```js
Authored.get(1, 2)
  .then(console.log)
// => { type: 'Authored'
      , from: 1
      , to: 2
      , time: 1455487876000
      , data: { status: 0 }
      }
Authored.inv.get(2, 1)
// => { type: 'AuthoredBy'
      , from: 2
      , to: 1
      , time: 1455487876000
      , data: { status: 0 }
      }
Authored.get(1, 2, { time: 1455487844400 })
  .then(console.log)
// => { type: 'Authored'
      , from: 1
      , to: 2
      , time: 1455487844400
      , data: { status: 1 }
      }
```

## `.find(from, to, { limit = 30, offset = 0})`

Retrieves all edges between two nodes. For most applications, edges will be unique and `.get(from, to)` should suffice.

```js
Authored.find(1, 2)
  .then(console.log)
// => [ Edge, Edge, ... ]

Authored.inv.find(2, 1, { limit: 2, offset: 1 })
// => [ Edge, Edge ]
```


## `.add(from, to, [attributes])`

Creates a new edge between two nodes. If the edge has data parameters, specify them in the third argument

Returns the new edge.

```js
Authored.add(4, 5)
  .then(console.log)
// => { type: 'Authored'
      , from: 4
      , to: 4
      , time: 1455488127000
      }

Authored.add(6, 7, { status: 4, tags: [ "WizWearsCoolPants", "waves" ] })
  .then(console.log)
// => { type: 'Authored'
      , from: 6
      , to: 7
      , time: 1455488198000
      , data:
        { status: 4
        , tags: [ "WizWearsCoolPants", "waves" ]
        }
      }

Authored.inv.add(10, 1)
  .then(console.log)
// => { type: 'AuthoredBy'
      , from: 10
      , to: 1
      , time: 1455488252000
      }
```

## `.set(from, to, [attributes])`

Updates attributes of an edge. If no time attribute is specified, the most recent edge will be updated.

Returns the updated edge, or `null` if no such edge exists to update.

```js
Authored.set(1, 3, { status: 1 })
  .then(console.log)
// => { type: 'Authored'
      , from: 1
      , to: 3
      , time: 1455487479000
      , data:
        { status: 1
        , category: "a$ap"
        , tags: ["rick owens", "cdg heart meme"]
        }
      }

Authored.inv.set(2, 1, { status: 2, time: 1455487401000 })
  .then(console.log)
// =>  { type: 'AuthoredBy'
       , from: 2
       , to: 1
       , time: 1455487401000
       , data: { status: 2 }
       }

Authored.set(9999, 9999, { time: -1 })
  .then(console.log)
// => null
```

## `.delete(from, to, [time])`

Deletes an edge. If no time attribute is provided, the most recent edge will be deleted.

Returns timestamp of deleted edge, or `null` if the edge does not exist

```js
Authored.delete(1, 2)
  .then(console.log)
// => 1455486761000

Authored.delete(1, 2, 1455486751000)
  .then(console.log)
// => 1455486751000

Authored.delete(1, 2, -1)
  .then(console.log)
// => null (edge doesn't exist)

Authored.inv.delete(2, 1)
```

## `.deleteAll(from)`

Delete all edges leading to and from a node, useful for deleting records.

Returns the number of edges deleted.

```js
Authored.deleteAll(8)
  .then(console.log)
// => 5

Authored.deleteAll(1)
  .then(() => Authored.from(1))
  .then(console.log)
// => []

Authored.inv.deleteAll(1)
  .then(() => Authored.inv.of(1))
  .then(console.log)
// => undefined
```

