import _ from 'lodash'

import V, { scripts as VScripts } from './V'

const scripts = _.assign
  ( {}
  , VScripts
  )

export { scripts
       , V
       }
