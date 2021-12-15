import type * as Adv from '@advjs/types'
import type * as Mdast from 'mdast'
import { parseText } from './syntax'

/**
 * 序列化类
 */
export class Serialize {
  /**
   * 解析
   */
  parse(child: Mdast.Content): Adv.AdvItem | undefined {
    let node: Adv.AdvItem | undefined
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

      default:
        break
    }
    return node
  }

  /**
   * 处理标题
   * @param text
   */
  heading(node: Mdast.Heading): Adv.Heading {
    const info: Adv.Heading = {
      ...node,
    }
    return info
  }

  /**
   * 处理引用块
   * @param text
   */
  blockquote(node: Mdast.Blockquote): Adv.Narration {
    const info: Adv.Narration = {
      type: 'narration',
      children: node.children.map(item => this.parse(item)),
    }
    return info
  }

  /**
   * 处理段落
   * @param text
   */
  paragraph(node: Mdast.Paragraph): Adv.Paragraph {
    const info: Adv.Paragraph = {
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
  text(node: Mdast.Text): Adv.Text | Adv.Dialog {
    return parseText(node)
  }
}
