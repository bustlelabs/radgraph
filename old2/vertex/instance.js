const V =

  { get: (e$, id) =>
      e$.do('hget', id, '_type')
        .then(t => t && e$[t].instance(e$, id, type, undefined, { id, _type }))

  , create: (e$, attrs) =>
      e$.do('vadd', serialize(attrs), "V", +Date.now())
        .then(deserializeHash)
        .then(v => instance(e$, v.id, "V", undefined, v))

  , instance

  }

function instance(e$, id, type, fields, attrs) {

  let _attrs = {}
  const getAttr = k => _attrs[k]
    || ( _attrs[k] =
         e$.do('hget', id, k)
       )

  const setAttr = (v, k) =>
    _attrs[k] = Promise.resolve(v)

  // set all attrs then return vertex
  const setAttrs = m => ( _.forEach(m, setAttr), v )

  const v =
    { id
    , type
    }

  return v

}
