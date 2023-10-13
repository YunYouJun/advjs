import yaml from 'js-yaml'
import type { AdvAst } from '@advjs/types'

/**
 * Parse AdvCode (js/ts)
 */
export function parseAdvCode() {

}

export const scriptSuffix = ['ts', 'js', 'typescript', 'javascript']

/**
 * the script can be executed
 * @param node
 */
export function isScript(node?: AdvAst.Child): node is AdvAst.CodeFunction {
  return node ? (node.type === 'code' && scriptSuffix.includes(node.lang || '')) : false
}

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
