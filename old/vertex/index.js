import _ from 'lodash'
import { scripts as simpleScripts } from './Simple'

export const scripts = _.assign
  ( {}
  , simpleScripts
  )

export { default as SimpleVertex } from './Simple'
export { default as KeyValuePair } from './Key'
