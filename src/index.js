import Redis from 'ioredis'
import _     from 'lodash'

import { Source, VertexType } from './radql'
import Executor from './exec'

import { scripts as vertexScripts
       , V
       } from './vertex'

const scripts = _.assign
  ( {}
  , vertexScripts
  )

export default function(name, port, host, options) {

  if (port.keyPrefix || (options && options.keyPrefix))
    throw new Error("Key prefixes are not supported yet")

  const redis = new Redis(port, host, options)
  _.forEach(scripts, (v, k) => redis.defineCommand(k, v))

  const G =

    { redis
    , name
    , vertex: { V }
    , edge:   { }

    , describe:
        { Vertex:    describeVertex(null)
        , Enum:      describeVertex(null)
        , Key:       describeVertex(null)
        , Attribute: describeVertex(null)
        ,
        }

    // radql constructors
    , Source:     () => Source     (G)
    , VertexType: vn => VertexType (G, vn)

    // basic execution environment
    , Executor:   () => Executor   (G)

    }

  return G

  function describeVertex(Type) {
    return function(name, ...args) {
      G.vertex[name] = Type(name, ...args)
    }
  }

  function describeEdge(Type) {
    return function(from, name, to, ...args) {
      // TODO: track valid in/out edges
      G.edge[name] = Type(name, ...args)
    }
  }

}
