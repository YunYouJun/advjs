import type { AdvAst } from '@advjs/types'
import type * as Mdast from 'mdast'

import { parseText } from './syntax'
import { codeMap, parseAdvCode } from './syntax/code'

/**
 * 序列化类
 */
export class Serialize {
  /**
   * 解析
   */
  parse(child: Mdast.Content): AdvAst.Item | undefined {
    let node: AdvAst.Item| undefined
    switch (child.type) {
      case 'blockquote':
        node = this.blockquote(child)
        break
      case 'paragraph':
        node = this.paragraph(child)
        break
      case 'text':
        node = this.text(child)
        break
      case 'code':
        node = this.code(child)
        break

      default:
        break
    }
    return node
  }

  /**
   * 处理标题
   * @param text
   */
  heading(node: Mdast.Heading): AdvAst.Heading {
    const info: AdvAst.Heading = {
      ...node,
    }
    return info
  }

  /**
   * 处理引用块
   * @param text
   */
  blockquote(node: Mdast.Blockquote): AdvAst.Narration {
    const info: AdvAst.Narration = {
      type: 'narration',
      children: node.children.map((item) => {
        return ((item as Mdast.Paragraph).children[0] as Mdast.Text).value
      }),
    }
    return info
  }

  /**
   * 处理代码块
   * @param node
   */
  code(node: Mdast.Code) {
    const info: AdvAst.Code = {
      type: 'code',
      lang: node.lang || '',
      meta: node.meta || '',
      value: null,
    }

    if (!node.lang)
      return

    const lang = node.lang.toLowerCase()

    // advnode suffix
    for (const item of codeMap) {
      if (item.suffix.includes(lang)) {
        info.lang = 'advnode'
        info.value = item.parse(node.value)
        return info
      }
    }

    const advSuffix = ['adv', 'advscript']
    if (advSuffix.includes(lang)) {
      // handle script
      parseAdvCode()
    }

    return info
  }

  /**
   * 处理段落
   * @param text
   */
  paragraph(node: Mdast.Paragraph) {
    if (node.children.length === 1 && node.children[0].type === 'text')
      return this.text(node.children[0])

    const info: AdvAst.Paragraph = {
      type: 'paragraph',
      children: node.children.map((child) => {
        const item: any = {
          type: child.type,
        }
        if (child.type === 'text')
          return this.text(child)

        return item
      }),
    }
    return info
  }

  /**
   * 处理文本
   * 更多的扩展语法在此实现（从普通的段落文本中进行解析）
   * @param text
   * @returns
   */
  text(node: Mdast.Text) {
    return parseText(node)
  }
}
