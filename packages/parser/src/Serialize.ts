import type { AdvAst } from '@advjs/types'
import type * as Mdast from 'mdast'

import { parseText } from './syntax'
import { advNodeMap, parseAdvCode, scriptSuffix } from './syntax/code'

/**
 * 序列化类
 */
export class Serialize {
  /**
   * 解析
   */
  parse(child: Mdast.Content): AdvAst.Item | undefined {
    let node: AdvAst.Item | undefined
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
      case 'list':
        node = this.list(child)
        break
      default:
        break
    }
    if (node)
      return node
  }

  /**
   * 处理标题
   */
  heading(node: Mdast.Heading): AdvAst.Heading {
    const info: AdvAst.Heading = {
      ...node,
    }
    return info
  }

  /**
   * 处理引用块
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
    for (const item of advNodeMap) {
      if (scriptSuffix.includes(lang)) {
        info.value = node.value
        return info
      }
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
   */
  paragraph(node: Mdast.Paragraph) {
    if (node.children.length === 1 && node.children[0].type === 'text')
      return this.text(node.children[0])

    // parse 'character: some words'
    let astNode: AdvAst.Child = { type: 'unknown' }
    if (node.children[0].type === 'text')
      astNode = this.text(node.children[0])

    if (astNode.type === 'dialog') {
      const dialogChildren = astNode.children
      if (node.children.length > 1) {
        node.children.slice(1).forEach((child) => {
          dialogChildren.push(this.parse(child) as AdvAst.PhrasingContent)
        })
      }
    }
    return astNode
  }

  /**
   * 处理文本
   * 更多的扩展语法在此实现（从普通的段落文本中进行解析）
   */
  text(node: Mdast.Text) {
    return parseText(node)
  }

  /**
   * handle list for choice
   * - [x] xxx
   */
  list(node: Mdast.List): AdvAst.Choices | undefined {
    // todo
    const advNode: AdvAst.Choices = {
      type: 'choices',
      choices: [],
    }

    for (const item of node.children) {
      if (item.type !== 'listItem')
        return
      if (item.children.length) {
        const choice: AdvAst.Choice = {
          type: 'choice',
          text: '',
          do: {
            type: 'code',
            value: '',
          },
        }
        if (item.children[0].type === 'paragraph') {
          const text = (item.children[0].children[0] as Mdast.Text).value
          // const do = 'advFunc'
          choice.text = text
        }
        if (item.children[1]?.type === 'code')
          choice.do = item.children[1]

        advNode.choices.push(choice)
      }
    }

    return advNode
  }
}
