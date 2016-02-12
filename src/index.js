import Redis   from 'ioredis'
import Promise from 'bluebird'
import _       from 'lodash'

import { head
       , Deserialize
       , serialize
       , invertSchema
       } from './utils'

function Radgraph (schema, hooks, redisOpts) {

  if (!schema.name)
    throw new Error('No name provided to schema')

  const redis = new Redis(redisOpts)

  const deserialize = Deserialize(schema)

  const keyspace = schema.name.toLowerCase()
  let   invKeyspace = null // <-- will be set at end
  const edgeKeyspace = schema._inverse  // if this is an inverse edge
      ? schema._inverse._edgeKeyspace   // use its inverse's keyspace
      : schema.name.toLowerCase()       // otherwise, generate a new one

  // flag to check if this is an inverse edge
  // used to determine when to swap "from" and "to"
  const isInv = !!schema._inverse

  // API

  const radgraph =

    { _redis: redis
    , _keyspace: keyspace
    , _edgeKeyspace: edgeKeyspace

    // Association type info
    , _type: schema.name
    , _from: schema.from
    , _to: schema.to

    // Return inverse edge implementation
    , inv: null

    // Query edges based on type and parent ID
    , range: (id1, { properties, limit = 30, offset = 0 }) =>
        undefined

    // Return all edges from id1 to id2
    // * used for non-unique edges
    , all: (id1, id2, { properties, limit = 30, offset = 0 }) =>
        undefined

    // Return most recent edge from id1 to id2
    , get: (id1, id2, { properties }) =>
        radgraph.all(id1, id2, { properties, limit: 1 })
          .then(head)

    // Create a new edge from id1 to id2
    , add: (id1, id2, attributes) => {
        const t = +Date.now()
        const r = redis.multi()
        return Promise.resolve("yes hello")
      }

    // Update an edge from id1 to id2
    // * if edge is not unique, "created_at" should be passed in attributes
    //   to specify a specific edge to mutate
    , set: (id1, id2, attributes) =>
        undefined

    // Destroy an edge from id1
    // * if id2 is undefined, all edges will be destroyed
    // * if no time is provided, most recent edge will be destroyed
    , delete: (id1, id2, time) =>
        undefined

    }

  // Attach inverse

  if (schema.inverse) {         // build inverse schema
    radgraph.inv = Radgraph
      ( invertSchema(schema, radgraph)
      , null // TODO: handle save hooks
      , redisOpts
      )
    invKeyspace = radgraph.inv._keyspace
  } else if (schema._inverse) { // bind original schema
    radgraph.inv = schema._inverse
    invKeyspace = schema._inverse._keyspace
  }

  console.log
    ( "Created a new association from"
    , schema.from
    , "to"
    , schema.to
    , "having keyspaces"
    , edgeKeyspace
    , keyspace
    , invKeyspace
    , isInv ? '*' : ''
    )

  console.log(radgraph.inv && radgraph.inv._keyspace)

  return radgraph

  // Object adjacencies
  function getAdjs(p, id1, id2, params) {

  }
  function addAdj(p, id1, id2, time) {

  }
  function remAdj(p, id1, id2, time) {

  }

  // Edge operations
  function getAttrs(p, id1, id2, time, props) {

  }

  function setAttrs(p, id1, id2, time, attributes) {

  }
  function remAttrs(p, id1, id2, time, attributes) {

  }

}

export default Radgraph

// produces an inverse edge relationship
export function invert(schema) {

}
