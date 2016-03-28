# Radgraph

Radgraph is a graph database system system inspired by Gremlin.
Proper Gremlin 

# `G`

A radgraph instance, typically denoted `G`, is the description of the graph:

```js
import Radgraph from 'radgraph'

const G = Radgraph("g", redisOpts)
```

## `G.describe`

We build our schema by calling methods on `G.describe`:

```js

 G.describe

  .Vertex   ( "User"
            , { name: "string"
              , role: "integer"
              }
            )

  .Vertex   ( "Post"
            , { title: "string"
              , media_key: "string"
              }
            )

  .Edge     ( "Authored"   // User-[Authored]->Post
            , { notes: "string"
              }
            )

```

# `g`

A radgraph executor, typically denoted `g`, is our means for interacting with the graph:

```js
const g = G.Executor()
```

## `g.V(id)`

## `g.Type(id)`

## `g.Type.service(...args)`

# `v`

A vertex instance provides an interface for performing graph operations relative to a vertex in the graph:

```js
g.V(id).then(v => ...)
```

## Simple Vertex

### `v.attr(name)`

### `v.set({ k: v })`

### `v.delete()`

## Key Vertex

## `v.in(label)`

## `v.out(label)`

# Adjacencies

## Multi

## Array

## Simple

## Ordered

## SemiOrdered

## OneToMany

## OneToOne
