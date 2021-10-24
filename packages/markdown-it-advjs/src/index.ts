import consola from 'consola'
import MarkdownIt from 'markdown-it'

const md = MarkdownIt()

const ast = md.parse('# markdown-it header', {})
consola.info(ast)
