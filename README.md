# Radgraph

Radgraph is a graph database system system inspired by Gremlin.
Proper Gremlin 

## Vertex

A simple vertex is an object in the graph.

To access a vertex, we call:

`G.V(id)`

This returns a vertex object, which supports the following operations:

`G.V(id).id` returns the current id
`G.V(id).attr(a1, a2, ...])` returns a promise containing either the attribute specified, or an array of the attributes specified
`G.V(id).dump()` returns a JSON dump of the vertex
`G.V(id).check(type)` returns a promise that either resolves to itself, or rejects if the given vertex does not conform to the type specified
`G.V(id).update({ k1: v1, ... })`
`G.V(id).delete()`
`G.V(id).in(label)` returns an Adjacency directed towards the current vertex
`G.V(id).out(label)`

## Enum

## Attribute

## Adjacency
