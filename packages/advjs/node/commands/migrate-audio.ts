import type { AdvAssetManifest } from '@advjs/types'
import type * as Mdast from 'mdast'
import { Buffer } from 'node:buffer'
import { createHash, randomUUID } from 'node:crypto'
import { lstat, mkdir, open, readdir, readFile, realpath, rename, rm } from 'node:fs/promises'
import process from 'node:process'
import { advNodeMap, mdParse } from '@advjs/parser'
import { dirname, isAbsolute, relative, resolve } from 'pathe'
import { withProjectWriteLock } from '../project/write-lock'
import { AdvCommandError } from './errors'
import { readVoiceAssetManifest } from './voice-library'

interface MigrationSource {
  path: string
  sha256: string
  bytes: number
}

export interface AudioMigrationPatch extends MigrationSource {
  content: string
  targetSha256: string
  operations: Array<{ line: number, action: 'set' | 'clear', reference?: string, assetId?: string }>
}

export interface AudioMigrationReport {
  schemaVersion: 1
  root: string
  catalogPath: string
  catalogRevision: string
  mapping: Record<string, string>
  sources: MigrationSource[]
  patches: AudioMigrationPatch[]
  unresolved: Array<{ path: string, line?: number, code: string, message: string }>
  snapshots: 'unsupported'
  revision: string
}

export interface PlanAudioMigrationOptions {
  root?: string
  catalogPath?: string
  /** Exact old name/src to reviewed native catalog ID. No inferred mapping. */
  mapping?: Record<string, string>
}

const ignoredDirectories = new Set(['.git', '.advjs', '.nuxt', '.output', 'node_modules', 'dist', 'coverage'])
const hashPattern = /^[a-f0-9]{64}$/u
const maxSourceBytes = 16 * 1024 * 1024

function invalid(message: string): never {
  throw new AdvCommandError('ADV_VALIDATION', message)
}

function hash(value: string | Uint8Array): string {
  return createHash('sha256').update(value).digest('hex')
}

function object(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function canonical(value: unknown): string {
  const ordered = (item: unknown): unknown => Array.isArray(item)
    ? item.map(ordered)
    : object(item)
      ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b, 'en')).map(([key, child]) => [key, ordered(child)]))
      : item
  return JSON.stringify(ordered(value))
}

function projectPath(root: string, path: string): string {
  if (!path || isAbsolute(path) || /^[a-z]:[\\/]/iu.test(path) || path.includes('\\') || path.split('/').some(segment => !segment || segment === '.' || segment === '..'))
    invalid(`A migration path must be relative and remain inside the project: ${path}`)
  const target = resolve(root, path)
  const rel = relative(root, target)
  if (isAbsolute(rel) || rel === '..' || rel.startsWith('../'))
    invalid(`Migration path escapes the project: ${path}`)
  return target
}

/** Reject every symlink component, including links pointing back inside the project. */
async function safePath(root: string, path: string, file = true): Promise<string> {
  const target = projectPath(root, path)
  let current = root
  for (const segment of path.split('/')) {
    current = resolve(current, segment)
    const metadata = await lstat(current)
    if (metadata.isSymbolicLink())
      invalid(`Migration refuses symbolic links: ${path}`)
  }
  if (file && !(await lstat(target)).isFile())
    invalid(`Migration source is not a file: ${path}`)
  return target
}

async function catalog(root: string, path: string): Promise<AdvAssetManifest> {
  const target = await safePath(root, path)
  const source: unknown = JSON.parse(await readFile(target, 'utf8'))
  if (object(source) && Array.isArray(source.includes)) {
    for (const include of source.includes) {
      if (typeof include !== 'string')
        invalid('Native catalog includes must be relative paths')
      const fragment = relative(root, resolve(dirname(target), include))
      await safePath(root, fragment)
    }
  }
  return await readVoiceAssetManifest(root, path)
}

async function scriptFiles(root: string, unresolved: AudioMigrationReport['unresolved']): Promise<string[]> {
  const files: string[] = []
  const visit = async (directory: string) => {
    for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
      if (ignoredDirectories.has(entry.name))
        continue
      const absolute = resolve(directory, entry.name)
      const path = relative(root, absolute)
      if (entry.isSymbolicLink()) {
        const destination = await lstat(absolute).then(async () => await realpath(absolute)).catch(() => undefined)
        const isScript = /\.adv\.md$/iu.test(entry.name)
        const directoryLink = destination ? (await lstat(destination)).isDirectory() : true
        if (isScript || directoryLink)
          unresolved.push({ path, code: 'ADV_AUDIO_MIGRATION_UNSAFE_PATH', message: 'Symbolic-link script sources or directories require an explicit project-local source before migration' })
        continue
      }
      if (entry.isDirectory())
        await visit(absolute)
      else if (entry.isFile() && /\.adv\.md$/iu.test(entry.name))
        files.push(path)
    }
  }
  await visit(root)
  return files.sort()
}

