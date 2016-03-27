import _ from 'lodash'

import { RadService
       , RadType
       } from 'radql'

export function Source(G) {

  const { vertex, edge } = G

  class Source extends RadService {

    static _name = G.name

    constructor(root) {
      super(root)

      const src = this
      const e$  = this.e$
      const e =
        { do: (op, ...args) =>
            e$.fetch({ src, op, args, key: cacheKey(op, ...args) })
        , Vertex: (type, ...args) =>
            vertex[type].instance(e, ...args)
        , Adjacency: (type, dir, ...args) =>
            edge[type][dir](e, ...args)
        , Edge: (...args) =>
            edge[type].instance(e, ...args)
        }
      this.redis = G.redis
      _.forEach(vertex, (v, n) => {
        this[n] = (...args) => v.get(e, ...args)
        _.forEach(v, (j, k) => {
          if (_.isFunction(j))
            this[n][k] = (...args) => j(e, ...args)
          else
            this[n][k] = j
        })
      })
    }

    _fetch(jobs, { SKIP_ATTR_GROUPING } = {}, n) {

      // TODO: benchmark this and see if it's worth it
      // this chunk of code shoves more computation (and complexity) into the lambda function
      // in exchange for smaller redis pipelines

      // group HGETs into HMGETs
      if (!SKIP_ATTR_GROUPING) {
        const HGETs  = _.remove(jobs, j => j.req.op === "hget")
        const HMGETs = _(HGETs)
          .groupBy('req.args.0')
          .map
            ( (v, k) =>
                ( { req:
                    { op: 'hmget'
                    , args: [ k, _.map(v, 'req.args.1' ) ]
                    }
                  , resolve: vals => _.forEach(vals, (val, idx) => v[idx].resolve(val))
                  , reject:  err  => _.forEach(v, j => j.reject(err))
                  }
                )
            )
          .value()
        jobs = _.concat(jobs, HMGETs)
      }
      pipe(this.redis.pipeline(), _.map(jobs, 'req'))
        .exec()
        .map
          ( ([err, v], i) => err
              ? jobs[i].reject(err)
              : jobs[i].resolve(v)
          )

    }

  }

  return Source

}

function pipe(line, jobs) {
  return _.reduce
    ( jobs
    , (p, { op, args }) =>
        p[op](...args)
    , line
    )

}

function cacheKey(op, node, val) {
  return (op === 'hget')
    ? `${node}::${val}`
    : undefined
}

export function VertexType(G, name) {

  class Type extends RadType {

    static args = { id: "id!" }
    static get(root, attrs) {
      return root.e$[G.name][name](attrs.id, attrs)
        .verify()
        .then(v => v && new this(root, v))
    }

    constructor(root, v) {
      super(root)
      this.v = v
    }

  }

  return Type

}
