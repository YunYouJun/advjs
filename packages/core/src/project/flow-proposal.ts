import type { AdvProjectCompileOptions, AdvProjectDiagnostic, AdvProjectFileMap } from '@advjs/types'
import type { FlowEditCommand, FlowEditDocument } from './flow-edit'
import { parseAudioVoiceProfiles, parseVoiceLedger } from '@advjs/audio'
import { parseCharacterMd } from '@advjs/parser'
import { isRuntimeIdentifier } from '../compiler/address'
import { validateFlowChapter } from '../compiler/flow-validation'
import { compileProject } from './compile'
import { applyFlowEdit, FLOW_NODE_KINDS, FlowEditError, flowEditTargetAddress, isFlowEditRecord, parseFlowDocument, serializeFlowDocument } from './flow-edit'
import { flowDocumentRevision, validateFlowEdit } from './flow-workspace'

/** A bounded command envelope, not a replacement story or publication protocol. */
export type FlowProposalCommand
  = | Exclude<FlowEditCommand, { type: 'update-dialogue' | 'delete-dialogue' }>
    | { type: 'update-dialogue', nodeId: string, lineId: string, patch: Record<string, unknown>, remove?: string[] }
    | { type: 'delete-dialogue', nodeId: string, lineId: string }

export interface FlowProposalRequest {
  schemaVersion: 1
  path: string
  expectedRevision: string
  projectRevision: string
  commands: FlowProposalCommand[]
}
export interface FlowProposalSnapshot {
  schemaVersion: 1
  path: string
  chapterId: string
  revision: string
  projectRevision: string
  document: FlowEditDocument
  diagnostics: AdvProjectDiagnostic[]
}
export interface FlowProposalNodeChange {
  nodeId: string
  kind: 'added' | 'updated' | 'deleted'
  /** $index denotes a change in story order, independently of layout. */
  fields: string[]
}
export interface FlowProposalLineChange extends FlowProposalNodeChange { lineId: string }
export interface FlowProposalChanges {
  chapterFields: string[]
  nodes: FlowProposalNodeChange[]
  lines: FlowProposalLineChange[]
}
export interface FlowProposalPlan {
  request: FlowProposalRequest
  path: string
  chapterId: string
  /** Exact baseline source revision, shared with FlowAuthoringService. */
  revision: string
  projectRevision: string
  baseline: FlowEditDocument
  proposed: FlowEditDocument
  before: string
  after: string
  changes: FlowProposalChanges
  diagnostics: AdvProjectDiagnostic[]
  valid: boolean
}

export const FLOW_PROPOSAL_LIMITS = { commands: 100, bytes: 256 * 1024, depth: 32 } as const
export const MAX_FLOW_PROPOSAL_BYTES = FLOW_PROPOSAL_LIMITS.bytes

const REVISION_IGNORED_DIRECTORIES = new Set(['.git', '.nuxt', '.output', 'coverage', 'dist', 'node_modules'])

function jsonObject(content: string | undefined): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(content ?? '{}')
    return isFlowEditRecord(value) ? value : {}
  }
  catch { return {} }
}

function proposalContentRoot(files: Readonly<AdvProjectFileMap>): string {
  const root = jsonObject(files['adv.config.json']).root
  if (typeof root !== 'string' || root.startsWith('/') || /^[a-z]:/iu.test(root) || root.split(/[\\/]/u).includes('..'))
    return 'adv'
  return root.replaceAll('\\', '/').split('/').filter(part => part && part !== '.').join('/') || 'adv'
}

/**
 * Portable native-JSON authoring fence shared by Node/MCP and browser Editor.
 * Hash exact bytes of root adv/game/assets JSON configs; .json/.md documents
 * beneath the configured content root (excluding generated/ignored directories);
 * explicit native chapter sources, asset fragments, and native voice-consent documents.
 * Incidental root README/package files, UI code and media placeholders are not
 * proposal inputs. AgentProposalReview keeps its separate, full-map revision.
 */
