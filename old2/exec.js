import _ from 'lodash'

export default function(G) {

  const { vertex, edge } = G

  const e$ =

    { do: (op, ...args) => G.redis[op](...args)

    , Vertex: (type, ...args) =>
        vertex[type].instance(e$,  ...args)

    , Adjacency: (type, dir, ...args) =>
        edge[type][dir](e$, ...args)

    , Edge: (...args) =>
        edge[type].instance(e$, ...args)

    }

  return _.mapValues( vertex, wrapExec )

  function wrapExec(v) {
    const ctor = (...args) => v.get(e$, ...args)

    _.forEach(v, (j, k) => {
      if(_.isFunction(j))
        ctor[k] = (...args) => j(e$, ...args)
      else
        ctor[k] = j
    })
    return ctor
  }

}
