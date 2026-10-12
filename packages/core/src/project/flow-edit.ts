import type { AdvProjectFileMap, RuntimeAddress } from '@advjs/types'
import { createAudioId } from '@advjs/audio'
import { isRuntimeIdentifier } from '../compiler/address'

export const FLOW_NODE_KINDS = ['start', 'dialogues', 'narration', 'choices', 'background', 'tachie', 'audio', 'end'] as const
export type FlowNodeKind = typeof FLOW_NODE_KINDS[number]
export type FlowEditTarget = string | RuntimeAddress
export interface FlowEditPosition { x: number, y: number }
/** Drafts retain every author field, including unsupported data that needs repair. */
export interface FlowEditNode {
  id: string
  type?: string
  next?: FlowEditTarget | null
  position?: FlowEditPosition
  [key: string]: unknown
}
export interface FlowEditDocument {
  schemaVersion: 1
  id: string
  title: string
  startNodeId?: string
  nodes: FlowEditNode[]
  [key: string]: unknown
}
export interface FlowEditReference {
  chapterId: string
  nodeId?: string
  kind: 'entry' | 'next' | 'choice' | 'implicit'
  choiceId?: string
}
export interface FlowEditEdge {
  id: string
  source: string
  target: RuntimeAddress
  kind: 'next' | 'choice' | 'implicit'
  choiceId?: string
  label?: string
  when?: string
}
export type FlowEditCommand
  = | { type: 'add-node', node: FlowEditNode, index?: number }
    | { type: 'update-node', nodeId: string, patch: Record<string, unknown>, remove?: string[] }
    | { type: 'move-node', nodeId: string, position: FlowEditPosition }
    | { type: 'arrange-nodes', positions: Record<string, FlowEditPosition> }
    | { type: 'reorder-node', nodeId: string, index: number }
    | { type: 'set-entry', nodeId: string }
    | { type: 'set-title', title: string }
    | { type: 'connect', nodeId: string, target: FlowEditTarget, choiceId?: string }
    | { type: 'disconnect', nodeId: string, choiceId?: string }
    | { type: 'delete-node', nodeId: string }
    | { type: 'add-dialogue', nodeId: string, dialogue: Record<string, unknown>, index?: number }
    | { type: 'update-dialogue', nodeId: string, index: number, patch: Record<string, unknown>, remove?: string[] }
    | { type: 'delete-dialogue', nodeId: string, index: number }
    | { type: 'add-choice', nodeId: string, choice: Record<string, unknown>, index?: number }
    | { type: 'update-choice', nodeId: string, choiceId: string, patch: Record<string, unknown>, remove?: string[] }
    | { type: 'delete-choice', nodeId: string, choiceId: string }

export class FlowEditError extends Error {
  constructor(public readonly code: string, message: string, public readonly references: FlowEditReference[] = []) {
    super(`${code}: ${message}`)
  }
}

export function isFlowEditRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value)))
}

function assertJson(value: unknown, depth = 0, seen = new Set<object>()): void {
  if (depth > 64)
    throw new FlowEditError('ADV_FLOW_JSON_DEPTH', 'JSON exceeds 64 levels')
  if (value === null || typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value)))
    return
  if ((!Array.isArray(value) && !isFlowEditRecord(value)) || seen.has(value as object))
    throw new FlowEditError('ADV_FLOW_JSON_VALUE', 'Only finite JSON values are allowed')
  seen.add(value as object)
  Object.values(value as object).forEach(child => assertJson(child, depth + 1, seen))
  seen.delete(value as object)
}

function cloneJson<T>(value: T): T {
  assertJson(value)
  const text = JSON.stringify(value)
  if (text.length > 10 * 1024 * 1024)
    throw new FlowEditError('ADV_FLOW_DOCUMENT_LIMIT', 'Flow chapter exceeds 10 MiB')
  return JSON.parse(text) as T
}

