import serve from './radql/server'
import { assert } from 'chai'

function test(query, response) {
  return serve(query)
  .then(d => {
    assert.deepEqual(d.data.API, response)
  })

}

// TODO: make this work properly

describe ('RadQL', function() {

  before(function() {
    return serve('mutation { API__fixtures }')
  })

  it ('should work', function() {
    const q = `{
      API {
        user(id: 1) {
          name
          role
          dominates {
            name
            role
            dominates {
              name
              role
            }
          }
        }
      }
    }`

    const r =
      { user:
        { name: "Alice"
        , role: 1
        , dominates:
          [ { name: "David"
            , role: 2
            , dominates: []
            }
          , { name: "Claire"
            , role: 0
            , dominates: []
            }
          , { name: "Bob"
            , role: 2
            , dominates:
              [ { name: "Bob"
                , role: 2
                }
              ]
            }
          ]
        }
      }

    return test(q, r)
  })

})
