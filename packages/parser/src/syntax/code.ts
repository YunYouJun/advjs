import yaml from 'js-yaml'
import type { AdvAst } from '@advjs/types'

/**
 * Parse AdvCode (js/ts)
 */
export const parseAdvCode = () => {

}

export const scriptSuffix = ['ts', 'js', 'typescript', 'javascript']

/**
 * advnode suffix & parse
 */
export const advNodeMap = [
  {
    suffix: ['advnode', 'json'],
    parse(val: string): AdvAst.CodeOperation[] {
      const data = JSON.parse(val)
      return Array.isArray(data) ? data : [data]
    },
  },
  {
    suffix: ['yml', 'yaml'],
    parse(val: string): AdvAst.CodeOperation[] {
      const data = yaml.load(val)
      return Array.isArray(data) ? data : [data]
    },
  },
]
