// An edge is a mapping ( Id, Label, Id ) -> exists. a

// g.E("i", "h8", "u")
//  .then(e => e...)

// TODO: allow adjacency resolution, i.e.
// g.E(null, 'h8', 'u')
//  .then(adj => ...)
// g.E('i', 'h8', null)
//  .then(adj => ...)

const E = (e$, from, label, to, ...args) =>
  e$.do('exists', `${from}-[${label}]->${to}`)
    .then(exists => exists
      ? e$.Edge(from, label, to, ...args)
      : Promise.reject(`Edge "${from}-[${label}]->${to}" does not exist`)
    )
