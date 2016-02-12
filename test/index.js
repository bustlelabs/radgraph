import Radgraph from '../src'

import { assert
       , expect
       , should
       } from 'chai'


describe('Radgraph', function() {

  it ('should compile', function() {

    should()

    assert.equal(Radgraph(), "hello world")
    Radgraph().should.equal("hello world")
    expect(Radgraph()).to.equal("hello world")

  })

})
