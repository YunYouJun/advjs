// import { unified } from 'unified'
// import remarkParse from 'remark-parse'
// import remarkFrontmatter from 'remark-frontmatter'
// import remarkGfm from 'remark-gfm'
// import remarkRehype from 'remark-rehype'
// import rehypeStringify from 'rehype-stringify'

// const { unified } = await import('unified')
// const { default: remarkParse } = await import('remark-parse')
// const { default: remarkFrontmatter } = await import('remark-frontmatter')
// const { default: remarkGfm } = await import('remark-gfm')
// const { default: remarkRehype } = await import('remark-rehype')
// const { default: rehypeStringify } = await import('rehype-stringify')

// it will be frozen because use same processor.
// const commonUnified = unified()
//   .use(remarkParse)
//   .use(remarkFrontmatter)
//   .use(remarkGfm)

import type { Root } from 'mdast'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import rehypeStringify from 'rehype-stringify'

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
 */
export async function mdParse(content: string): Promise<Root> {
  const mdAst = unified()
    .use(remarkParse)
    .use(remarkFrontmatter)
    .use(remarkGfm)
    .parse(content)
  return mdAst
}
