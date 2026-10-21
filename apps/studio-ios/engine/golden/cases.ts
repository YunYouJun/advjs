/**
 * Golden cases for engine parity. Node runs the engine from TypeScript
 * sources to produce the expected responses; the bundled engine must return
 * byte-identical strings in a Node sandbox and in JavaScriptCore.
 */
import type { AdvProjectCompileOptions } from '@advjs/types'
import { readdir, readFile } from 'node:fs/promises'
import { basename, extname, relative, resolve, sep } from 'node:path'
import { loadProject } from '../../../../packages/advjs/node/project'
import { engineRoot, repoRoot } from '../workspace'

export interface GoldenCase {
  name: string
  operation: string
  /** Exact input string passed to `AdvEngine.call`. */
  input: string
}

export type EngineCall = (operation: string, input: string) => Promise<string>

const TEXT_EXTENSIONS = new Set(['.json', '.md', '.txt', '.yaml', '.yml'])
const SKIPPED_DIRECTORIES = new Set(['.git', 'dist', 'node_modules'])
const OFFICIAL_PLUGINS = { 'star-map': '1.0.0', 'civilization': '1.0.0' }

async function walk(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory())
      return SKIPPED_DIRECTORIES.has(entry.name) ? [] : walk(path)
    return [path]
  }))
  return nested.flat().sort()
}

/** Text files and every path of a project directory, like a native host snapshot. */
export async function readProjectSnapshot(root: string): Promise<{ files: Record<string, string>, paths: string[] }> {
  const absolute = resolve(repoRoot, root)
  const files: Record<string, string> = {}
  const paths: string[] = []
  for (const path of await walk(absolute)) {
    const projectPath = relative(absolute, path).split(sep).join('/')
    paths.push(projectPath)
    if (TEXT_EXTENSIONS.has(extname(path)))
      files[projectPath] = await readFile(path, 'utf8')
  }
  return { files, paths }
}

/** Collects cases; some inputs depend on earlier Node results (e.g. fixing reported issues). */
class CaseBook {
  readonly cases: GoldenCase[] = []
  constructor(readonly call: EngineCall) {}

  add(name: string, operation: string, input: unknown): void {
    this.cases.push({ name, operation, input: typeof input === 'string' ? input : JSON.stringify(input) })
  }

  async result(operation: string, input: unknown): Promise<any> {
    const response = JSON.parse(await this.call(operation, JSON.stringify(input)))
    if (!response.ok)
      throw new Error(`${operation} failed while building golden cases: ${response.error.code} ${response.error.message}`)
    return response.result
  }
}

async function addLoadedProject(book: CaseBook, name: string, root: string, options: AdvProjectCompileOptions) {
  const loaded = await loadProject({ root: resolve(repoRoot, root), ...options })
  book.add(`compile:${name}`, 'project.compile', { files: loaded.files, options })
  return loaded.files as Record<string, string>
}

async function addAuthoringProject(book: CaseBook, name: string, files: Record<string, string>, paths?: string[]) {
  book.add(`index:${name}`, 'project.index', { files, paths })
  book.add(`validate:${name}`, 'project.validate', { files, paths })
  book.add(`authoring:${name}`, 'project.authoringProgram', { files, paths })
}

async function addLegacyProject(book: CaseBook, name: string, root: string) {
  const chaptersRoot = resolve(repoRoot, root, 'public/md/chapters')
  const chapters: Record<string, string> = {}
  for (const path of (await walk(chaptersRoot)).filter(path => path.endsWith('.adv.md'))) {
    const relativePath = relative(chaptersRoot, path).split(sep).join('/')
    chapters[relativePath] = await readFile(path, 'utf8')
    book.add(`ast:${name}/${relativePath}`, 'chapter.parseAst', { content: chapters[relativePath] })
  }
  const input = { chapters, requiredPlugins: OFFICIAL_PLUGINS }
  book.add(`legacy:${name}`, 'project.legacyChapters', input)
  const project = await book.result('project.legacyChapters', input)
  book.add(`compile:${name}`, 'project.compile', {
    files: project.files,
    options: { validateContentReferences: false, staticAnalysis: true },
  })
}