export async function flowProjectRevision(files: Readonly<AdvProjectFileMap>): Promise<string> {
  const root = proposalContentRoot(files)
  const paths = new Set(['adv.config.json', 'game.config.json', 'assets.json'])
  for (const path of Object.keys(files)) {
    if (path.startsWith(`${root}/`) && /\.(?:json|md)$/iu.test(path)
      && !path.split('/').slice(0, -1).some(part => REVISION_IGNORED_DIRECTORIES.has(part))) {
      paths.add(path)
    }
  }
  const gamePath = [`${root}/settings/game.json`, `${root}/game.config.json`, 'game.config.json'].find(path => Object.hasOwn(files, path))
  const game = jsonObject(gamePath ? files[gamePath] : undefined)
  const assetsPath = [`${root}/assets.json`, 'assets.json'].find(path => Object.hasOwn(files, path))
  const assets = jsonObject(assetsPath ? files[assetsPath] : undefined)
  if (assetsPath && Array.isArray(assets.includes)) {
    const directory = assetsPath.includes('/') ? assetsPath.slice(0, assetsPath.lastIndexOf('/')) : ''
    for (const include of assets.includes) {
      if (typeof include !== 'string')
        continue
      const joined = [directory, include].filter(Boolean).join('/').replaceAll('\\', '/')
      if (joined.startsWith('/') || /^[a-z]:/iu.test(joined) || joined.split('/').includes('..'))
        continue
      paths.add(joined.split('/').filter(part => part && part !== '.').join('/'))
    }
  }
  if (Array.isArray(game.chapters)) {
    for (const chapter of game.chapters) {
      if (!isFlowEditRecord(chapter) || Array.isArray(chapter.nodes) || !Array.isArray(chapter.sources) || chapter.sources.length !== 1)
        continue
      const reference = chapter.sources[0]
      try {
        assertPath(reference)
        paths.add(Object.hasOwn(files, `${root}/${reference}`) ? `${root}/${reference}` : reference)
      }
      catch { /* Compilation reports malformed declarations. */ }
    }
  }
  const consent = new Set<string>()
  const collectProfile = (profile: unknown) => {
    if (!isFlowEditRecord(profile) || !isFlowEditRecord(profile.locales))
      return
    for (const locale of Object.values(profile.locales)) {
      if (!isFlowEditRecord(locale) || !isFlowEditRecord(locale.providers))
        continue
      for (const provider of Object.values(locale.providers)) {
        if (isFlowEditRecord(provider) && isFlowEditRecord(provider.rights) && typeof provider.rights.consentRecord === 'string')
          consent.add(provider.rights.consentRecord)
      }
    }
  }
  if (Array.isArray(game.characters)) {
    for (const character of game.characters) {
      if (isFlowEditRecord(character) && typeof character.id === 'string' && typeof character.name === 'string')
        collectProfile(character.voiceProfile)
    }
  }
  for (const path of paths) {
    if (path.startsWith(`${root}/characters/`) && path.endsWith('.character.md')) {
      try {
        collectProfile(parseCharacterMd(files[path]!).voiceProfile)
      }
      catch { /* Malformed character sources remain in the revision. */ }
    }
  }
  try {
    collectProfile(parseAudioVoiceProfiles(files[`${root}/audio/voice-profiles.json`] ?? { schemaVersion: 1, revision: 0 }).narrator)
  }
  catch { /* Malformed profiles remain in the revision. */ }
  try {
    const ledgerSource = files[`${root}/audio/voice-ledger.json`]
    if (ledgerSource) {
      for (const line of Object.values(parseVoiceLedger(ledgerSource).lines)) {
        for (const binding of Object.values(line.locales)) {
          for (const take of binding.takes) {
            if (take.rights)
              consent.add(take.rights.consentRecord)
          }
        }
      }
    }
  }
  catch { /* Malformed ledgers remain in the revision. */ }
  for (const path of consent) {
    if (!path.includes('\\') && !path.includes(':') && !path.includes('\0') && /\.(?:md|txt|json)$/iu.test(path)
      && path.split('/').every(part => part && !['.', '..', '.git', '.advjs', 'node_modules'].includes(part.toLowerCase()))) {
      paths.add(path)
    }
  }
  const entries = [...paths].filter(path => Object.hasOwn(files, path)).sort((left, right) => left < right ? -1 : left > right ? 1 : 0).map(path => [path, files[path]])
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(entries)))
  return `sha256:${Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')}`
}

