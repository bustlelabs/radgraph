import _ from 'lodash'

import V,     { scripts as V_OPS  } from './V'
import Typed, { scripts as TV_OPS } from './Type'

const scripts = _.assign
  ( {}
  , V_OPS
  , TV_OPS
  )

export { scripts
       , V
       , Typed
       }
