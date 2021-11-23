import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import rehypeStringify from 'rehype-stringify'

// it will be frozen because use same processor.
// const commonUnified = unified()
//   .use(remarkParse)
//   .use(remarkFrontmatter)
//   .use(remarkGfm)

export async function mdRender(content: string) {
  const file = await unified()
    .use(remarkParse)
    .use(remarkFrontmatter)
    .use(remarkGfm)
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
  const mdAst = unified()
    .use(remarkParse)
    .use(remarkFrontmatter)
    .use(remarkGfm)
    .parse(content)
  return mdAst
}
