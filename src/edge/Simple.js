class Edge {

  static label = null

  static new(e$, from, to, id) {

  }

  static create(e$) {

  }

  constructor(e$, from, to) {

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

  static edge  = Edge
  static label = null

  constructor(e$, to) {
    this.e$    = e$
    this.label = this.constructor.label
    this.to    = this.to
  }

  ids({ limit, offset }) {

  }

  edges({ limit, offset }) {

  }

  add(from, attrs) {

  }

  deleteAll() {

  }

}

class Out {

  static edge  = Edge
  static label = null

  constructor(e$, from) {
    this.e$    = e$
    this.label = this.constructor.label
    this.from  = this.from
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