function fencedBlocks(root: Mdast.Root): Mdast.Code[] {
  const blocks: Mdast.Code[] = []
  const visit = (node: Mdast.Root | Mdast.Content) => {
    if (node.type === 'blockquote')
      return
    if (node.type === 'code') {
      blocks.push(node)
      return
    }
    if ('children' in node)
      node.children.forEach(child => visit(child as Mdast.Content))
  }
  visit(root)
  return blocks
}

/** Build a deterministic, reviewable plan; this call never writes or downloads. */
export async function planAudioMigration(options: PlanAudioMigrationOptions = {}): Promise<AudioMigrationReport> {
  const root = await realpath(resolve(options.root ?? process.cwd()))
  const catalogPath = options.catalogPath ?? 'adv/assets.json'
  const manifest = await catalog(root, catalogPath)
  const mapping = options.mapping ?? {}
  if (!object(mapping) || Object.entries(mapping).some(([reference, assetId]) => !reference || typeof assetId !== 'string' || !assetId))
    invalid('Audio migration mapping must be an object of exact old references to native asset IDs')
  const assets = new Map(manifest.assets.map(asset => [asset.id, asset]))
  const report: AudioMigrationReport = { schemaVersion: 1, root, catalogPath, catalogRevision: hash(canonical(manifest)), mapping: structuredClone(mapping), sources: [], patches: [], unresolved: [], snapshots: 'unsupported', revision: '' }
  for (const path of await scriptFiles(root, report.unresolved)) {
    const bytes = await readFile(await safePath(root, path))
    const source: MigrationSource = { path, sha256: hash(bytes), bytes: bytes.byteLength }
    report.sources.push(source)
    const content = bytes.toString('utf8')
    if (bytes.byteLength > maxSourceBytes || !Buffer.from(content).equals(bytes)) {
      report.unresolved.push({ path, code: 'ADV_AUDIO_MIGRATION_INVALID_SOURCE', message: 'Migration requires UTF-8 script files no larger than 16 MiB' })
      continue
    }
    const edits: Array<{ start: number, end: number, content: string }> = []
    const operations: AudioMigrationPatch['operations'] = []
    for (const block of fencedBlocks(await mdParse(content))) {
      const parser = advNodeMap.find(item => item.suffix.includes(block.lang?.toLowerCase() ?? ''))
      if (!parser)
        continue
      let values: unknown[]
      try {
        values = parser.parse(block.value)
      }
      catch {
        report.unresolved.push({ path, line: block.position?.start.line, code: 'ADV_AUDIO_MIGRATION_PARSE_ERROR', message: 'Correct malformed JSON/YAML before audio migration' })
        continue
      }
      let changed = false
      let blocked = false
      const converted = values.map((value) => {
        if (!object(value) || value.type !== 'bgm' || !['name', 'src', 'stop'].some(key => key in value))
          return value
        const line = block.position?.start.line ?? 1
        const fail = (message: string) => {
          blocked = true
          report.unresolved.push({ path, line, code: 'ADV_AUDIO_MIGRATION_UNRESOLVED', message })
        }
        if (Object.keys(value).some(key => !['type', 'id', 'when', 'name', 'src', 'stop', 'loop', 'fade', 'gain'].includes(key))) {
          fail('Legacy BGM has additional fields that require a manual review')
          return value
        }
        if (value.stop !== undefined && typeof value.stop !== 'boolean') {
          fail('Legacy BGM stop must be a boolean')
          return value
        }
        if ((value.loop !== undefined && typeof value.loop !== 'boolean')
          || (value.gain !== undefined && (typeof value.gain !== 'number' || !Number.isFinite(value.gain) || value.gain < 0 || value.gain > 1))
          || (value.fade !== undefined && (!object(value.fade) || Object.keys(value.fade).some(key => !['in', 'out'].includes(key)) || Object.values(value.fade).some(timing => typeof timing !== 'number' || !Number.isFinite(timing) || timing < 0 || timing > 60_000)))) {
          fail('Legacy BGM loop, gain or fade requires correction before migration')
          return value
        }
        if (value.stop === true) {
          changed = true
          operations.push({ line, action: 'clear' })
          const fade = object(value.fade) && value.fade.out !== undefined ? { out: value.fade.out } : undefined
          return { type: 'bgm', action: 'clear', ...typeof value.id === 'string' ? { id: value.id } : {}, ...typeof value.when === 'string' ? { when: value.when } : {}, ...fade ? { fade } : {} }
        }
        const references = [value.name, value.src].filter(reference => reference !== undefined)
        if (references.length !== 1 || typeof references[0] !== 'string' || !references[0]) {
          fail('Legacy BGM needs one unambiguous name or src reference')
          return value
        }
        const reference = references[0]
        const assetId = Object.hasOwn(mapping, reference) ? mapping[reference] : undefined
        const asset = assetId ? assets.get(assetId) : undefined
        if (!asset || asset.type !== 'audio' || asset.kind !== 'bgm') {
          fail(`Exact reference ${JSON.stringify(reference)} has no reviewed mapping to a registered BGM audio asset`)
          return value
        }
        changed = true
        operations.push({ line, action: 'set', reference, assetId })
        const { name: _name, src: _src, stop: _stop, ...remaining } = value
        return { ...remaining, action: 'set', asset: assetId }
      })
      if (!changed || blocked)
        continue
      const start = block.position?.start.offset
      const end = block.position?.end.offset
      if (start === undefined || end === undefined)
        invalid('Markdown parser did not expose precise migration source offsets')
      const indent = ' '.repeat((block.position?.start.column ?? 1) - 1)
      const newline = content.includes('\r\n') ? '\r\n' : '\n'
      const replacement = ['```json', ...JSON.stringify(converted.length === 1 ? converted[0] : converted, null, 2).split('\n').map(line => `${indent}${line}`), `${indent}\`\`\``].join(newline)
      edits.push({ start, end, content: replacement })
    }
    let target = content
    for (const edit of edits.sort((a, b) => b.start - a.start))
      target = target.slice(0, edit.start) + edit.content + target.slice(edit.end)
    if (target !== content)
      report.patches.push({ ...source, content: target, targetSha256: hash(target), operations })
  }
  const { revision: _revision, ...data } = report
  report.revision = hash(canonical(data))
  return report
}

