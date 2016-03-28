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
        // TODO: revisit if this is good or not
        // for now I'm goign to say no, because it feels like magic
        // this would resolve to a RadQL type of the same name, effectively making union types their own services
        // , Vertex: (type, id) =>
        //     e$[type]({ id })
        , Vertex: (type, ...args) =>
            vertex[type].instance(e, ...args)
        , Adjacency: (type, dir, ...args) =>
            edge[type][dir](e, ...args)
        , Edge: (...args) =>
            edge[type].instance(e, ...args)
        }
      this.redis = G.redis
      _.forEach(vertex, (v, n) => {
        if (!v.new)
          return this[n] = (...args) => v(e, ...args)

        this[n] = (...args) => v.new(e, ...args)
        _.forEach(v.services, k => {
          if (_.isFunction(v[k]))
            this[n][k] = (...args) => v[k](e, ...args)
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
          .map( (v, k) =>
                  ( { req: { op: 'hmget'
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
    : ( (op === 'get')
      ? node
      : undefined
      )
}

export function VertexType(G, name) {

  class Type extends RadType {

    static args = { id: "id!" }
    static get(root, args) {
      // passed a vertex object, skip the check
      if (args.e$ && args.e$.do)
        return new this (root, v)
      // passed an id, constructor a vertex object
      return root.e$[G.name][name](args.id)
        .then(v => new this(root, v))
    }

    constructor(root, v) {
      super(root)
      this.v = v
    }

  }

  return Type

}