function invalid(message: string): never {
  throw new FlowEditError('ADV_FLOW_PROPOSAL_INVALID', message)
}
function limit(message: string): never {
  throw new FlowEditError('ADV_FLOW_PROPOSAL_LIMIT', message)
}

/** Reject non-JSON input before cloning (including accessors, cycles and sparse arrays). */
function boundedJson(value: unknown, depth = 0, seen = new Set<object>(), budget = { entries: 0, bytes: 0 }): void {
  if (depth > FLOW_PROPOSAL_LIMITS.depth || ++budget.entries > 50000)
    limit('Proposal JSON is too large or deeply nested')
  if (typeof value === 'string') {
    if (value.length > FLOW_PROPOSAL_LIMITS.bytes)
      limit('Proposal text exceeds 256 KiB')
    budget.bytes += new TextEncoder().encode(value).byteLength
    if (budget.bytes > FLOW_PROPOSAL_LIMITS.bytes)
      limit('Proposal text exceeds 256 KiB')
    return
  }
  if (value === null || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value)))
    return
  if ((!Array.isArray(value) && !isFlowEditRecord(value)) || seen.has(value as object))
    invalid('Proposal must contain only finite, acyclic JSON values')
  const object = value as object
  if (Object.getOwnPropertySymbols(object).length)
    invalid('Symbol keys are not JSON')
  if (Array.isArray(value) && (Object.getPrototypeOf(value) !== Array.prototype || value.length > 10000
    || Object.keys(value).length !== value.length || Array.from({ length: value.length }, (_, index) => index).some(index => !Object.hasOwn(value, index)))) {
    invalid('Expected a bounded, dense JSON array')
  }
  seen.add(object)
  for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(object))) {
    if (Array.isArray(value) && key === 'length')
      continue
    if (!descriptor.enumerable || !Object.hasOwn(descriptor, 'value'))
      invalid('Proposal fields must be ordinary JSON properties')
    if (['__proto__', 'constructor', 'prototype'].includes(key))
      invalid('Reserved object keys are not allowed')
    budget.bytes += new TextEncoder().encode(key).byteLength
    if (budget.bytes > FLOW_PROPOSAL_LIMITS.bytes)
      limit('Proposal exceeds 256 KiB')
    boundedJson(descriptor.value, depth + 1, seen, budget)
  }
  seen.delete(object)
}

