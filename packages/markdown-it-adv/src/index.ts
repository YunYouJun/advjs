// import consola from 'consola'
import Token from 'markdown-it/lib/token'

// plugin for markdown-it
// export function advPlugin() {}

/**
 * 生成 ADV AST
 */
export function convertToAdv(mdAst: Token[]) {
  const advAst = mdAst.slice(2)
  return advAst
}
