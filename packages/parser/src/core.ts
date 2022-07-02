import type * as MdAst from 'mdast'
import type { AdvAst, AdvMarkdown } from '@advjs/types'
import matter from 'gray-matter'
import { mdParse } from './markdown'
import { Serialize } from './Serialize'
import { resolveConfig } from './config'
import { isScript } from './syntax'

// import { AdvItem } from '@advjs/types'

const serialize = new Serialize()

/**
 * 将 Markdown 语法树转译为 AdvScript
 */
export function convertMdToAdv(mdAst: MdAst.Root): AdvAst.Root {
  const ast: AdvAst.Root = {
    type: 'adv-root',
    functions: {},
    scene: {},
    children: [],
  }

  // 深度优先
  let i = 0
  mdAst.children.forEach((child) => {
    const advItem = parseChild(child)
    if (advItem) {
      ast.children.push(advItem)
      if (advItem.type === 'scene')
        ast.scene[advItem.place] = ast.children.length - 1
      // mount code function
      if (isScript(advItem)) {
        const name = `advFunc${i}`
        ast.functions[`advFunc${i}`] = advItem.value
        advItem.value = name
        i += 1
      }
      if (advItem.type === 'choices') {
        advItem.choices.forEach((choice) => {
          if (isScript(choice.do)) {
            const name = `advFunc${i}`
            ast.functions[`advFunc${i}`] = choice.do.value
            choice.do.value = name
            i += 1
          }
        })
      }
    }
  })

  return ast
}

export function parseChild(child: MdAst.Content) {
  const node = serialize.parse(child)
  return node
}

/**
 * parse markdown to ast
 * recommended: .adv.md
 * 将纯文本内容解析为语法树
 * @param content 文本内容
 */
export async function parseAst(content: string) {
  // const mdAst = md.parse(content, {})
  // return convertMdToAdv(mdAst)
  const mdAst = await mdParse(content)
  const advAst = convertMdToAdv(mdAst)
  return advAst
}

/**
 * parse adv.md config
 * @param markdown
 * @param filepath
 * @returns
 */
export function parse(markdown: string, filepath?: string): AdvMarkdown {
  const { data } = matter(markdown)

  const config = resolveConfig(data)

  return {
    raw: markdown,
    filepath,
    config,
    features: {
      babylon: data.type === '3d',
    },
    headmatter: data,
  }
}