function record(value: unknown, name: string): Record<string, unknown> {
  if (!isFlowEditRecord(value))
    invalid(`${name} must be a JSON object`)
  return value
}
function keys(value: Record<string, unknown>, required: string[], optional: string[] = []) {
  if (required.some(key => !Object.hasOwn(value, key)) || Object.keys(value).some(key => ![...required, ...optional].includes(key)))
    invalid(`Expected fields ${required.join(', ')}${optional.length ? `; optional ${optional.join(', ')}` : ''}`)
}
function identifier(value: unknown, name: string): asserts value is string {
  if (typeof value !== 'string' || value.length > 256 || !isRuntimeIdentifier(value))
    invalid(`${name} must be a bounded stable identifier`)
}
function position(value: unknown) {
  const source = record(value, 'position')
  keys(source, ['x', 'y'])
  if (![source.x, source.y].every(item => typeof item === 'number' && Number.isFinite(item) && Math.abs(item) <= 1000000))
    invalid('Layout coordinates must be finite and bounded')
}
function index(value: unknown) {
  if (!Number.isInteger(value) || (value as number) < 0 || (value as number) > 10000)
    invalid('Index must be an integer between 0 and 10000')
}
function target(value: unknown) {
  if (isFlowEditRecord(value))
    keys(value, ['chapterId', 'nodeId'])
  if (!flowEditTargetAddress(value, 'proposal'))
    invalid('Target must be a node ID or chapter#node address')
}
function patch(source: Record<string, unknown>, frozen: string[]) {
  const value = record(source.patch, 'patch')
  if (source.remove !== undefined && (!Array.isArray(source.remove) || source.remove.some(key => typeof key !== 'string' || !key)))
    invalid('remove must contain field names')
  const removed = (source.remove ?? []) as string[]
  if ([...Object.keys(value), ...removed].some(key => frozen.includes(key) || ['__proto__', 'constructor', 'prototype'].includes(key)))
    invalid('Identity and row collections require explicit commands and cannot be patched or removed')
}
function dialogue(value: unknown) {
  const row = record(value, 'dialogue')
  identifier(row.lineId, 'dialogue.lineId')
  if (typeof row.text !== 'string' || [row.speaker, row.speakerId].some(item => item !== undefined && (typeof item !== 'string' || !item.trim()))
    || (row.status !== undefined && typeof row.status !== 'string')) {
    invalid('Dialogue requires text and optional string speaker/status')
  }
}
function choice(value: unknown) {
  const row = record(value, 'choice')
  identifier(row.id, 'choice.id')
  if (typeof row.text !== 'string' || (row.when !== undefined && typeof row.when !== 'string'))
    invalid('Choice requires text and optional string condition')
  target(row.target)
}
function addedNode(value: unknown) {
  const node = record(value, 'node')
  identifier(node.id, 'node.id')
  if (!FLOW_NODE_KINDS.includes(node.type as typeof FLOW_NODE_KINDS[number]))
    invalid('New nodes require a supported native Flow type')
  if (node.position !== undefined)
    position(node.position)
  if (node.next !== undefined && node.next !== null)
    target(node.next)
  if (node.type === 'narration')
    identifier(node.lineId, 'node.lineId')
  if (node.type === 'dialogues') {
    if (!Array.isArray(node.dialogues))
      invalid('Dialogue node requires dialogues')
    node.dialogues.forEach(dialogue)
  }
  if (node.type === 'choices') {
    if (!Array.isArray(node.choices))
      invalid('Choices node requires choices')
    node.choices.forEach(choice)
  }
  const issues: Parameters<typeof validateFlowChapter>[1] = []
  if (!validateFlowChapter({ id: 'proposal', title: '', nodes: [node] }, issues))
    invalid(issues.map(issue => issue.message).join('; '))
}

function command(value: unknown): FlowProposalCommand {
  const source = record(value, 'command')
  const type = source.type
  switch (type) {
    case 'add-node':
      keys(source, ['type', 'node'], ['index'])
      addedNode(source.node)
      break
    case 'set-title':
      keys(source, ['type', 'title'])
      if (typeof source.title !== 'string')
        invalid('title must be a string')
      break
    case 'arrange-nodes':
      keys(source, ['type', 'positions'])
      Object.entries(record(source.positions, 'positions')).forEach(([id, value]) => {
        identifier(id, 'nodeId')
        position(value)
      })
      break
    case 'update-node':
      keys(source, ['type', 'nodeId', 'patch'], ['remove'])
      patch(source, ['id', 'type', 'lineId', 'dialogues', 'choices'])
      break
    case 'move-node':
      keys(source, ['type', 'nodeId', 'position'])
      position(source.position)
      break
    case 'reorder-node':
      keys(source, ['type', 'nodeId', 'index'])
      break
    case 'set-entry':
    case 'delete-node':
      keys(source, ['type', 'nodeId'])
      break
    case 'connect':
      keys(source, ['type', 'nodeId', 'target'], ['choiceId'])
      target(source.target)
      break
    case 'disconnect':
      keys(source, ['type', 'nodeId'], ['choiceId'])
      break
    case 'add-dialogue':
      keys(source, ['type', 'nodeId', 'dialogue'], ['index'])
      dialogue(source.dialogue)
      break
    case 'update-dialogue':
      keys(source, ['type', 'nodeId', 'lineId', 'patch'], ['remove'])
      identifier(source.lineId, 'lineId')
      patch(source, ['lineId'])
      break
    case 'delete-dialogue':
      keys(source, ['type', 'nodeId', 'lineId'])
      identifier(source.lineId, 'lineId')
      break
    case 'add-choice':
      keys(source, ['type', 'nodeId', 'choice'], ['index'])
      choice(source.choice)
      break
    case 'update-choice':
      keys(source, ['type', 'nodeId', 'choiceId', 'patch'], ['remove'])
      patch(source, ['id'])
      break
    case 'delete-choice':
      keys(source, ['type', 'nodeId', 'choiceId'])
      break
    default:
      invalid(`Unsupported Flow proposal command: ${String(type)}`)
  }
  if (Object.hasOwn(source, 'nodeId'))
    identifier(source.nodeId, 'nodeId')
  if (Object.hasOwn(source, 'choiceId'))
    identifier(source.choiceId, 'choiceId')
  if (Object.hasOwn(source, 'index'))
    index(source.index)
  return source as unknown as FlowProposalCommand
}

