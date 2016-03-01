import Redis   from 'ioredis'
import Promise from 'bluebird'
import _       from 'lodash'

import { head
       , response
       , ParseAdj
       , ParseFullAdj
       , Deserialize
       , serialize
       , invertSchema
       } from './utils'

function Radgraph (schema, hooks, redisOpts) {

  if (!schema.name)
    throw new Error('No name provided to schema')

  const redis = new Redis(redisOpts)

  const props = _.keys(schema.properties)
  const deserialize = Deserialize(schema, props)

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
    , from: (from, { properties, limit = 30, offset = 0 } = {}) =>
        getAdjs(redis, from, limit, offset)
          .map(ParseAdj(type, from))
          .then(getAllAttrs)

    // Returns newest edge pointing from an node
    // only really useful for inv. one-to-many relationships
    , of: from =>
        radgraph.from(from, { limit: 1 })
          .then(head)

    // Return all edges from id1 to id2
    // * used for non-unique edges
    , find: (from, to, { properties, limit = 30, offset = 0 } = {}) =>
        getAdj(redis, from, to, limit, offset)
          .map(ParseFullAdj(type, from, to))
          .then(getAllAttrs)

    // Return most recent edge from id1 to id2
    , get: (from, to, { properties, time } = {}) =>
        getAdjTime(from, to, time)
          .then(ParseFullAdj(type, from, to))
          .then(e => {
            if (!(e && schema.properties))
              return e
            return getAttrs(redis, from, to, e.time)
              .then(attrs => augment(e, attrs))
          })

    // Create a new edge from id1 to id2
    , add: (from, to, attributes) => {
        const time = + Date.now()
        const edge = { type
                     , from
                     , to
                     , time
                     , data: attributes
                     }
        return addAdj(redis, from, to, time, attributes)
          .return(edge)
      }

    // Update an edge from id1 to id2
    // * if edge is not unique, "time" should be passed in attributes
    //   to specify a specific edge to mutate
    , set: (from, to, attributes = {}) =>
        getAdjTime(from, to, attributes.time)
          .then(time => {
            if (!time) return null
            const attrs = _.pick(attributes, _.keys(schema.properties))
            const edge = { type
                         , from
                         , to
                         , time
                         , data: attributes
                         }
            return setAttrs(redis, from, to, time, attrs)
              .return(edge)
          })

    // Destroy an edge from id1
    // * if no time is provided, most recent edge will be destroyed
    , delete: (from, to, time) =>
        getAdjTime(from, to, time)
          .then(time =>
            remAdj(redis, from, to, time)
              .return(time))

    // Destroy all edges leading away from a node
    // typically called when a node is deleted
    , deleteAll: from =>
        // no data and no inverses, just delete the adjacency list
        // Remove all inverse edges
        redis.lrange(`${keyspace}:${from}`, 0, -1)
          .map(r => r.split(':'))
          .then(es => {
            const p = redis.multi()
            // delete adjacency list
            p.del(`${keyspace}:${from}`)
            _.forEach
              ( es
              , ([to, time]) => {
                // delete "find" query assocs
                p.del(`${edgeKey(from, to)}`)
                // delete inverse adjacencies
                if ( invKeyspace )
                  p.lrem(`${invKeyspace}:${to}`, 1, `${from}:${time}`)
                // delete data attributes
                if ( schema.properties )
                  p.del(`${edgeKey(from, to)}:${time}`)
              })
            return p.exec()
              .return(es.length)
          })

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

  function augment(edge, attrs) {
    return _.assign(edge, { data: deserialize(attrs) })
  }

  function getAllAttrs(edges) {
    if (!schema.properties)      // if there are no properties to fetch, we're done
      return edges
    const p = redis.pipeline()   // otherwise, get all of the edge attributes
    _.forEach
      ( edges
      , ({ from, to, time }) =>
          getAttrs(p, from, to, time)
      )
    return p.exec()
      .map(response)
      .then(attrs => _.zipWith   // and augment our edges with a "data" property
        ( edges, attrs, augment ))
  }

  // if time is provided, check if it exists
  // otherwise, return the most recent time if it exist
  function getAdjTime(from, to, time) {
    return time
      ? checkAdj(redis, from, to, time)
      : getAdj(redis, from, to, 1, 0).then(head)
  }

  // Object adjacencies
  function getAdjs(p, from, limit, offset) {
    return p.lrange(`${keyspace}:${from}`, offset, offset+limit-1)
  }
  function getAdj(p, from, to, limit, offset) {
    return p.zrevrange(edgeKey(from, to), offset, offset+limit-1)
  }
  function checkAdj(p, from, to, time) {
    return p.zscore(edgeKey(from, to), time)
  }
  function addAdj(p, from, to, time, attributes) {
    const t = p.multi()
    t.lpush(`${keyspace}:${from}`, `${to}:${time}`)
    if (invKeyspace)
      t.lpush(`${invKeyspace}:${to}`, `${from}:${time}`)
    t.zadd(edgeKey(from, to), time, time)
    if (attributes)
      setAttrs(t, from, to, time, attributes)
    return t.exec()
  }
  function remAdj(p, from, to, time) {
    const t = p.multi()
    t.lrem(`${keyspace}:${from}`, 1, `${to}:${time}`)
    if (invKeyspace)
      t.lrem(`${invKeyspace}:${to}`, 1, `${from}:${time}`)
    t.zrem(edgeKey(from, to), time)
    if (schema.properties)
      remAttrs(t, from, to, time)
    return t.exec()
  }

  // Edge operations
  function getAttrs(p, from, to, time) {
    return p.hmget(`${edgeKey(from,to)}:${time}`, props)
  }
  function setAttrs(p, from, to, time, attributes) {
    return p.hmset(`${edgeKey(from,to)}:${time}`, serialize(attributes))
  }
  function remAttrs(p, from, to, time) {
    return p.del(`${edgeKey(from,to)}:${time}`)
  }

}

export default Radgraph
