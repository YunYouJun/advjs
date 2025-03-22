// transformers
// https://github.com/unifiedjs/unified#function-transformernode-file-next
// transformer will show when use process instead of parse

import { consola } from 'consola'

/**
 * remark plugin
 */
export function remarkAdv(options = {}) {
  const defaultOptions = {}
  const opts = {
    ...defaultOptions,
    ...options,
  }
  consola.log(opts)

  function transformer(node: any) {
    consola.log(node)
    node.position = null
    return []
  }

  return transformer
}
