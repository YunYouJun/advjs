import type * as Mdast from 'mdast'
import type { AdvAst } from '@advjs/types'

/**
 * 人物信息
 */
function toCharacter(text: string) {
  const leftBracket = ['(', '（']
  const rightBracket = [')', '）']

  const info: AdvAst.Character = {
    type: 'character',
    name: '',
    status: '',
  }

  for (let i = 0; i < leftBracket.length; i++) {
    if (!text.includes(leftBracket[i]))
      continue

    const re = new RegExp(`(.*)\\${leftBracket[i]}(.*?)\\${rightBracket[i]}`)
    const r = text.match(re)

    if (r) {
      info.name = r[1].trim()
      info.status = r[2].trim()
    }
  }

  if (!info.name)
    info.name = text.trim()

  return info
}

/**
 * 话语
 * @param text
 */
function toText(text: string) {
  const info: Mdast.Text = {
    type: 'text',
    value: text,
  }
  return info
}

/**
 * 是否为对话
 * @param text
 */
export function toDialog(text: string): AdvAst.Dialog | false {
  const info: AdvAst.Dialog = {
    type: 'dialog',
    character: {
      type: 'character',
      name: '',
      status: '',
    },
    children: [],
  }

  // 是否符合会话格式
  let pos = 0

  // @ Fountain语法

  if (text.startsWith('@'))
    pos = text.indexOf('\n')

  if (pos > 0) {
    const characterInfo = text.slice(1, pos)
    const content = text.slice(pos + 1)

    info.character = toCharacter(characterInfo)

    const words = content.split('\n')
    info.children = words.map(item => toText(item))

    return info
  }
  else {
    return false
  }
}
