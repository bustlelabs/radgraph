import _ from 'lodash'

export default function(G) {

  const { vertex, edge } = G

  const e$ =

    { do: (op, ...args) => G.redis[op](...args)

    , Vertex: (type, ...args) =>
        vertex[type].new(e$,  ...args)

    , Adjacency: (type, dir, ...args) =>
        edge[type][dir](e$, ...args)

    , Edge: (...args) =>
        edge[type].new(e$, ...args)

    }

  return _.mapValues( vertex, wrapExec )

  function wrapExec(v) {

    // wrap a simple function
    if (!v.new)
      return (...args) => v(e$, ...args)

    const ctor = (...args) => v.new(e$, ...args)

    _.forEach(v.services, k => {
      if(_.isFunction(v[k]))
        ctor[k] = (...args) => v[k](e$, ...args)
      else
        ctor[k] = j
    })

    return ctor
  }

}
