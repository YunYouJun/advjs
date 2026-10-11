import type { AdvProjectCompileOptions, AdvProjectCompileResult, AdvProjectDiagnostic, AdvProjectFileMap } from '@advjs/types'
import type { FlowEditDocument } from './flow-edit'
import { compileProject } from './compile'
import { FlowEditError, isFlowEditRecord, parseFlowDocument, serializeFlowDocument } from './flow-edit'

export interface FlowProjectFileChange { path: string, expected: string | null, content: string | null }
export interface FlowAuthoringPort {
  readFiles: () => Promise<AdvProjectFileMap>
  /** Host applies all comparisons atomically under its native project write lock. */
  writeFiles: (changes: FlowProjectFileChange[]) => Promise<unknown>
  compileOptions?: AdvProjectCompileOptions
}
export interface FlowAuthoringSnapshot { path: string, content: string | null, document: FlowEditDocument, revision: string }
export interface FlowEditValidation { diagnostics: AdvProjectDiagnostic[], valid: boolean, compilation: AdvProjectCompileResult }

export async function flowDocumentRevision(content: string | null): Promise<string> {
  const bytes = new TextEncoder().encode(content === null ? 'absent:' : `present:${content}`)
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('')
}

function assertPath(path: string) {
  if (path.startsWith('/') || /^[a-z]:/iu.test(path) || path.includes('\\') || !path.endsWith('.chapter.json')
    || path.split('/').some(part => !part || ['.', '..', '.git', 'node_modules'].includes(part))) {
    throw new FlowEditError('ADV_FLOW_INVALID_PATH', 'Expected canonical relative .chapter.json path')
  }
}

export async function validateFlowEdit(input: { files: AdvProjectFileMap, path: string, document: FlowEditDocument, options?: AdvProjectCompileOptions }): Promise<FlowEditValidation> {
  assertPath(input.path)
  const compilation = await compileProject({ files: { ...input.files, [input.path]: serializeFlowDocument(input.document) } }, { allowEmptyAssetManifest: true, staticAnalysis: true, ...input.options })
  if (compilation.project.format !== 'flow' || !compilation.sourceMap.chapters[input.document.id]?.includes(input.path)) {
    compilation.diagnostics.push({ code: 'ADV_FLOW_SOURCE_NOT_INCLUDED', severity: 'error', message: 'This chapter must be declared as a native Flow source or discovered under the project chapters directory', path: input.path })
  }
  return { compilation, diagnostics: compilation.diagnostics, valid: !compilation.diagnostics.some(issue => issue.severity === 'error') }
}

export interface FlowChapterCreationPlan { files: AdvProjectFileMap, changes: FlowProjectFileChange[] }

/** A new native chapter and its explicit source declaration are one transaction. */
export async function planFlowChapterCreation(input: { files: AdvProjectFileMap, path: string, document: FlowEditDocument, options?: AdvProjectCompileOptions }): Promise<FlowChapterCreationPlan> {
  assertPath(input.path)
  if (Object.hasOwn(input.files, input.path))
    throw new FlowEditError('ADV_FLOW_FILE_EXISTS', 'Chapter file already exists')
  const base = await compileProject({ files: input.files }, { allowEmptyAssetManifest: true, ...input.options })
  const root = base.project.root
  if (base.project.format !== 'flow' || !input.path.startsWith(`${root}/chapters/`))
    throw new FlowEditError('ADV_FLOW_INVALID_PATH', 'Create a chapter inside this native Flow project chapters directory')
  if (base.project.chapters.some(chapter => chapter.id === input.document.id))
    throw new FlowEditError('ADV_FLOW_CHAPTER_EXISTS', 'Chapter ID is already declared in this project')
  const content = serializeFlowDocument(input.document)
  const changes: FlowProjectFileChange[] = [{ path: input.path, expected: null, content }]
  const gamePath = base.sourceMap.gameConfig ?? `${root}/settings/game.json`
  const original = input.files[gamePath] ?? null
  let game: unknown
  try {
    game = original === null ? {} : JSON.parse(original)
  }
  catch { throw new FlowEditError('ADV_FLOW_GAME_CONFIG_INVALID', 'Game settings must contain valid JSON before creating a chapter') }
  if (!isFlowEditRecord(game))
    throw new FlowEditError('ADV_FLOW_GAME_CONFIG_INVALID', 'Game settings must contain an object')
  let changed = false
  if (Array.isArray(game.chapters) && game.chapters.length) {
    // Preserve inline chapters, source order and all existing author metadata.
    game.chapters.push({ id: input.document.id, title: input.document.title, sources: [input.path.slice(root.length + 1)] })
    changed = true
  }
  if (game.entryChapterId === undefined && base.project.entryChapterId) {
    // Discovery sorting must not accidentally change the story's existing entry.
    game.entryChapterId = base.project.entryChapterId
    changed = true
  }
  if (changed)
    changes.push({ path: gamePath, expected: original, content: `${JSON.stringify(game, null, 2)}\n` })
  const files = { ...input.files, ...Object.fromEntries(changes.map(change => [change.path, change.content!])) }
  return { files, changes }
}

