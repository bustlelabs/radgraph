import Promise    from 'bluebird'
import _          from 'lodash'
import { assert } from 'chai'

import { resetGraph
       , Errthang
       } from './graph'

describe ('Radgraph', function() {

  before (function(done) {
    return resetGraph().then(done)
  })

  describe('serializer', function() {

    it ('should serialize full inputs', function() {
      const input =
        { object: { foo: 1, bar: "foo", qux: [ 1, 2, 3 ] }
        , array: [ "str", 4, 5.6, { baz: "qux" }, [ 7 ] ]
        , integer: 77
        , number: 8.8
        , string: "baz"
        }
      return Errthang.add(1, 2, input)
        .then(r => assert.deepEqual( r.data, input ))
    })

    it ('should serialize partial inputs', function() {
      const input =
        { object: { foo: 9.9 }
        , integer: 88
        , string: "wux"
        }
      return Errthang.set(1, 2, input)
        .then(r => assert.deepEqual
          ( r.data
          , input
          )
        )

    })

    it ('should deserialize all fields', function() {
      return Errthang.from(1)
        .then(([r1, r2]) => {
          assert.deepEqual
            ( r1.data
            , { object: { foo: 9.9 }
              , array: [ "str", 4, 5.6, { baz: "qux" }, [ 7 ] ]
              , integer: 88
              , number: 8.8
              , string: "wux"
              }
            )
          assert.deepEqual
            ( r2.data
            , { object: { foo: "foo", bar: 1 }
              , array: [ 100, 100.5, "string", [ 1, 2, 3 ], { foo: "foo", bar: 2 } ]
              , integer: 123
              , number: 45.6
              , string: "foo"
              }
            )
        })
    })

  })

})