function assertPath(path: unknown): asserts path is string {
  if (typeof path !== 'string' || path.length > 1024 || path.startsWith('/') || /^[a-z]:/iu.test(path) || path.includes('\\') || [...path].some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)
    || !path.endsWith('.chapter.json') || path.split('/').some(part => !part || ['.', '..', '.git', 'node_modules'].includes(part))) {
    throw new FlowEditError('ADV_FLOW_INVALID_PATH', 'Expected canonical relative .chapter.json path')
  }
}

/** AI-facing parser rejects index addressing for edits/deletions of existing lines. */
export function parseFlowProposalRequest(value: unknown): FlowProposalRequest {
  boundedJson(value)
  const serialized = JSON.stringify(value)
  if (new TextEncoder().encode(serialized).byteLength > FLOW_PROPOSAL_LIMITS.bytes)
    limit('Proposal exceeds 256 KiB')
  const source = record(JSON.parse(serialized), 'proposal')
  keys(source, ['schemaVersion', 'path', 'expectedRevision', 'projectRevision', 'commands'])
  if (source.schemaVersion !== 1)
    invalid('Expected Flow proposal schemaVersion: 1')
  assertPath(source.path)
  if (typeof source.expectedRevision !== 'string' || !/^[a-f0-9]{64}$/u.test(source.expectedRevision))
    invalid('expectedRevision must be the exact Flow authoring revision')
  if (typeof source.projectRevision !== 'string' || !/^sha256:[a-f0-9]{64}$/u.test(source.projectRevision))
    invalid('projectRevision must be the exact project revision returned with the baseline')
  if (!Array.isArray(source.commands) || !source.commands.length)
    invalid('Expected at least one command')
  if (source.commands.length > FLOW_PROPOSAL_LIMITS.commands)
    limit('A proposal may contain at most 100 commands')
  return { schemaVersion: 1, path: source.path, expectedRevision: source.expectedRevision, projectRevision: source.projectRevision, commands: source.commands.map(command) }
}

