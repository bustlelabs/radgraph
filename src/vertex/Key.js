// A Key vertex is a schemaless vertex with a unique secondary key used for quick lookups, i.e. a URLs
// This Id -> Key mapping should be a bijection

// Id -> Key
// Key -> Id
// Id -> JSON

// To the client, this should be indistinguishable from Key -> JSON

class KeyVertex {

  static type = null

  // there's no good way to enumerate over inherited classes
  static services = [ 'get', 'set' ]

  static new(e$, id) {
    return e$.do('', id)
             .then()

  }

  static get(e$, key) {

  }

  static set(e$, key, val) {
    return e$.do('kvset', key, val)
             .spread((id, key) => new this(e$, id, key, val))
  }

  constructor(e$, id, key, val) {
    this.e$   = e$
    this.id   = id
    this.key  = key
    this.type = this.constructor.type
  }

  value() {
    return this.e$.do('get')
      .then(JSON.parse)
  }

  delete() {
    return this.e$.do('kvrem', this.type, this.id, this.key)

  }

}

// g.describe
//  .Key("Embed")

// g.Key.get(url)
//  .then(v => v.value())

// g.Key.set(url, data)
//  .then(v => v.data())
//  .then(d => assert(d === data))

export default function(type) {
  return class extends KeyVertex {
    static type = type
  }
}

// MACROS

// SCRIPTS
