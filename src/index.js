import Redis   from 'ioredis'
import Promise from 'bluebird'
import _       from 'lodash'

import { head
       , response
       , ParseAdj
       , Deserialize
       , serialize
       , invertSchema
       } from './utils'

function Radgraph (schema, hooks, redisOpts) {

  if (!schema.name)
    throw new Error('No name provided to schema')

  const redis = new Redis(redisOpts)

  const deserialize = Deserialize(schema)

  const type = schema.name

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
    , range: (from, { properties, limit = 30, offset = 0 } = {}) =>
        getAdjs(redis, from, limit, offset)
          .map(ParseAdj(type, from))
          .then(getAllAttrs)

    // Return all edges from id1 to id2
    // * used for non-unique edges
    , all: (from, to, { properties, limit = 30, offset = 0 } = {}) =>
        getAdj(redis, from, to, limit, offset)
          .map(ParseAdj(type, from))
          .then(getAllAttrs)

    // Return most recent edge from id1 to id2
    , get: (id1, id2, { properties, time } = {}) =>
        time ? getAttrs(redis, id1, id2, time)
                 .then(deserialize)
             : radgraph.all(id1, id2, { properties, limit: 1 })
                 .then(head)

    // Create a new edge from id1 to id2
    , add: (from, to, attributes) => {
        const time = +Date.now()
        const edge =
          { type
          , from
          , to
          , created_at: time
          , data: attributes
          }
        return addAdj(redis, from, to, time, attributes)
          .return(edge)
      }

    // Update an edge from id1 to id2
    // * if edge is not unique, "time" should be passed in attributes
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

  return radgraph

  // HELPER METHODS

  function edgeKey(id1, id2) {
    const from = isInv ? id2 : id1
    const to   = isInv ? id1 : id2
    return `${edgeKeyspace}:${from}:${to}`
  }

  function getAllAttrs(edges) {
    if (!schema.properties)      // if there are no properties to fetch, we're done
      return edges
    const p = redis.pipeline()   // otherwise, get all of the edge attributes
    _.forEach
      ( edges
      , ({ from, to, created_at }) =>
          getAttrs(p, from, to, created_at)
      )
    return p.exec()
      .map(response)
      .then(attrs => _.zipWith   // and augment our edges with a "data" property
        ( edges
        , attrs
        , (e, a) =>
            _.assign(e, { data: deserialize(a) })
        ))
  }

  // Object adjacencies
  function getAdjs(p, from, limit, offset) {
    return p.lrange(`${keyspace}:${from}`, offset, offset+limit-1)
  }
  function getAdj(p, from, to, limit, offset) {
    return p.lrange(edgeKey(from, to), offset, offset+limit-1)
  }
  function addAdj(p, from, to, time, attributes) {
    const t = p.multi()
    t.lpush(`${keyspace}:${from}`, `${to}:${time}`)
    t.lpush(`${invKeyspace}:${to}`, `${from}:${time}`)
    t.lpush(edgeKey(from, to), time)
    if (attributes)
      setAttrs(t, from, to, time, attributes)
    return t.exec()
  }
  function remAdj(p, from, to, time) {
    const t = p.multi()
    t.lrem(`${keyspace}:${from}`, 1, `${to}:${time}`)
    t.lrem(`${invKeyspace}:${to}`, 1, `${from}:${time}`)
    t.lrem(edgeKey(from, to), 1, time)
    if (schema.properties)
      remAttrs(t, from, to, time, attributes)
    return t.exec()
  }

  // Edge operations
  function getAttrs(p, from, to, time) {
    return p.hgetall(`${edgeKey(from,to)}:${time}`)
  }
  function setAttrs(p, from, to, time, attributes) {
    return p.hmset(`${edgeKey(from,to)}:${time}`, serialize(attributes))
  }
  function remAttrs(p, from, to, time, attributes) {
    return p.del(`${edgeKey(from,to)}:${time}`)
  }

}

export default Radgraph

// produces an inverse edge relationship
export function invert(schema) {

}
