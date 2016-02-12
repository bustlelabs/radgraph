import Promise    from 'bluebird'
import { assert } from 'chai'

import { resetGraph
       // models
       , users
       , posts
       // associations
       , Authored
       , Rated
       } from './graph'

describe ('Radgraph', function() {

  before(function(done) {
    return resetGraph().then(() => done())
  })

  describe ('.range', function() {

    it ('should return all results', function() {
      return Promise.resolve()
    })

  })

})