/** Native JSON protocol reused by Editor and Studio; CAS failure leaves callers' drafts untouched. */
export function createFlowAuthoringService(port: FlowAuthoringPort) {
  async function read(path: string): Promise<FlowAuthoringSnapshot> {
    assertPath(path)
    const files = await port.readFiles()
    const content = files[path]
    if (content === undefined)
      throw new FlowEditError('ADV_FLOW_FILE_NOT_FOUND', `Chapter not found: ${path}`)
    return { path, content, document: parseFlowDocument(content), revision: await flowDocumentRevision(content) }
  }
  async function validate(input: { path: string, document: FlowEditDocument }) {
    return validateFlowEdit({ ...input, files: await port.readFiles(), options: port.compileOptions })
  }
  async function validateCreate(input: { path: string, document: FlowEditDocument }) {
    const plan = await planFlowChapterCreation({ ...input, files: await port.readFiles(), options: port.compileOptions })
    return { ...await validateFlowEdit({ ...input, files: plan.files, options: port.compileOptions }), changes: plan.changes }
  }
  async function commit(input: { path: string, document: FlowEditDocument, expectedRevision: string }, create: boolean): Promise<FlowAuthoringSnapshot> {
    assertPath(input.path)
    const files = await port.readFiles()
    const current = files[input.path] ?? null
    if (await flowDocumentRevision(current) !== input.expectedRevision)
      throw new FlowEditError('ADV_FLOW_SOURCE_CONFLICT', 'Source changed. Your draft has been retained; reload or compare before saving.')
    const content = serializeFlowDocument(input.document)
    const plan = create ? await planFlowChapterCreation({ ...input, files, options: port.compileOptions }) : { files, changes: [{ path: input.path, expected: current, content }] }
    const result = await validateFlowEdit({ ...input, files: plan.files, options: port.compileOptions })
    if (!result.valid)
      throw new FlowEditError('ADV_FLOW_VALIDATION_FAILED', result.diagnostics.filter(issue => issue.severity === 'error').map(issue => `${issue.code}: ${issue.message}`).join('\n'))
    // Guard every compilation input against interleaved metadata/chapter/profile edits.
    const changedPaths = new Set(plan.changes.map(change => change.path))
    const guards = Object.entries(files).filter(([path]) => !changedPaths.has(path)).map(([path, expected]) => ({ path, expected, content: expected }))
    if (guards.length + plan.changes.length > 100)
      throw new FlowEditError('ADV_FLOW_TRANSACTION_LIMIT', 'This project requires a host transaction supporting more than 100 files')
    await port.writeFiles([...guards, ...plan.changes])
    return { path: input.path, content, document: parseFlowDocument(content), revision: await flowDocumentRevision(content) }
  }
  return { read, validate, validateCreate, save: (input: Parameters<typeof commit>[0]) => commit(input, false), create: (input: Parameters<typeof commit>[0]) => commit(input, true) }
}
export type FlowAuthoringService = ReturnType<typeof createFlowAuthoringService>