/** Structural reader intentionally accepts incomplete node properties for repair. */
export function parseFlowDocument(content: string): FlowEditDocument {
  if (content.length > 10 * 1024 * 1024)
    throw new FlowEditError('ADV_FLOW_DOCUMENT_LIMIT', 'Flow chapter exceeds 10 MiB')
  let value: unknown
  try {
    value = JSON.parse(content)
  }
  catch { throw new FlowEditError('ADV_FLOW_INVALID_JSON', 'Chapter must contain valid JSON') }
  if (!isFlowEditRecord(value) || value.schemaVersion !== 1 || typeof value.id !== 'string' || !isRuntimeIdentifier(value.id)
    || typeof value.title !== 'string' || !Array.isArray(value.nodes) || value.nodes.length > 10000
    || value.nodes.some(node => !isFlowEditRecord(node) || typeof node.id !== 'string' || !isRuntimeIdentifier(node.id))) {
    throw new FlowEditError('ADV_FLOW_DOCUMENT_SCHEMA', 'Expected version 1 chapter with stable IDs, title and nodes')
  }
  const ids = value.nodes.map(node => node.id)
  if (new Set(ids).size !== ids.length)
    throw new FlowEditError('ADV_FLOW_DUPLICATE_NODE', 'Node IDs must be unique')
  return cloneJson(value) as unknown as FlowEditDocument
}

export function serializeFlowDocument(document: FlowEditDocument): string {
  return `${JSON.stringify(parseFlowDocument(JSON.stringify(cloneJson(document))), null, 2)}\n`
}

export function flowEditTargetAddress(target: unknown, chapterId: string): RuntimeAddress | undefined {
  if (typeof target === 'string') {
    const parts = target.split('#')
    if (parts.length === 1 && isRuntimeIdentifier(target))
      return { chapterId, nodeId: target }
    if (parts.length === 2 && parts.every(isRuntimeIdentifier))
      return { chapterId: parts[0]!, nodeId: parts[1]! }
  }
  if (isFlowEditRecord(target) && typeof target.chapterId === 'string' && typeof target.nodeId === 'string'
    && isRuntimeIdentifier(target.chapterId) && isRuntimeIdentifier(target.nodeId)) {
    return { chapterId: target.chapterId, nodeId: target.nodeId }
  }
}

export function flowEditGraph(document: FlowEditDocument): { nodes: FlowEditNode[], edges: FlowEditEdge[] } {
  const edges: FlowEditEdge[] = []
  document.nodes.forEach((node, index) => {
    if (node.type !== 'end') {
      const implicit = node.next === undefined
      const target = implicit ? document.nodes[index + 1] && { chapterId: document.id, nodeId: document.nodes[index + 1]!.id } : flowEditTargetAddress(node.next, document.id)
      if (target)
        edges.push({ id: `${node.id}:next`, source: node.id, target, kind: implicit ? 'implicit' : 'next' })
    }
    if (node.type === 'choices' && Array.isArray(node.choices)) {
      node.choices.filter(isFlowEditRecord).forEach((choice) => {
        const target = flowEditTargetAddress(choice.target, document.id)
        if (target)
          edges.push({ id: `${node.id}:choice:${String(choice.id)}`, source: node.id, target, kind: 'choice', choiceId: String(choice.id), label: String(choice.text ?? ''), ...(typeof choice.when === 'string' ? { when: choice.when } : {}) })
      })
    }
  })
  return { nodes: cloneJson(document.nodes), edges }
}

export function flowEditReferences(document: FlowEditDocument, nodeId: string, otherChapters: readonly FlowEditDocument[] = []): FlowEditReference[] {
  const references: FlowEditReference[] = []
  if ((document.startNodeId ?? document.nodes[0]?.id) === nodeId)
    references.push({ chapterId: document.id, kind: 'entry' })
  for (const chapter of [document, ...otherChapters.filter(item => item.id !== document.id)]) {
    flowEditGraph(chapter).edges.forEach((edge) => {
      if (edge.target.chapterId === document.id && edge.target.nodeId === nodeId)
        references.push({ chapterId: chapter.id, nodeId: edge.source, kind: edge.kind, ...(edge.choiceId ? { choiceId: edge.choiceId } : {}) })
    })
  }
  return references
}

function rows(node: FlowEditNode, key: 'dialogues' | 'choices') {
  if (!Array.isArray(node[key]) || node[key].some(row => !isFlowEditRecord(row)))
    throw new FlowEditError('ADV_FLOW_INVALID_ROWS', `Node ${node.id} needs ${key} records`)
  return node[key] as Record<string, unknown>[]
}

function patchRecord(record: Record<string, unknown>, patch: Record<string, unknown>, remove: string[] = [], frozen: string[] = []) {
  for (const key of frozen) {
    if (remove.includes(key) || (Object.hasOwn(patch, key) && JSON.stringify(patch[key]) !== JSON.stringify(record[key])))
      throw new FlowEditError('ADV_FLOW_IMMUTABLE_ID', `${key} is immutable; use an explicit add/delete command`)
  }
  Object.entries(cloneJson(patch)).forEach(([key, value]) => Object.defineProperty(record, key, { value, enumerable: true, configurable: true, writable: true }))
  remove.forEach(key => delete record[key])
}