const CONTENT_PATTERNS = [
  ['character', /\/characters\/[^/]+\.character\.md$/u],
  ['scene', /\/scenes\/[^/]+\.md$/u],
  ['location', /\/locations\/[^/]+\.md$/u],
  ['audio', /\/audio\/[^/]+\.md$/u],
  ['chapter', /\/chapters\/.+\.adv\.md$/u],
] as const

/** A small, deterministic author edit for each content type. */
function editContent(type: string, data: Record<string, any>): Record<string, any> {
  switch (type) {
    case 'chapter': return { ...data, title: `${data.title}（修订）` }
    case 'audio': return { ...data, duration: (data.duration ?? 0) + 1, tags: [...(data.tags ?? []), 'edited'] }
    case 'character': return { ...data, name: `${data.name}（修订）`, personality: '改写后的性格。' }
    default: return { ...data, name: `${data.name}（修订）`, tags: [...(data.tags ?? []), 'edited'] }
  }
}

async function addContentRoundTrips(book: CaseBook, root: string) {
  const paths = (await walk(resolve(repoRoot, root))).filter(path => path.endsWith('.md'))
  for (const path of paths) {
    const match = CONTENT_PATTERNS.find(([, pattern]) => pattern.test(path))
    if (!match)
      continue
    const [type] = match
    const content = await readFile(path, 'utf8')
    const name = relative(repoRoot, path).split(sep).join('/')
    const parseInput = { type, content, filename: basename(path) }
    book.add(`parse:${name}`, 'content.parse', parseInput)
    const response = JSON.parse(await book.call('content.parse', JSON.stringify(parseInput)))
    if (!response.ok)
      continue
    const data = response.result
    if (type !== 'chapter')
      book.add(`stringify:${name}`, 'content.stringify', { type, data })
    book.add(`stringify-unchanged:${name}`, 'content.stringify', { type, data, source: content })
    book.add(`stringify-edited:${name}`, 'content.stringify', { type, data: editContent(type, data), source: content })
  }
}

