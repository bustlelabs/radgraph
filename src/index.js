import Redis   from 'ioredis'
import Promise from 'bluebird'
import _       from 'lodash'

const Radgraph = function(schema, hooks, redisOpts) {

  const redis = new Redis(redisOpts)

  // API

  const radgraph =

    { _redis: redis

    // Return inverse of an edge type
    , inv: null

    // Query edges based on type and parent ID
    , range: (id1, { properties, limit = 30, offset = 0 }) =>
        undefined

    // Return all edges from id1 to id2
    // * used for non-unique edges
    , all: (id1, id2) =>
        undefined

    // Return most recent edge from id1 to id2
    , get: (id1, id2) =>
        undefined

    // Create a new edge from id1 to id2
    , add: (id1, id2, attributes) =>
        undefined

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

  return radgraph

  // Object adjacencies

  // Edge operations

  function deserialize() {

  }

}

function serialize(attributes) {

}

export default function() {
  return "hello world"
}

// produces an inverse edge relationship
export function invert(schema) {

}
