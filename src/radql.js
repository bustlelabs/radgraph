import _              from 'lodash'
import Promise        from 'bluebird'
import Redis          from 'ioredis'
import { RadService
       , RadType
       } from 'radql'

import Radgraph      from './index'

export default function(name, port, host, options) {

  if (port.keyPrefix || (options && options.keyPrefix))
    throw new Error("Key prefixes are not supported yet")

  const G = Radgraph(port, host, options)

  // create source
  class Source extends RadService {

    static _name = name

    static Vertex(...args) {
      return wrapVertex(Source, G.Vertex(...args))
    }

    static Edge(name, ...args) {
      return wrapEdge(Source, name, G.Edge(...args))
    }

    constructor(root) {
      super(root)
      // TODO: consider instantiating new instance per session
      this.radgraph = G
      this.redis    = G.redis
    }

    _fetch(jobs, opts, n) {
      // TODO: introduce and group ATTR jobs
      pipe(this.redis.pipeline(), _.map(jobs, 'req.job'))
        .exec()
        .map(
          ([err, v], i) => err
          ? (jobs[i].reject(err))
          : jobs[i].resolve(jobs[i].req.job[2](v))
        )
    }

  }

  return Source

}

function pipe(line, jobs) {
  return _.reduce
    ( jobs
    , (p, [ op, args ]) =>
        p[op](...args)
    , line
    )
}

function exec(e$, src, job) {
  return e$.fetch({ src, job })
}

function wrapVertex(source, model) {

  const job = model.job

  const s   = source._name

  class Type extends RadType {

    static model = model
    static get(root, { id }) {
      return exec(root.e$, root.e$[s], job.get(id))
        .then(attrs => attrs && new this(root, attrs))
    }

    static key({ id }) { return id }

    constructor(root, attrs) {
      super(root)
      this._id    = attrs.id
      this._attrs = _.mapValues(attrs, Promise.resolve)
    }

    attr(name) {
      return this._attrs[name]
    }

  }

  _.forEach
    ( job
    , ( j, name ) => (name === 'get')
        || ( Type[name] = (root, ...args) =>
               exec(root.e$, root.e$[s], j(...args))
           )
    )

  return Type

}

function wrapEdge(source, name, model) {

  const job = model.job
  const s   = source._name

  class Service extends RadService {

    static _name = name
    static model = model

    constructor(root) {
      super(root)
      this._src = this.e$[s]
    }

  }

  _.forEach
    ( job
    , ( j, name ) =>
        Object.defineProperty
          ( Service.prototype
          , name
          , { value(...args) {
                return exec(this.e$, this._src, j(...args))
              }
            }
          )
    )

  return Service

}