interface MigrationJournal {
  schemaVersion: 1
  root: string
  revision: string
  status: 'prepared' | 'applied' | 'rolled-back' | 'rollback-conflict'
  files: Array<{ path: string, original: string, sourceSha256: string, targetSha256: string }>
}

async function atomicWrite(path: string, content: string): Promise<void> {
  const temporary = `${path}.${randomUUID()}.advjs-tmp`
  try {
    const handle = await open(temporary, 'wx')
    try {
      await handle.writeFile(content)
      await handle.sync()
    }
    finally {
      await handle.close()
    }
    await rename(temporary, path)
  }
  finally {
    await rm(temporary, { force: true })
  }
}

async function journalPath(root: string, revision: string): Promise<string> {
  if (!hashPattern.test(revision))
    invalid('Migration recovery requires a SHA-256 report revision')
  let directory = root
  for (const segment of ['.advjs', 'audio-migrations', revision]) {
    directory = resolve(directory, segment)
    await mkdir(directory).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'EEXIST')
        throw error
    })
    if ((await lstat(directory)).isSymbolicLink() || !(await lstat(directory)).isDirectory())
      invalid('Migration journal directory must be project-local and cannot be a symlink')
  }
  return resolve(directory, 'journal.json')
}

async function rollback(root: string, journal: MigrationJournal): Promise<void> {
  const conflicts: string[] = []
  for (const file of [...journal.files].reverse()) {
    const path = await safePath(root, file.path)
    const current = hash(await readFile(path))
    if (current === file.sourceSha256)
      continue
    if (current !== file.targetSha256) {
      conflicts.push(file.path)
      continue
    }
    await atomicWrite(path, file.original)
  }
  journal.status = conflicts.length ? 'rollback-conflict' : 'rolled-back'
  await atomicWrite(await journalPath(root, journal.revision), `${JSON.stringify(journal, null, 2)}\n`)
  if (conflicts.length)
    invalid(`A migration recovery found external edits; preserved them for manual review: ${conflicts.join(', ')}`)
}

