/**
 * Generates the Endless Tram sample ride for visitors without a key: the same story session the
 * home page runs, driven from Node, picking choices at random. The run's project files are
 * written to `docs/.vitepress/theme/components/home/ai/samples/endless-tram/<locale>/`; read them
 * before committing.
 *
 *   DEEPSEEK_API_KEY=… pnpm tsx scripts/home-ai-sample.ts [zh|en] [stops=6]
 *
 * `AI_BASE_URL` and `AI_MODEL` switch to another OpenAI-compatible provider.
 */
import type { JsonObject, RuntimeChoice } from '@advjs/types'
import type { PlayerChoiceAction, StoryLocale } from '../packages/ai/src'
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { endlessTram } from '../docs/.vitepress/theme/components/home/ai/modes/endless-tram'
import { createStorySession } from '../packages/ai/src'
import { compileProject } from '../packages/core/src/project/compile'
import { createAdvRuntime } from '../packages/core/src/runtime/headless'

const home = join(dirname(fileURLToPath(import.meta.url)), '../docs/.vitepress/theme/components/home/ai')
const locale = (process.argv[2] ?? 'zh') as StoryLocale
const stops = Number(process.argv[3] ?? 6)
const apiKey = process.env.DEEPSEEK_API_KEY ?? process.env.AI_API_KEY

if (locale !== 'zh' && locale !== 'en')
  throw new Error(`Unknown locale "${locale}"; use zh or en`)
if (!apiKey)
  throw new Error('Set DEEPSEEK_API_KEY (or AI_API_KEY)')

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

const { 'fallback.adv.md': fallback, ...seedFiles } = await readTree(join(home, 'seeds/endless-tram', locale))
const session = createStorySession({
  mode: endlessTram,
  locale,
  projectId: `endless-tram-sample-${locale}`,
  seedFiles,
  fallback,
  chat: {
    baseURL: process.env.AI_BASE_URL ?? 'https://api.deepseek.com/v1',
    apiKey,
    model: process.env.AI_MODEL ?? 'deepseek-chat',
  },
  compile: compileProject,
})

const seed = await session.start()
let program = seed.program
let variables = (seed.result.project.game.variables ?? {}) as JsonObject
let at = program.entry

for (let i = 0; i < stops; i++) {
  // Play the open chapter to its choices and take one at random, as a visitor would.
  const runtime = createAdvRuntime({ program, initialVariables: variables })
  await runtime.go(at)
  while (runtime.current && runtime.current.kind !== 'choices')
    await runtime.next()
  const options = (runtime.current?.data?.options ?? []) as unknown as RuntimeChoice[]
  const choice = options[Math.floor(Math.random() * options.length)]
  await runtime.choose(choice.id)
  const action: PlayerChoiceAction = { kind: 'choice', chapterId: at.chapterId, choiceId: choice.id, label: choice.label }

  const started = Date.now()
  const segment = await session.generate(action, runtime.state.variables)
  const accepted = await session.accept(segment, action)
  console.log(`${segment.chapterId} ${segment.title} · ${((Date.now() - started) / 1000).toFixed(1)}s · attempts ${segment.attempts}${segment.fallback ? ' · fallback' : ''}`)
  for (const problem of segment.problems)
    console.log(`  rejected: ${problem.line ? `line ${problem.line}: ` : ''}${problem.message}`)
  program = accepted.program
  variables = accepted.variables
  at = accepted.entry
}

const out = join(home, 'samples/endless-tram', locale)
await rm(out, { recursive: true, force: true })
for (const [path, source] of Object.entries(session.files)) {
  await mkdir(dirname(join(out, path)), { recursive: true })
  await writeFile(join(out, path), source)
}
const { promptTokens, completionTokens, estimated } = session.usage
console.log(`Wrote ${relative(process.cwd(), out)} · ${estimated ? '~' : ''}${promptTokens} prompt + ${completionTokens} completion tokens`)