/** Reads a single existing native source, including repairable semantic diagnostics. */
export async function readFlowProposalSnapshot(input: { files: AdvProjectFileMap, path: string, options?: AdvProjectCompileOptions }): Promise<FlowProposalSnapshot> {
  assertPath(input.path)
  const files = { ...input.files }
  if (!Object.hasOwn(files, input.path) || typeof files[input.path] !== 'string')
    throw new FlowEditError('ADV_FLOW_FILE_NOT_FOUND', `Chapter not found: ${input.path}`)
  const document = parseFlowDocument(files[input.path]!)
  const compilation = await compileProject({ files }, { allowEmptyAssetManifest: true, staticAnalysis: true, ...input.options })
  if (compilation.project.format !== 'flow')
    throw new FlowEditError('ADV_FLOW_SOURCE_NOT_INCLUDED', 'Proposal targets must belong to a native Flow project')
  let included = compilation.sourceMap.chapters[document.id]?.includes(input.path) ?? false
  if (!included) {
    // Invalid node properties can remove a chapter from the compiled source map.
    // Check the same explicit-source/discovery rules without treating arbitrary files as sources.
    const gamePath = compilation.sourceMap.gameConfig
    let game: unknown
    try {
      game = gamePath ? JSON.parse(files[gamePath]!) : {}
    }
    catch { throw new FlowEditError('ADV_FLOW_GAME_CONFIG_INVALID', 'Game settings must contain valid JSON') }
    if (!isFlowEditRecord(game))
      throw new FlowEditError('ADV_FLOW_GAME_CONFIG_INVALID', 'Game settings must contain an object')
    const configured = Array.isArray(game.chapters) ? game.chapters : []
    included = configured.length
      ? configured.some((item) => {
          if (!isFlowEditRecord(item) || Array.isArray(item.nodes) || !Array.isArray(item.sources) || item.sources.length !== 1
            || typeof item.sources[0] !== 'string' || (item.id !== undefined && item.id !== document.id)) {
            return false
          }
          const reference = item.sources[0]
          try {
            assertPath(reference)
          }
          catch { return false }
          const path = Object.hasOwn(files, `${compilation.project.root}/${reference}`) ? `${compilation.project.root}/${reference}` : reference
          return path === input.path
        })
      : input.path.startsWith(`${compilation.project.root}/chapters/`)
  }
  if (!included)
    throw new FlowEditError('ADV_FLOW_SOURCE_NOT_INCLUDED', 'Chapter must be an existing declared or discovered native Flow source')
  return { schemaVersion: 1, path: input.path, chapterId: document.id, revision: await flowDocumentRevision(files[input.path]!), projectRevision: await flowProjectRevision(files), document, diagnostics: compilation.diagnostics }
}

function stableLines(document: FlowEditDocument) {
  return document.nodes.flatMap((node) => {
    if (node.type === 'narration' && typeof node.lineId === 'string')
      return [{ nodeId: node.id, lineId: node.lineId, index: 0, row: { text: node.text, lineId: node.lineId } as Record<string, unknown> }]
    return Array.isArray(node.dialogues)
      ? node.dialogues.filter(isFlowEditRecord).flatMap((row, index) => typeof row.lineId === 'string' ? [{ nodeId: node.id, lineId: row.lineId, index, row }] : [])
      : []
  })
}
function changedFields(before?: Record<string, unknown>, after?: Record<string, unknown>): string[] {
  return [...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])].filter(key => JSON.stringify(before?.[key]) !== JSON.stringify(after?.[key])).sort()
}
function changes(baseline: FlowEditDocument, proposed: FlowEditDocument): FlowProposalChanges {
  const nodes: FlowProposalNodeChange[] = []
  const lines: FlowProposalLineChange[] = []
  const beforeNodes = new Map(baseline.nodes.map((node, index) => [node.id, { node, index }]))
  const afterNodes = new Map(proposed.nodes.map((node, index) => [node.id, { node, index }]))
  for (const nodeId of new Set([...beforeNodes.keys(), ...afterNodes.keys()])) {
    const before = beforeNodes.get(nodeId)
    const after = afterNodes.get(nodeId)
    const fields = changedFields(before?.node, after?.node)
    if (before && after && before.index !== after.index)
      fields.push('$index')
    if (fields.length)
      nodes.push({ nodeId, kind: !before ? 'added' : !after ? 'deleted' : 'updated', fields })
  }
  const beforeLines = new Map(stableLines(baseline).map(line => [`${line.nodeId}\0${line.lineId}`, line]))
  const afterLines = new Map(stableLines(proposed).map(line => [`${line.nodeId}\0${line.lineId}`, line]))
  for (const key of new Set([...beforeLines.keys(), ...afterLines.keys()])) {
    const before = beforeLines.get(key)
    const after = afterLines.get(key)
    const fields = changedFields(before?.row, after?.row)
    if (before && after && before.index !== after.index)
      fields.push('$index')
    if (fields.length) {
      const line = after ?? before!
      lines.push({ nodeId: line.nodeId, lineId: line.lineId, kind: !before ? 'added' : !after ? 'deleted' : 'updated', fields })
    }
  }
  return { chapterFields: changedFields(baseline, proposed).filter(key => key !== 'nodes'), nodes, lines }
}

