import Redis   from 'ioredis'
import _       from 'lodash'

import { IDX_RANGE } from './macros'

import { scripts as vertexScripts
       , SimpleVertex
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

export default function (port, host, options) {

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

  const G =

    { redis

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

    // TODO: maintain internal registry to allow queries directly to graph source
    , Vertex: (...args) =>
        SimpleVertex(G, ...args)

    , ArrayEdge: (...args) =>
        ArrayEdge(G, ...args)

    , Edge: (...args) =>
        SimpleEdge(G, ...args)

    , OneToMany: (...args) =>
        OneToMany(G, ...args)

    , OneToOne: (...args) =>
        OneToOne(G, ...args)

    , OrderedEdge: (...args) =>
        OrderedEdge(G, ...args)

    , SemiOrderedEdge: (...args) =>
        SemiOrderedEdge(G, ...args)


    }

  return G

}
