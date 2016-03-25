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

  it ('should query Key types', function() {
    const q = `{ API { user(id: 1) { name uploaded { key, size, uploader { name } } } } }`
    return test
      ( q
      , { user:
          { name: "Alice"
          , uploaded:
            [ { key: "selfie2.jpg"
              , size: 42069
              , uploader: { name: "Alice" }
              }
            , { key: "selfie1.jpg"
              , size: 420
              , uploader: { name: "Alice" }
              }
            ]
          }
        }
      )
  })

  it ('should perform mutations', function() {
    const q = `mutation {
      API: API__changeName(id: "1", name: "Eve")
    }`
    return test(q, "Eve")
  })

  it ('should persist mutations', function() {
    const q = `{
      API {
        user(id: 1) {
          name
          role
        }
      }
    }`
    return test(q, { user: { name: "Eve", role: 1 } })
  })

  it ('should delete vertices', function() {
    const q = `mutation {
      API: API__deleteUser(id: "1") {
        name
        role
        dominates { name }
      }
    }`
    return test
      ( q
      , { name: "Eve"
        , role: 1
        , dominates:
          [ { name: "David" }
          , { name: "Claire" }
          , { name: "Bob" }
          ]
        }
      )

  })

  it ('should persist deletions', function() {
    const q = `{ API { user(id: 1) { name, role } } }`
    return test(q, { user: null })
  })

})
