import type * as Adv from '@advjs/types'
import type * as Mdast from 'mdast'

/**
 * 人物信息
 */
function toCharacter(text: string) {
  const leftBracket = ['(', '（']
  const rightBracket = [')', '）']

  const info: Adv.Character = {
    type: 'character',
    name: '',
    status: '',
  }

  for (let i = 0; i < leftBracket.length; i++) {
    if (!text.includes(leftBracket[i])) continue

    const re = new RegExp(`(.*)${leftBracket[i]}(.*?)${rightBracket[i]}`)
    const r = text.match(re)

    if (r) {
      info.name = r[1]
      info.status = r[2]
    }
  }

  if (!info.name) info.name = text

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
export function toDialog(text: string): Adv.Dialog | false {
  const info: Adv.Dialog = {
    type: 'dialog',
    character: {
      type: 'character',
      name: '',
      status: '',
    },
    children: [],
  }

  const delimiters = [':', '：']
  let pos = 0
  delimiters.some((delimiter) => {
    pos = text.indexOf(delimiter)
    return pos > -1
  })

  if (pos > 0) {
    const characterInfo = text.slice(0, pos)
    info.character = toCharacter(characterInfo)

    const words = text.slice(pos + 1)
    info.children.push(toText(words))

    return info
  }
  else {
    return false
  }
}
