import { Root } from 'mdast'
import { AdvRoot } from '@advjs/types'
import { mdParse } from './markdown'

// import { AdvItem } from '@advjs/types'

/**
 * 将 Markdown 语法树转译为 AdvScript
 */
export function convertMdToAdv(mdAst: Root) {
  const advAst: AdvRoot = {
    type: 'adv-root',
    children: [],
  }

  // const serialize = new Serialize()
  for (let i = 0; i < mdAst.length; i++) {
    const node = mdAst[i]
    advAst.children?.push(node)
    //   //   if (token.text) token.text = token.text.trim()

    //   //   let advObject
    //   //   switch (token.type) {
    //   //     case 'blockquote':
    //   //       advObject = serialize.blockquote(token.text)
    //   //       break
    //   //     case 'heading':
    //   //       advObject = serialize.heading(token)
    //   //       break
    //   //     case 'paragraph':
    //   //       advObject = serialize.paragraph(token.text)
    //   //       break

    //   //     default:
    //   //       advObject = token
    //   //       break
    //   //   }
    //   //   advTokens.push(advObject)
  }
  return advAst
}

/**
 * 将纯文本内容解析为语法树
 * @param content 文本内容
 */
export function parse(content: string) {
  // const mdAst = md.parse(content, {})
  // return convertMdToAdv(mdAst)
  const mdAst = mdParse(content)
  const advAst = convertMdToAdv(mdAst)
  return advAst
}
