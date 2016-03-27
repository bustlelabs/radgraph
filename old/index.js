import Redis   from 'ioredis'
import _       from 'lodash'

import RadQL   from './radql'

import { attrs
       , parsers
       } from './utils'

import { IDX_RANGE } from './macros'

import { scripts as vertexScripts
       , SimpleVertex
       , KeyValuePair
       } from './vertex'

import { scripts as edgeScripts
       , ArrayEdge
       , OneToMany
       , OneToOne
       , OrderedEdge
       , SemiOrderedEdge
       , SimpleEdge
       } from './edge'

const scripts = _.assign
  ( { idxrange: { numberOfKeys: 1, lua: IDX_RANGE } }
  , vertexScripts
  , edgeScripts
  )

export default function (name, port, host, options) {

  if (port.keyPrefix || (options && options.keyPrefix))
    throw new Error("Key prefixes are not supported yet")

  const redis = new Redis(port, host, options)

  _.forEach
    ( scripts
    , (v, k) => redis.defineCommand(k, v)
    )

  const pipeAll = (line, jobs) =>
    _.reduce
      ( jobs
      , (p, [ op, args ]) =>
          p[op](...args)
      , line
      )

  let rqlSource = null

  const Vparser = parsers
    ( { id:         'integer'
      , created_at: 'integer'
      , updated_at: 'integer'
      , type:       'string'
      }
    )

  const Eparser = parsers
    ( { from:       'string'
      , type:       'string'
      , to:         'string'
      , created_at: 'integer'
      , updated_at: 'integer'
      }
    )

  const G =

    { redis
    , job: { V: (id, properties) => attrs(id, properties, Vparser)
           }
    , name

    // TODO: optimize identity calls to
    // reduce function call overhead
    , exec: jobs => _.isArray(jobs[0])
        // execute a batch of jobs
        ? pipeAll(redis.pipeline(), jobs)
            .exec()
            .map
              ( ([err, v], i) => err
                  ? Promise.reject(err)
                  : Promise.resolve(jobs[i][2](v))
              )
        // execute a single job
        : (([ op, args, resolve ]) =>
            redis[op](...args)
              .then(resolve)
          )(jobs)

    // vertex registrars
    , Vertex:          registerVertex(SimpleVertex)
    , Key:             registerVertex(KeyValuePair)

    // edge registrars
    , ArrayEdge:       registerEdge(ArrayEdge)
    , Edge:            registerEdge(SimpleEdge)
    , OneToMany:       registerEdge(OneToMany)
    , OneToOne:        registerEdge(OneToOne)
    , OrderedEdge:     registerEdge(OrderedEdge)
    , SemiOrderedEdge: registerEdge(SemiOrderedEdge)

    , get Source() {
        return rqlSource
          || ( rqlSource = RadQL(G) )
      }

    }

  return G

  function registerVertex(Type) {
    return function(name, ...args) {
      // create vertex
      const V = Type(G, name, ...args)
      // register jobs
      if (!G.job[name])
        G.job[name] = {}
      _.assign(G.job[name], V.job)
      // return vertex
      return V
    }
  }

  function registerEdge(Type) {
    return function(from, type, to, ...args) {
      // create edge
      const E = Type(G, from, type, to, ...args)
      // register jobs
      if (!G.job[from])
        G.job[from] = {}
      if (!G.job[from][type])
        G.job[from][type] = {}
      if (!G.job[from][type][to])
        G.job[from][type][to] = {}
      _.assign(G.job[from][type][to], E.job)
      // return edge
      return E
    }


  }
}