export async function createGoldenCases(call: EngineCall): Promise<GoldenCase[]> {
  const book = new CaseBook(call)
  book.add('info', 'engine.info', {})

  // Whole projects compiled the way the CLI loads them from disk.
  const golden = await addLoadedProject(book, 'golden-project', 'tests/launch/fixtures/golden-project', { staticAnalysis: true })
  await addAuthoringProject(book, 'golden-project', golden)
  await addLoadedProject(book, 'diagnostics-valid', 'tests/fixtures/diagnostics/valid', { staticAnalysis: true })
  await addLoadedProject(book, 'diagnostics-broken', 'tests/fixtures/diagnostics/broken', { staticAnalysis: true })
  await addLoadedProject(book, 'flow-demo', 'demo/flow', { staticAnalysis: true, allowEmptyAssetManifest: true })
  const hamster = await addLoadedProject(book, 'hamster-module-config', 'demo/hamster', { staticAnalysis: true, plugins: OFFICIAL_PLUGINS })
  await addLegacyProject(book, 'hamster-public-md', 'demo/hamster')
  await addLegacyProject(book, 'starter-public-md', 'demo/starter')

  // The engine's own fixture: unknown fields, bodies, tachies, relationships, includes.
  const roundTrip = await readProjectSnapshot(relative(repoRoot, resolve(engineRoot, 'fixtures/round-trip')))
  book.add('compile:round-trip', 'project.compile', { files: roundTrip.files, options: { staticAnalysis: true } })
  await addAuthoringProject(book, 'round-trip', roundTrip.files, roundTrip.paths)
  book.add('authoring-override:round-trip', 'project.authoringProgram', {
    files: roundTrip.files,
    paths: roundTrip.paths,
    override: { file: 'adv/chapters/one.adv.md', content: '# One {#start}\n\n- [Broken](missing#ending)\n' },
  })
  book.add('player:round-trip', 'project.playerConfig', { files: roundTrip.files, baseUrl: 'advjs-player://project/' })
  book.add('manifest:round-trip', 'assets.readManifest', { files: roundTrip.files })
  const validation = await book.result('project.validate', { files: roundTrip.files, paths: roundTrip.paths })
  book.add('fix:round-trip', 'project.fixReferences', { files: roundTrip.files, issues: validation.issues })
  book.add('patch:round-trip', 'project.applyPatches', {
    files: roundTrip.files,
    patches: [
      { kind: 'frontmatter-set', path: 'adv/characters/xiaoyun.character.md', key: 'name', value: '小云改' },
      { kind: 'json-set', path: 'adv/settings/game.json', key: 'title', value: '往返样例 · 修订' },
    ],
  })

  // New projects, slugs and portable packages.
  book.add('templates', 'project.templates', {})
  const templates = await book.result('project.templates', {})
  for (const templateId of [...templates.templates, templates.quickStart, 'unknown-template'])
    book.add(`template:${templateId}`, 'project.fromTemplate', { templateId, name: '星海 Story 1' })
  for (const [name, text] of Object.entries({ mixed: '  My 星海_Story  !! ', kana: 'ひかり の 物語', symbols: '***', empty: '' }))
    book.add(`slug:${name}`, 'project.slug', { name: text })
  const exportedAt = '2026-10-21T00:00:00.000Z'
  book.add('package:round-trip', 'package.plan', { files: roundTrip.files, paths: roundTrip.paths, name: '往返样例', exportedAt })
  book.add('package:golden-project', 'package.plan', { files: golden, paths: Object.keys(golden), name: 'Golden', exportedAt })
  book.add('package:hamster', 'package.plan', { files: hamster, paths: Object.keys(hamster), name: '仓鼠', exportedAt })
  book.add('package-inspect:valid', 'package.inspect', {
    manifest: JSON.stringify({ name: '往返样例', version: '1.0.0', exportedAt, stats: {} }),
    paths: ['adv/chapters/one.adv.md', '../escape.md', '/absolute.md', 'adv/.git/config', 'adv\\windows.md', 'C:/drive.md', 'adv//empty.md'],
  })
  book.add('error:package-manifest-missing', 'package.inspect', { paths: [] })
  book.add('error:package-manifest-json', 'package.inspect', { manifest: '{"name":' })
  book.add('error:package-manifest-fields', 'package.inspect', { manifest: '{"name":"x"}' })

  for (const root of ['apps/studio-ios/engine/fixtures/round-trip/adv', 'demo/hamster/adv', 'tests/launch/fixtures/golden-project/adv', 'examples/ai-contest/life-story/adv', 'demo/flow/adv'])
    await addContentRoundTrips(book, root)

  book.add('manifest:hamster', 'assets.normalizeManifest', {
    manifest: JSON.parse(await readFile(resolve(repoRoot, 'demo/hamster/adv/assets.json'), 'utf8')),
  })
  const hamsterCharacter = Object.keys(hamster).find(path => path.endsWith('.character.md'))!
  book.add('patch:hamster-character', 'project.applyPatches', {
    files: hamster,
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
    book.add(`host:${name}`, 'host.selfTest', { text })

  // Error envelopes must not leak engine-specific exception text.
  book.add('error:unknown-operation', 'project.nope', {})
  book.add('error:prototype-operation', 'toString', {})
  book.add('error:invalid-json', 'project.compile', '{"files":')
  book.add('error:non-object', 'project.compile', null)
  book.add('error:array', 'project.compile', [])
  book.add('error:missing-files', 'project.compile', {})
  book.add('error:file-not-text', 'project.index', { files: { 'adv.config.json': 1 } })
  book.add('error:content-type', 'content.parse', { type: 'diagram', content: '' })
  book.add('error:content-invalid', 'content.parse', { type: 'scene', content: '---\nname: no id\n---\n' })
  book.add('error:yaml-invalid', 'content.parse', { type: 'location', content: '---\nid: [unclosed\n---\n' })
  book.add('error:project-format', 'project.index', { files: { 'adv.config.json': '{"format":"unknown"}' } })
  book.add('error:game-settings', 'project.validate', { files: { 'adv/settings/game.json': '{"title":1}' } })

  return book.cases
}

/** Run cases sequentially and collect response strings by name. */
export async function runGoldenCases(call: EngineCall, cases: readonly GoldenCase[]): Promise<Record<string, string>> {
  const results: Record<string, string> = {}
  for (const item of cases)
    results[item.name] = await call(item.operation, item.input)
  return results
}
