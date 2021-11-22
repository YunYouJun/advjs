import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import rehypeStringify from 'rehype-stringify'

const commonUnified = unified()
  .use(remarkParse)
  .use(remarkFrontmatter)
  .use(remarkGfm)

export async function mdRender(content: string) {
  const file = await commonUnified
    .use(remarkRehype)
    .use(rehypeStringify)
    .process(content)
  return String(file)
}

/**
 * md 语法树
 * @param content
 * @returns
 */
export function mdParse(content: string) {
  const mdAst = commonUnified
    .parse(content)
  return mdAst
}
