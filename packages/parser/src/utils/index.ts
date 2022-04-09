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
    if (!text.includes(leftBracket[i]))
      continue

    const re = new RegExp(`(.*)${leftBracket[i]}(.*?)${rightBracket[i]}`)
    const r = text.match(re)

    if (r) {
      info.name = r[1]
      info.status = r[2]
    }
  }

  if (!info.name)
    info.name = text

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

  // 语法类型
  let syntaxType: 'at' | 'delimiter' | '' = ''

  // 是否符合会话格式
  let isDialog = false
  let pos = 0

  // @ Fountain语法

  if (text.startsWith('@'))
    pos = text.indexOf(' ')
  if (pos > 0) {
    isDialog = true
    syntaxType = 'at'
  }

  // 分隔符语法，若已匹配 @ 语法，则跳过
  if (!isDialog) {
    const delimiters = [':', '：']
    delimiters.some((delimiter) => {
      pos = text.indexOf(delimiter)
      return pos > -1
    })
    isDialog = (pos > 0)
    if (pos > 0) {
      isDialog = true
      syntaxType = 'delimiter'
    }
  }

  if (isDialog) {
    const characterInfo = text.slice((syntaxType === 'at') ? 1 : 0, pos)
    info.character = toCharacter(characterInfo)

    const words = text.slice(pos + 1).split('\n')
    info.children = words.map(item => toText(item))

    return info
  }
  else {
    return false
  }
}
