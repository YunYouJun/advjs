// Build-time tokens for the home page's project explorer: every file of every story project in
// `stories/<story>/`. Markdown runs through the shared AdvScript grammar and each token is named
// by the palette role it matches, so the pane highlights exactly like docs code blocks and the
// editors; JSON settings get the key / string / number roles.
import type { SourceLines } from './source-roles'
import { readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHighlighter } from 'shiki'
import advGrammar from '../../../../../../packages/parser/syntaxes/adv.tmLanguage.json'
import { toSourceLines } from './source-roles'

export type { SourceLines, SourceToken } from './source-roles'

/** Story id → project-relative file path → highlighted lines. */
declare const data: Record<string, Record<string, SourceLines>>
export { data }

export default {
  watch: ['./stories/*/**', '../../../../../../packages/parser/syntaxes/*.json'],
  async load(): Promise<Record<string, Record<string, SourceLines>>> {
    const dir = fileURLToPath(new URL('./stories/', import.meta.url))
    const projects = (await readdir(dir, { withFileTypes: true }))
      .filter(entry => entry.isDirectory() && entry.name !== 'compiled')
      .map(entry => entry.name)
    const highlighter = await createHighlighter({
      langs: ['markdown', 'yaml', 'json', advGrammar as any],
      themes: ['github-dark'],
    })
    const tokenize = (source: string, lang: string): SourceLines => toSourceLines(highlighter.codeToTokens(source, {
      lang,
      theme: 'github-dark',
      includeExplanation: 'scopeName',
    }).tokens)
    try {
      return Object.fromEntries(await Promise.all(projects.map(async (project) => {
        const root = join(dir, project)
        const files = (await readdir(root, { recursive: true, withFileTypes: true })).filter(entry => entry.isFile())
        return [project, Object.fromEntries(await Promise.all(files.map(async (entry) => {
          const path = join(entry.parentPath, entry.name)
          const source = (await readFile(path, 'utf8')).trimEnd()
          return [relative(root, path), tokenize(source, path.endsWith('.json') ? 'json' : 'adv')]
        })))]
      })))
    }
    finally {
      highlighter.dispose()
    }
  },
}