function insertIndex(index: number | undefined, length: number) {
  const value = index ?? length
  if (!Number.isInteger(value) || value < 0 || value > length)
    throw new FlowEditError('ADV_FLOW_INVALID_INDEX', 'Story index is out of range')
  return value
}

/** Pure commands modify JSON directly; movement never changes story order. */
export function applyFlowEdit(document: FlowEditDocument, command: FlowEditCommand, context: { otherChapters?: readonly FlowEditDocument[] } = {}): FlowEditDocument {
  const next = cloneJson(document)
  if (command.type === 'add-node') {
    if (!isRuntimeIdentifier(command.node.id) || next.nodes.some(node => node.id === command.node.id))
      throw new FlowEditError('ADV_FLOW_DUPLICATE_NODE', 'New node needs a unique stable ID')
    next.nodes.splice(insertIndex(command.index, next.nodes.length), 0, cloneJson(command.node))
    return parseFlowDocument(JSON.stringify(next))
  }
  if (command.type === 'set-title') {
    next.title = command.title
    return next
  }
  if (command.type === 'arrange-nodes') {
    const nodesById = new Map(next.nodes.map(node => [node.id, node]))
    for (const [id, position] of Object.entries(command.positions)) {
      const item = nodesById.get(id)
      if (!item)
        throw new FlowEditError('ADV_FLOW_NODE_NOT_FOUND', `Unknown node ${id}`)
      if (![position.x, position.y].every(value => Number.isFinite(value) && Math.abs(value) <= 1000000))
        throw new FlowEditError('ADV_FLOW_INVALID_POSITION', 'Layout coordinates must be finite and bounded')
      item.position = { ...((isFlowEditRecord(item.position) ? item.position : {}) as FlowEditPosition), ...position }
    }
    return next
  }
  const node = next.nodes.find(node => node.id === command.nodeId)
  if (!node)
    throw new FlowEditError('ADV_FLOW_NODE_NOT_FOUND', `Unknown node ${command.nodeId}`)
  switch (command.type) {
    case 'set-entry':
      next.startNodeId = node.id
      break
    case 'update-node':
      if (['dialogues', 'choices'].some(key => Object.hasOwn(command.patch, key) || command.remove?.includes(key)))
        throw new FlowEditError('ADV_FLOW_EXPLICIT_ROW_EDIT_REQUIRED', 'Use dialogue/choice commands to preserve stable identities')
      patchRecord(node, command.patch, command.remove, ['id', 'type', 'lineId'])
      break
    case 'move-node':
      if (![command.position.x, command.position.y].every(value => Number.isFinite(value) && Math.abs(value) <= 1000000))
        throw new FlowEditError('ADV_FLOW_INVALID_POSITION', 'Layout coordinates must be finite and bounded')
      // Position metadata is independent of the array used for story execution.
      node.position = { ...((isFlowEditRecord(node.position) ? node.position : {}) as FlowEditPosition), ...command.position }
      break
    case 'reorder-node': {
      const index = insertIndex(command.index, next.nodes.length - 1)
      next.nodes.splice(next.nodes.indexOf(node), 1)
      next.nodes.splice(index, 0, node)
      break
    }
    case 'connect': {
      if (!flowEditTargetAddress(command.target, next.id))
        throw new FlowEditError('ADV_FLOW_INVALID_TARGET', 'Expected node ID or chapter#node address')
      if (command.choiceId) {
        const choice = rows(node, 'choices').find(choice => choice.id === command.choiceId)
        if (!choice)
          throw new FlowEditError('ADV_FLOW_CHOICE_NOT_FOUND', 'Unknown choice')
        choice.target = cloneJson(command.target)
      }
      else {
        if (node.type === 'end')
          throw new FlowEditError('ADV_FLOW_END_CONNECTION', 'End nodes have no successor')
        node.next = cloneJson(command.target)
      }
      break
    }
    case 'disconnect':
      if (command.choiceId) {
        const choice = rows(node, 'choices').find(choice => choice.id === command.choiceId)
        if (!choice)
          throw new FlowEditError('ADV_FLOW_CHOICE_NOT_FOUND', 'Unknown choice')
        // Keep the option and its metadata. Validation blocks saving until repaired.
        delete choice.target
      }
      else { node.next = null }
      break
    case 'delete-node': {
      const references = flowEditReferences(next, node.id, context.otherChapters)
      if (references.length)
        throw new FlowEditError('ADV_FLOW_NODE_REFERENCED', 'Change entry and disconnect incoming routes before deletion', references)
      next.nodes.splice(next.nodes.indexOf(node), 1)
      break
    }
    case 'add-dialogue':
      rows(node, 'dialogues').splice(insertIndex(command.index, rows(node, 'dialogues').length), 0, cloneJson(command.dialogue))
      break
    case 'update-dialogue': {
      const dialogue = rows(node, 'dialogues')[command.index]
      if (!dialogue)
        throw new FlowEditError('ADV_FLOW_DIALOGUE_NOT_FOUND', 'Unknown dialogue')
      patchRecord(dialogue, command.patch, command.remove, ['lineId'])
      break
    }
    case 'delete-dialogue':
      if (!rows(node, 'dialogues')[command.index])
        throw new FlowEditError('ADV_FLOW_DIALOGUE_NOT_FOUND', 'Unknown dialogue')
      rows(node, 'dialogues').splice(command.index, 1)
      break
    case 'add-choice':
      if (typeof command.choice.id !== 'string' || !isRuntimeIdentifier(command.choice.id) || rows(node, 'choices').some(choice => choice.id === command.choice.id))
        throw new FlowEditError('ADV_FLOW_DUPLICATE_CHOICE', 'New choice needs a unique stable ID')
      rows(node, 'choices').splice(insertIndex(command.index, rows(node, 'choices').length), 0, cloneJson(command.choice))
      break
    case 'update-choice': {
      const choice = rows(node, 'choices').find(choice => choice.id === command.choiceId)
      if (!choice)
        throw new FlowEditError('ADV_FLOW_CHOICE_NOT_FOUND', 'Unknown choice')
      patchRecord(choice, command.patch, command.remove, ['id'])
      break
    }
    case 'delete-choice': {
      const choices = rows(node, 'choices')
      const index = choices.findIndex(choice => choice.id === command.choiceId)
      if (index < 0)
        throw new FlowEditError('ADV_FLOW_CHOICE_NOT_FOUND', 'Unknown choice')
      choices.splice(index, 1)
      break
    }
  }
  return parseFlowDocument(JSON.stringify(next))
}

