/* eslint-disable no-console, antfu/no-top-level-await -- SPIKE CLI script: top-level steps report to stdout. */
/**
 * SPIKE: build golden engine cases and their Node outputs.
 *
 * Node runs the engine facade from TypeScript sources; JavaScriptCore runs the
 * bundled engine.js. Both must return byte-identical response strings.
 *
 * Usage: pnpm exec tsx apps/studio-ios/spike/engine/golden.ts
 * Output: apps/studio-ios/spike/out/golden/{cases,expected,node-bundle}.json
 */
import type { AdvProjectCompileOptions, AdvProjectFileMap } from '@advjs/types'
import { createHash } from 'node:crypto'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { basename, relative, resolve, sep } from 'node:path'
import vm from 'node:vm'
import { loadProject } from '../../../../packages/advjs/node/project'
import { call } from './src/index'

interface GoldenCase {
  name: string
  operation: string
  input: string
}

const here = import.meta.dirname
const repoRoot = resolve(here, '../../../..')
const outDir = resolve(here, '../out/golden')
const cases: GoldenCase[] = []

function add(name: string, operation: string, input: unknown) {
  cases.push({ name, operation, input: JSON.stringify(input) })
}

async function walk(directory: string, filter: (path: string) => boolean): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory())
      return entry.name === 'node_modules' ? [] : walk(path, filter)
    return filter(path) ? [path] : []
  }))
  return nested.flat().sort()
}

async function addLoadedProject(name: string, root: string, options: AdvProjectCompileOptions) {
  const loaded = await loadProject({ root: resolve(repoRoot, root), ...options })
  add(`compile:${name}`, 'project.compile', { files: loaded.files, options })
  return loaded.files
}

/** Mirrors the CLI and Studio fallback for legacy `public/md/chapters/**` projects. */
async function addLegacyChapterProject(name: string, root: string, options: AdvProjectCompileOptions, gameConfig: Record<string, unknown> = {}) {
  const chaptersRoot = resolve(repoRoot, root, 'public/md/chapters')
  const paths = await walk(chaptersRoot, path => path.endsWith('.adv.md'))
  const files: AdvProjectFileMap = {
    'adv.config.json': JSON.stringify({ format: 'adv-md', root: './adv' }),
  }
  const chapters: Array<{ id: string, title: string, sources: string[] }> = []
  for (const path of paths) {
    const parts = relative(chaptersRoot, path).split(sep)
    const raw = parts.length > 1 ? parts[0] : basename(path, '.adv.md')
    const id = /^\d+$/u.test(raw) ? `chapter-${raw}` : raw.replace(/^\d+-/u, '')
    let chapter = chapters.find(item => item.id === id)
    if (!chapter) {
      chapter = { id, title: id, sources: [] }
      chapters.push(chapter)
    }
    const index = chapter.sources.length + 1
    files[`adv/chapters/${id}/${index}.adv.md`] = await readFile(path, 'utf8')
    chapter.sources.push(`chapters/${id}/${index}.adv.md`)
  }
  files['adv/settings/game.json'] = JSON.stringify({ ...gameConfig, chapters, entryChapterId: chapters[0]?.id })
  // Same options as `compileRuntimeChapterFiles`: legacy chapters carry no project character catalog.
  add(`compile:${name}`, 'project.compile', { files, options: { ...options, validateContentReferences: false } })
  for (const path of paths) {
    add(`ast:${name}/${relative(chaptersRoot, path)}`, 'chapter.parseAst', { content: await readFile(path, 'utf8') })
  }
}

async function addContentRoundTrips(root: string) {
  const types = [
    ['character', /\/characters\/[^/]+\.character\.md$/u],
    ['scene', /\/scenes\/[^/]+\.md$/u],
    ['location', /\/locations\/[^/]+\.md$/u],
    ['audio', /\/audio\/[^/]+\.md$/u],
    ['chapter', /\/chapters\/.+\.adv\.md$/u],
  ] as const
  const paths = await walk(resolve(repoRoot, root), path => path.endsWith('.md'))
  for (const path of paths) {
    const match = types.find(([, pattern]) => pattern.test(path))
    if (!match)
      continue
    const [type] = match
    const content = await readFile(path, 'utf8')
    const name = relative(repoRoot, path)
    add(`parse:${name}`, 'content.parse', { type, content, filename: basename(path) })
    const parsed = JSON.parse(await call('content.parse', JSON.stringify({ type, content, filename: basename(path) })))
    if (parsed.ok)
      add(`stringify:${name}`, 'content.stringify', { type, data: parsed.result })
  }
}

