class Edge {

  static type = null
  static services = [ 'in', 'out' ]

  static new(e$, from, to, id) {

  }

  static create(e$) {

  }

  constructor(e$, from, to) {
    this.from  = this.from
    this.type = this.constructor.type
    this.key = `${from}-[${this.type}]->${to}`
  }

  attrs(...a) {

  }

  attr(a) {

  }

  set(hash) {

  }

  delete() {

  }

}

class In {

  static edge = Edge

  constructor(e$, to) {
    this.e$   = e$
    this.type = this.constructor.edge.type
    this.to   = this.to
    this.adj  = `-[${type}]->${to}`
  }

  ids({ limit, offset }) {
    return this.e$.do('zrevrange', this.adj, offset, offset + limit - 1)
  }

  edges({ limit, offset }) {

  }

  add(from, attrs) {
    const { constructor, e$, to } = this
    return constructor.edge.create(e$, from, to, attrs)
  }

  deleteAll() {

  }

}

class Out {

  static edge = Edge

  constructor(e$, from) {
    this.e$   = e$
    this.type = this.constructor.edge.type
    this.from = this.from
  }

  ids({ limit, offset }) {

  }

  edges({ limit, offset }) {

  }

  add(to, attrs) {
    const { e$, from } = this
    return this.constructor.edge
      .create(e$, from, to, attrs)
  }

  deleteAll() {

  }

}

export default function(type, fields) {

  return class E extends Edge {

    static type   = type
    static fields = fields

    static in = class I extends In {
      static edge = E
    }

    static out = class I extends Out {
      static edge = E
    }

  }

}
