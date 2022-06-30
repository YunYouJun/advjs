import type { AdvAst } from '@advjs/types'
import type Mdast from 'mdast'
import { toDialog } from '../utils'
import { parseNarration, parseScene } from './parse'

export * from './code'

/**
 * 解析纯文本，实现扩展语法
 */
export function parseText(node: Mdast.Text) {
  const textValue = node.value

  const scene = parseScene(textValue)
  if (scene)
    return scene

  const narration = parseNarration(textValue)
  if (narration)
    return narration

  const dialog = toDialog(textValue)
  if (dialog)
    return dialog

  const simpleNode: AdvAst.Text = {
    type: 'text',
    value: node.value,
  }
  return simpleNode
}
