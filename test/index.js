import Promise from 'bluebird'
import { G, reset } from './G'

const Node = G.Vertex
  ( "Node"
  , { foo: "string"
    , bar: "json"
    }
  )

const Edge = G.Edge
  ( "A", "Has", "B"
  , { foo: "string"
    , bar: "json"
    }
  )

describe ('radgraph', function() {

  before(reset)
  /*
  it ('should work with simple vertex', function() {
    return Node.create({ foo: "hello", bar: [ 'a', 'b' ] })
      .then(console.log)
      .then(() => Node.create({ foo: "hello", bar: ['c', 'd'] }))
      .then(console.log)
      .then(() => Node.update(2, { foo: "world", bar: { a: 'yes' } }))
      .then(console.log)
      .then(() => Node.all({ properties: [ 'foo' ] }))
      .then(console.log)
      .then(() => Node.delete(1))
      .then(console.log)
      .then(() => Node.all({ properties: [] }))
      .then(console.log)
      .then(() => Node.get(2))
      .then(console.log)
  })*/
 /*
  it ('should work with simple edge', function() {
    return Edge.create(1, 2, { foo: 'hello' })
      .then(console.log)
      .then(() => Edge.create(2, 2))
      .then(console.log)
      .then(() => Edge.create(3, 2, { bar: [ 5 ] }))
      .then(console.log)
      .then(() => Edge.update(1, 2, { bar: "test" }))
      .then(console.log)
      .then(() => Edge.from(1))
      .then(console.log)
      .then(() => Edge.from(1, { properties: 'all' }))
      .then(console.log)
      .then(() => Edge.to(2))
      .then(console.log)
      .then(() => Edge.to(2, { properties: [ 'bar' ] }))
      .then(console.log)
  })
*/
})
