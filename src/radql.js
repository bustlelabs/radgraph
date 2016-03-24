import _       from 'lodash'
import Promise from 'bluebird'
import Redis   from 'ioredis'

import { RadService
       , RadType
       } from 'radql'

export default function(G) {

  // create source
  class Source extends RadService {

    static _name = G.name
    static graph = G

    constructor(root) {
      super(root)
      this.radgraph = G
      this.redis    = G.redis
      wrapJobs(this, this, G.job)
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

function wrapJobs(root, ctx, jobs) {
  _.forEach
    ( jobs
    , function(j, name) {
        if(_.isFunction(j)) {
          ctx[name] = (...a) => {
            return root.e$.fetch
              ({ src: root, job: j(...a) })
          }
        } else {
          ctx[name] = {}
          wrapJobs(root, ctx[name], j)
        }
      }
    )
}

function pipe(line, jobs) {
  return _.reduce
    ( jobs
    , (p, [ op, args ]) =>
        p[op](...args)
    , line
    )
}

// for now, this only handles vertex types
// edge types will come later

export function VertexType(G, name, jobs) {

  class Type extends RadType {

    static key({ id }) { return id }
    static args = { id: "id!" }

    static get(root, { id }) {
      return root.e$[G.name][name].get(id)
        .then(attrs => attrs && new this(root, attrs))
    }

    constructor(root, attrs) {
      super(root)
      this._id    = attrs.id
      this._attrs = _.mapValues(attrs, Promise.resolve)
    }

    attr(name) {
      return this._attrs[name]
    }

  }

  return Type

}
