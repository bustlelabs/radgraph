import Radgraph from '../src'

import { assert
       , expect
       , should
       } from 'chai'

const foo = "foo"

describe('Test environment', function() {

  it ('"assert" works', function() {
    assert.equal(foo, "foo")
  })

  it ('"should" works', function() {
    should()
    foo.should.equal("foo")
  })

  it ('"expect" works', function() {
    expect(foo).to.equal("foo")
  })

})
