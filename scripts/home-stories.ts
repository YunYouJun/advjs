/**
 * Compiles the landing page stories. Each folder in
 * `docs/.vitepress/theme/components/home/data/stories/` is a small ADV.JS project
 * (`adv.config.json`, `adv/settings/game.json`, `adv/chapters/<chapter>/*.adv.md`, …) and goes
 * through `compileProject`, the same path `adv check` and `adv build` use. Each one is written to
 * `stories/compiled/<story>.json`: the RuntimeProgram, the chapters and their source files, the
 * initial variables, and the file and lines behind every node.
 *
 * Run after editing a story: `pnpm tsx scripts/home-stories.ts`
 */
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { parseAst } from '@advjs/parser'
import { mapStoryNodes } from '../docs/.vitepress/theme/components/home/data/story-map'
import { compileProject } from '../packages/core/src/project/compile'

const dir = join(dirname(fileURLToPath(import.meta.url)), '../docs/.vitepress/theme/components/home/data/stories')
const out = join(dir, 'compiled')

async function readTree(root: string): Promise<Record<string, string>> {
  const files: Record<string, string> = {}
  for (const entry of await readdir(root, { recursive: true, withFileTypes: true })) {
    if (entry.isFile()) {
      const path = join(entry.parentPath, entry.name)
      files[relative(root, path)] = await readFile(path, 'utf8')
    }
  }
  return files
}

let failed = false
await mkdir(out, { recursive: true })

for (const story of (await readdir(dir, { withFileTypes: true })).filter(d => d.isDirectory() && d.name !== 'compiled').map(d => d.name)) {
  const files = await readTree(join(dir, story))
  const { project, diagnostics } = await compileProject({ id: story, files })
  for (const diagnostic of diagnostics)
    console.error(`${story}/${diagnostic.path}:${diagnostic.line ?? '?'} ${diagnostic.severity} ${diagnostic.code} ${diagnostic.message}`)
  const program = project.program
  if (!program || diagnostics.some(d => d.severity === 'error')) {
    failed = true
    continue
  }

  const nodes = await mapStoryNodes({ chapters: project.chapters, files, program, parseAst })

  await writeFile(join(out, `${story}.json`), `${JSON.stringify({
    title: project.game.title,
    variables: project.game.variables ?? {},
    chapters: project.chapters.map(({ id, sources }) => ({ id, sources })),
    files: Object.keys(files).sort(),
    nodes,
    program,
  }, null, 2)}\n`)
  console.log(`${story}: ${project.chapters.length} chapters, ${Object.keys(nodes).length} nodes`)
}

if (failed)
  process.exitCode = 1
