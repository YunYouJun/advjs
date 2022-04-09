import type { Content, Root } from 'mdast'
import type { AdvRoot } from '@advjs/types'
import { mdParse } from './markdown'
import { Serialize } from './Serialize'

// import { AdvItem } from '@advjs/types'

const serialize = new Serialize()

/**
 * 将 Markdown 语法树转译为 AdvScript
 */
export function convertMdToAdv(mdAst: Root) {
  const advAst: AdvRoot = {
    type: 'adv-root',
    children: [],
  }

  // 深度优先
  mdAst.children.forEach((child) => {
    const advItem = parseChild(child)
    if (advItem)
      advAst.children.push(advItem)
  })

  return advAst
}

export function parseChild(child: Content) {
  const node = serialize.parse(child)
  return node
}

/**
 * 将纯文本内容解析为语法树
 * @param content 文本内容
 */
export async function parse(content: string) {
  // const mdAst = md.parse(content, {})
  // return convertMdToAdv(mdAst)
  const mdAst = await mdParse(content)
  const advAst = convertMdToAdv(mdAst)
  return advAst
}
