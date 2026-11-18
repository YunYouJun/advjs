import type { AdvAst, AdvProjectChapter, RuntimeProgram } from '@advjs/types'

/** `chapter#node` → the file and lines that produced it. */
export type StoryNodes = Record<string, { file: string, lines: number[] }>

/** Where a line of a chapter's joined source really lives (mirrors the compiler's own remap). */
function locate(line: number, sources: { path: string, content: string }[]) {
  for (const [index, file] of sources.entries()) {
    const count = file.content.split('\n').length
    if (line <= count || index === sources.length - 1)
      return { file: file.path, line }
    line -= count + 1
  }
  return { file: sources[0].path, line }
}

/**
 * Maps every compiled node back to its file and lines, for the project explorer. Node ids follow
 * each chapter's AST order (`node-<index>` unless the author named it). Blocks that compile to
 * no node of their own, such as `type: when`, belong to the next node.
 *
 * Shared by `scripts/home-stories.ts` (build time) and the AI mode (in the browser).
 */
export async function mapStoryNodes(options: {
  chapters: readonly AdvProjectChapter[]
  files: Readonly<Record<string, string>>
  program: RuntimeProgram
  parseAst: (source: string) => Promise<{ children: AdvAst.Child[] }>
}): Promise<StoryNodes> {
  const { chapters, files, program, parseAst } = options
  const nodes: StoryNodes = {}
  for (const chapter of chapters) {
    const sources = chapter.sources.map(path => ({ path, content: files[path] }))
    const ast = await parseAst(sources.map(s => s.content).join('\n\n'))
    const compiled = program.chapters[chapter.id]?.nodes ?? {}
    let carry: { file: string, line: number }[] = []
    ast.children.forEach((child: AdvAst.Child, index: number) => {
      const { start, end } = child.position ?? {}
      const own = start && end
        ? Array.from({ length: end.line - start.line + 1 }, (_, i) => locate(start.line + i, sources))
        : []
      const id = child.id ?? `node-${index}`
      if (!compiled[id]) {
        carry.push(...own)
        return
      }
      const lines = [...carry, ...own]
      // A node and its carried blocks always sit in one file; keep that file's lines.
      const file = own[0]?.file ?? lines[0]?.file
      nodes[`${chapter.id}#${id}`] = { file, lines: lines.filter(l => l.file === file).map(l => l.line) }
      carry = []
    })
  }
  return nodes
}
