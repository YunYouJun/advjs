// import consola from 'consola'
import MarkdownIt from 'markdown-it'
import Token from 'markdown-it/lib/token'

const md = MarkdownIt()

// plugin for markdown-it
export function advPlugin() {
  const mdAst = md.parse('# markdown-it header', {})
  const advAst = convertToAdv(mdAst)
  return advAst
}

/**
 * 生成 ADV AST
 */
export function convertToAdv(mdAst: Token[]) {
  const advAst = mdAst.slice(2)
  return advAst
}