export function createFlowNode(type: FlowNodeKind, options: { id?: string, lineId?: string } = {}): FlowEditNode {
  const id = options.id ?? `node_${createAudioId('line').slice(5)}`
  const base = { id, type, next: null }
  switch (type) {
    case 'dialogues': return { ...base, dialogues: [{ speakerId: 'narrator', text: '', lineId: options.lineId ?? createAudioId('line') }] }
    case 'narration': return { ...base, text: '', lineId: options.lineId ?? createAudioId('line') }
    case 'choices': return { ...base, choices: [] }
    case 'background': return { ...base, name: '' }
    case 'tachie': return { ...base, name: '', action: 'enter' }
    case 'audio': return { ...base, operations: [] }
    case 'start': return base
    case 'end': return { id, type }
  }
}

export function flowDocumentsFromFiles(files: AdvProjectFileMap): FlowEditDocument[] {
  return Object.entries(files).filter(([path]) => path.endsWith('.chapter.json')).map(([_, content]) => parseFlowDocument(content))
}

export interface FlowEditHistory { past: FlowEditDocument[], present: FlowEditDocument, future: FlowEditDocument[] }
export function createFlowEditHistory(document: FlowEditDocument): FlowEditHistory {
  return { past: [], present: cloneJson(document), future: [] }
}
export function reduceFlowEditHistory(history: FlowEditHistory, action: { type: 'undo' } | { type: 'redo' } | { type: 'edit', command: FlowEditCommand, context?: { otherChapters?: readonly FlowEditDocument[] } }): FlowEditHistory {
  if (action.type === 'undo') {
    const previous = history.past.at(-1)
    return previous ? { past: history.past.slice(0, -1), present: cloneJson(previous), future: [cloneJson(history.present), ...history.future] } : history
  }
  if (action.type === 'redo') {
    const following = history.future[0]
    return following ? { past: [...history.past, cloneJson(history.present)].slice(-100), present: cloneJson(following), future: history.future.slice(1) } : history
  }
  return { past: [...history.past, cloneJson(history.present)].slice(-100), present: applyFlowEdit(history.present, action.command, action.context), future: [] }
}