/** Apply only the exact plan after rechecking every source and catalog under the project lock. */
export async function applyAudioMigration(options: { root?: string, report: AudioMigrationReport, signal?: AbortSignal, onProgress?: (path: string) => void }): Promise<{ revision: string, applied: string[], journalPath: string }> {
  return await withProjectWriteLock(options.root ?? process.cwd(), async (root) => {
    const report = options.report
    if (!object(report) || report.schemaVersion !== 1 || report.root !== root || !hashPattern.test(report.revision) || !Array.isArray(report.unresolved) || report.unresolved.length)
      invalid('Audio migration apply requires a reviewed report for this project with no unresolved references')
    const { revision, ...data } = report
    if (hash(canonical(data)) !== revision)
      invalid('Audio migration report was modified after planning')
    const fresh = await planAudioMigration({ root, catalogPath: report.catalogPath, mapping: report.mapping })
    if (fresh.revision !== report.revision)
      invalid('A migration source or native catalog changed after review; generate a new report')
    options.signal?.throwIfAborted()
    const path = await journalPath(root, revision)
    const existing = await lstat(path).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT')
        throw error
      return undefined
    })
    if (existing)
      invalid('A migration journal already exists for this revision; inspect or recover it before replanning')
    const journal: MigrationJournal = { schemaVersion: 1, root, revision, status: 'prepared', files: [] }
    for (const patch of report.patches) {
      const original = await readFile(await safePath(root, patch.path), 'utf8')
      if (hash(original) !== patch.sha256 || Buffer.byteLength(original) !== patch.bytes)
        invalid(`Migration source changed before commit: ${patch.path}`)
      journal.files.push({ path: patch.path, original, sourceSha256: patch.sha256, targetSha256: patch.targetSha256 })
    }
    await atomicWrite(path, `${JSON.stringify(journal, null, 2)}\n`)
    try {
      for (const patch of report.patches) {
        options.signal?.throwIfAborted()
        const target = await safePath(root, patch.path)
        if (hash(await readFile(target)) !== patch.sha256)
          invalid(`Migration source changed during commit: ${patch.path}`)
        await atomicWrite(target, patch.content)
        options.onProgress?.(patch.path)
      }
      journal.status = 'applied'
      await atomicWrite(path, `${JSON.stringify(journal, null, 2)}\n`)
      return { revision, applied: report.patches.map(patch => patch.path), journalPath: relative(root, path) }
    }
    catch (error) {
      await rollback(root, journal)
      throw error
    }
  })
}

/** Recover an interrupted migration by comparing hashes; external edits are never overwritten. */
export async function recoverAudioMigration(options: { root?: string, revision: string }): Promise<{ revision: string, recovered: string[] }> {
  return await withProjectWriteLock(options.root ?? process.cwd(), async (root) => {
    const path = await journalPath(root, options.revision)
    await safePath(root, relative(root, path))
    const value: unknown = JSON.parse(await readFile(path, 'utf8'))
    if (!object(value) || value.schemaVersion !== 1 || value.root !== root || value.revision !== options.revision || !Array.isArray(value.files))
      invalid('Invalid audio migration recovery journal')
    const journal = value as unknown as MigrationJournal
    if (!['prepared', 'applied', 'rolled-back', 'rollback-conflict'].includes(journal.status))
      invalid('Invalid audio migration recovery status')
    if (journal.status === 'applied')
      invalid('This audio migration is already applied; recovery does not undo a completed migration')
    if (journal.status === 'rolled-back')
      return { revision: options.revision, recovered: [] }
    const paths = new Set<string>()
    for (const file of journal.files) {
      if (!object(file) || typeof file.path !== 'string' || typeof file.original !== 'string' || !hashPattern.test(file.sourceSha256) || !hashPattern.test(file.targetSha256) || hash(file.original) !== file.sourceSha256)
        invalid('Invalid audio migration journal source hashes')
      projectPath(root, file.path)
      if (paths.has(file.path))
        invalid('Duplicate migration journal source path')
      paths.add(file.path)
    }
    await rollback(root, journal)
    return { revision: options.revision, recovered: journal.files.map(file => file.path) }
  })
}

export async function readAudioMigrationInput(root: string, path: string): Promise<unknown> {
  const realRoot = await realpath(resolve(root))
  return JSON.parse(await readFile(await safePath(realRoot, path), 'utf8'))
}

/** Save an explicitly requested review artifact; dry-run planning itself remains read-only. */
export async function writeAudioMigrationReport(root: string, path: string, report: AudioMigrationReport): Promise<void> {
  await withProjectWriteLock(root, async (realRoot) => {
    const target = projectPath(realRoot, path)
    let parent = realRoot
    for (const segment of path.split('/').slice(0, -1)) {
      parent = resolve(parent, segment)
      await mkdir(parent).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== 'EEXIST')
          throw error
      })
      if ((await lstat(parent)).isSymbolicLink() || !(await lstat(parent)).isDirectory())
        invalid('Audio migration report directory must remain inside the project without symlinks')
    }
    const existing = await lstat(target).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT')
        throw error
      return undefined
    })
    if (existing)
      invalid('Migration report already exists; use a new review path to retain previous evidence')
    await atomicWrite(target, `${JSON.stringify(report, null, 2)}\n`)
  })
}