function resolveCommand(document: FlowEditDocument, command: FlowProposalCommand): FlowEditCommand {
  if (command.type !== 'update-dialogue' && command.type !== 'delete-dialogue')
    return command
  const node = document.nodes.find(node => node.id === command.nodeId)
  if (!node)
    throw new FlowEditError('ADV_FLOW_NODE_NOT_FOUND', `Unknown node ${command.nodeId}`)
  if (!Array.isArray(node.dialogues))
    throw new FlowEditError('ADV_FLOW_INVALID_ROWS', `Node ${node.id} needs dialogues records`)
  const matches = node.dialogues.flatMap((row, index) => isFlowEditRecord(row) && row.lineId === command.lineId ? [index] : [])
  if (matches.length !== 1)
    throw new FlowEditError('ADV_FLOW_LINE_ID_NOT_FOUND', 'Dialogue lineId must identify exactly one existing row')
  const { lineId: _, ...rest } = command
  return { ...rest, index: matches[0]! }
}

/** Pure dry-run: owns no filesystem, network, model, write or publication capability. */
export async function planFlowProposal(input: { files: AdvProjectFileMap, request: unknown, options?: AdvProjectCompileOptions }): Promise<FlowProposalPlan> {
  const request = parseFlowProposalRequest(input.request)
  const files = { ...input.files }
  if (!Object.hasOwn(files, request.path))
    throw new FlowEditError('ADV_FLOW_FILE_NOT_FOUND', `Chapter not found: ${request.path}`)
  if (await flowDocumentRevision(files[request.path]!) !== request.expectedRevision)
    throw new FlowEditError('ADV_FLOW_SOURCE_CONFLICT', 'Source changed after the proposal baseline was read. Read it again before reviewing.')
  if (await flowProjectRevision(files) !== request.projectRevision)
    throw new FlowEditError('ADV_FLOW_SOURCE_CONFLICT', 'Project dependencies changed after the proposal baseline was read. Read it again before reviewing.')
  const snapshot = await readFlowProposalSnapshot({ files, path: request.path, options: input.options })
  const otherChapters: FlowEditDocument[] = []
  // Retain uncompiled native sources for conservative incoming-reference checks.
  for (const [path, content] of Object.entries(files)) {
    if (path !== request.path && path.endsWith('.chapter.json')) {
      try {
        otherChapters.push(parseFlowDocument(content))
      }
      catch { /* Compilation still reports malformed other chapters. */ }
    }
  }
  let proposed = parseFlowDocument(serializeFlowDocument(snapshot.document))
  for (const command of request.commands)
    proposed = applyFlowEdit(proposed, resolveCommand(proposed, command), { otherChapters })
  const lineIds = new Set<string>()
  const duplicateIds = new Set<string>()
  for (const line of stableLines(proposed)) {
    if (lineIds.has(line.lineId))
      duplicateIds.add(line.lineId)
    lineIds.add(line.lineId)
  }
  const validation = await validateFlowEdit({ files, path: request.path, document: proposed, options: input.options })
  const diagnostics = [...validation.diagnostics]
  for (const lineId of duplicateIds)
    diagnostics.push({ code: 'ADV_FLOW_DUPLICATE_LINE_ID', severity: 'error', path: request.path, message: `Line identity ${lineId} is used more than once` })
  return {
    request,
    path: request.path,
    chapterId: snapshot.chapterId,
    revision: snapshot.revision,
    projectRevision: snapshot.projectRevision,
    baseline: snapshot.document,
    proposed,
    before: files[request.path]!,
    after: serializeFlowDocument(proposed),
    changes: changes(snapshot.document, proposed),
    diagnostics,
    valid: !diagnostics.some(issue => issue.severity === 'error'),
  }
}
