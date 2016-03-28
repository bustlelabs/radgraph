import _       from 'lodash'
import Promise from 'bluebird'

import SimpleVertex, { scripts as Vscripts } from './Simple'

// A vertex is a mapping from Id -> Type

// g.V(id)
//  .then(v => ...)

export const V = (e$, id) =>
  e$.do('get', id)
  .then(type => type
    ? e$.Vertex(type, id)
    : Promise.reject(`Vertex "${id}" does not exist`)
  )

// g.describe
//  .Union("Zone", [ "ListZone", "FeedZone" ])

// g.Zone(id)
//  .then(v => assert(v.type === "ListZone"))

export const UnionVertex = (name, types) => (e$, id) =>
  e$.do('get', id)
  .then(type => ~types.indexOf(type) &&
    e$.Vertex(type, id)
  )

export { SimpleVertex }

export const scripts =
  _.assign
    ( {}
    , Vscripts
    )
