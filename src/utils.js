import _ from 'lodash'
import { Type } from './radql'

// common functions

export const identity = x => x

export const head = x => x && x[0]
export const OR   = (r, l) => r || l
export const AND  = (r, l) => r && l

export const fnMap  = fn => xs => _.map(xs, fn)
export const fnHead = fn => xs => xs && fn(xs[0])

export const indexJob =

  ( keyspace
  , { defaultProps
    , deserializer
    , normalize
    }
  ) =>

    ( { index = 'created_at'
      , offset = 0
      , limit = 30
      , properties = defaultProps
      } = {}
    ) =>

      normalize(properties).do(properties =>
        [ 'idxrange'
        , [ `${keyspace}:indices:${index}`, properties, limit, offset ]
        , fnMap(deserializer(properties))
        ]
      )

export const attrs = (key, props, { deserialize, deserializer }) =>
  _.isArray(props)
  ? [ 'hmget'
    , [ key, props ]
    , deserializer(props)
    ]
  : [ 'hget'
    , [ key, props ]
    // sorry !!
    // I'll come up with something more elegant later
    , v => deserialize(v, props)
    ]

function wrapRQL(G, jobs) {
  return _.mapValues
    ( jobs
    , j =>
        ( ctx, ...args ) =>
          ctx.e$.fetch
            ( { src: ctx.e$[G.name]
              , job: j(...args)
              }
            )
    )
}

export function wrapExec(G, jobs) {
  let radType = null
  return _(jobs)
    .mapValues(j => (...args) => G.exec(j(...args)))
    .assign({ job: jobs })
    .value()
}

// Field normalization

export function parsers(props, system = []) {

  // TODO: normalize props

  const type = p => props[p]

  const parse =

    { defaultProps: _(props)
        .keys()
        .filter(k => !~system.indexOf(k))   // maintains invariant
        .concat(system)                     // of normalized key ordering
        .value()

    , deserialize(v, k) {
        const t = type(k)
        // if (!t) return null // <- doesn't hurt, but no need if you don't try and break things
        if (t === 'json')
          return JSON.parse(v)
        if (t === 'integer')
          return parseInt(v, 10)
        if (t === 'number')
          return parseFloat(v, 10)
        if (t === 'boolean')
          return (v === 'true')
        return v
      }

    , deserializer(properties) {
        return attrs =>
            _.reduce(attrs, OR, null) // confirm attrs is not a null list
         && _(properties)
            .zipObject(attrs)         // zip object
            .omitBy(_.isNull)         // remove null entries
            .mapValues(parse.deserialize)
            .value()
      }

    // creates an execution context with serialized attributes and serialized keys
    // think of it as a synchronous functor/monad
    // serialize(attrs).do((attrs, keys) => [ ...job ])
    , serialize(attrs) {
        const ks = []
        const a = _.flatMap
          ( attrs
          , (v, k) => type(k)
            ? ( ks.push(k)
              , [ k
                , (type(k) === 'json')
                  ? JSON.stringify(v)
                  : v
                ]
              )
            : [] // not a valid field, ignore
          )
        return { do: fn => fn(a, _normalize(ks)) }
      }

    // creates an execution context with normalized keys
    // think of it as a synchronous functor/monad
    , normalize(attrs) {
        return { do: fn => fn(_normalize(attrs)) }
      }
    }

  return parse

  function _normalize(attrs) {
    return (attrs === 'all')
      ? parse.defaultProps
      : _.concat(attrs, system)
  }
}