await addLoadedProject('golden-project', 'tests/launch/fixtures/golden-project', { staticAnalysis: true })
await addLoadedProject('diagnostics-valid', 'tests/fixtures/diagnostics/valid', { staticAnalysis: true })
await addLoadedProject('diagnostics-broken', 'tests/fixtures/diagnostics/broken', { staticAnalysis: true })
await addLoadedProject('flow-demo', 'demo/flow', { staticAnalysis: true, allowEmptyAssetManifest: true })
const hamsterFiles = await addLoadedProject('hamster-module-config', 'demo/hamster', {
  staticAnalysis: true,
  plugins: { 'star-map': '1.0.0', 'civilization': '1.0.0' },
})
await addLegacyChapterProject('hamster-public-md', 'demo/hamster', {
  plugins: { 'star-map': '1.0.0', 'civilization': '1.0.0' },
}, { requiredPlugins: { 'star-map': '1.0.0', 'civilization': '1.0.0' } })
await addLegacyChapterProject('starter-public-md', 'demo/starter', { staticAnalysis: true })

for (const root of ['demo/hamster/adv', 'tests/launch/fixtures/golden-project/adv', 'examples/ai-contest/life-story/adv', 'demo/flow/adv'])
  await addContentRoundTrips(root)

const manifest = JSON.parse(await readFile(resolve(repoRoot, 'demo/hamster/adv/assets.json'), 'utf8'))
add('assets:hamster-manifest', 'assets.normalizeManifest', { manifest })

const hamsterCharacter = Object.keys(hamsterFiles).find(path => path.endsWith('.character.md'))!
add('patch:hamster-character', 'project.applyPatches', {
  files: hamsterFiles,
  patches: [
    { kind: 'frontmatter-set', path: hamsterCharacter, key: 'name', value: '改名测试' },
    { kind: 'json-set', path: 'adv/settings/game.json', key: 'title', value: '仓鼠 · 金丝熊' },
  ],
})
for (const [name, text] of Object.entries({
  'empty': '',
  'ascii': 'ADV.JS',
  'cjk': '仓鼠的世界在一个笼子里。',
  'emoji': '🐹✨👩‍🚀',
  'lone-surrogate': 'bad\uD800end',
  'long': '章'.repeat(70000),
}))
  add(`host:digest-${name}`, 'host.digest', { text })
add('error:unknown-operation', 'project.nope', {})
add('error:invalid-json-input', 'project.compile', null)

await mkdir(outDir, { recursive: true })
const expected: Record<string, string> = {}
const timings: Record<string, number> = {}
for (const item of cases) {
  const started = performance.now()
  expected[item.name] = await call(item.operation, item.input)
  timings[item.name] = performance.now() - started
}

// Node + bundle: isolates bundler effects from runtime effects.
const bundle = await readFile(resolve(here, '../out/engine.js'), 'utf8')
const context = vm.createContext({ console })
vm.runInContext(bundle, context)
const bundled: Record<string, string> = {}
let bundleMismatches = 0
for (const item of cases) {
  bundled[item.name] = await context.AdvEngine.call(item.operation, item.input)
  if (bundled[item.name] !== expected[item.name])
    bundleMismatches++
}

const sha = (value: string) => createHash('sha256').update(value).digest('hex')
await writeFile(resolve(outDir, 'cases.json'), JSON.stringify(cases))
await writeFile(resolve(outDir, 'expected.json'), JSON.stringify(expected))
await writeFile(resolve(outDir, 'node-timings.json'), JSON.stringify(timings, null, 2))
const failures = Object.entries(expected).filter(([, value]) => !JSON.parse(value).ok).map(([name]) => name)
console.log(`cases: ${cases.length}`)
console.log(`cases.json sha256: ${sha(JSON.stringify(cases))}`)
console.log(`expected.json sha256: ${sha(JSON.stringify(expected))}`)
console.log(`node(source) vs node(bundle) mismatches: ${bundleMismatches}`)
console.log(`engine error responses (expected for error:* cases): ${failures.join(', ')}`)
for (const name of Object.keys(timings).filter(name => name.startsWith('compile:')))
  console.log(`  node ${name}: ${timings[name].toFixed(1)} ms, output ${(expected[name].length / 1024).toFixed(1)} KiB`)
