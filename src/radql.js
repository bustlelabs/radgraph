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

    _fetch(jobs, { SKIP_ATTR_GROUPING } = {}, n) {

      // TODO: benchmark this and see if it's worth it
      // this chunk of code shoves more computation (and complexity) into the lambda function
      // in exchange for smaller redis pipelines

      // group HGETs into HMGETs
      if (!SKIP_ATTR_GROUPING) {
        const HGETs = _.remove(jobs, j => j.req.job[0] === "hget")
        const HMGETs = _(HGETs)
          .groupBy('req.job.1.0')
          .map((v, k) =>
            ( { req:
                { job:
                  [ 'hmget'
                  , [ k, _.map(v, 'req.job.1.1') ]
                  , vals => _.map(vals, (val, idx) => v[idx].req.job[2](val))
                  ]
                }
              , resolve: vals => _.forEach(vals, (val, idx) => v[idx].resolve(val))
              , reject:  err  => _.forEach(v, j => j.reject(err))
              }
            )
          )
          .value()
        jobs = _.concat(jobs, HMGETs)
      }

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

    // fetch by id
    static get(root, attrs) {
      // vertex confirmed, bypass check
      if (attrs.type || attrs.created_at || attrs.updated_at)
        return new this(root, attrs)
      // confirm vertex exists
      return root.e$[G.name][name].get(attrs.id, [])
        .then(attrs => attrs && new this(root, attrs))
    }

    constructor(root, attrs) {
      super(root)
      this._id    = attrs.id
      this._attrs = _.mapValues(attrs, Promise.resolve)
      this._difs  = {}
    }

    attr(p) {
      return this._attrs[p]
        || ( this._attrs[p] = this.e$[G.name][name].attrs(this._id, p) )
    }

    setAttr(p, v) {
      this._difs[p]  = v
      this._attrs[p] = Promise.resolve(v)
    }

    _save() {
      return this.e$[G.name][name].update(this._id, this._difs)
        .then(attrs => _.assign(this.attrs, _.mapValues(attrs, Promise.resolve)))
        .return(this)
    }

  }

  return Type

}
