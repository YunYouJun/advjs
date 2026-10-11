import type { AdvAssetManifest, AdvAst } from '@advjs/types'
import { parseAst } from '@advjs/parser'
import { validateAudioOperation } from '../runtime/audio-validation'
import { parseProjectFlowChapter } from './flow'
import { applyProjectPatches } from './serialize'

export type ProjectAudioOperation = AdvAst.Bgm | AdvAst.Ambience | AdvAst.Sfx

export interface MarkdownAudioTarget {
  line: number
  start: number
  end: number
  block: string
  /** Other operations in a mixed block are preserved by the patcher. */
  operations: ProjectAudioOperation[]
  existing: boolean
}

function isAudio(value: unknown): value is ProjectAudioOperation {
  return Boolean(value && typeof value === 'object' && ['bgm', 'ambience', 'sfx'].includes(String((value as { type?: unknown }).type)))
}

async function targetNode(content: string, line: number) {
  if (!Number.isSafeInteger(line) || line < 1 || content.length > 10 * 1024 * 1024)
    throw new Error('ADV_AUDIO_SOURCE_TARGET_INVALID')
  const ast = await parseAst(content)
  const node = ast.children.find(node => node.position?.start.line === line)
  if (!node || node.position?.start.offset === undefined || node.position.end.offset === undefined)
    throw new Error('ADV_AUDIO_SOURCE_TARGET_CHANGED: Select a current story node')
  return node
}

/** Locate an authored block, never a synthetic runtime node or a guessed line. */
export async function readMarkdownAudioTarget(content: string, line: number): Promise<MarkdownAudioTarget> {
  const node = await targetNode(content, line)
  const values = node.type === 'code' && node.lang === 'advnode' && Array.isArray(node.value) ? node.value : []
  const operations = values.filter(isAudio)
  const start = node.position!.start.offset!
  const end = node.position!.end.offset!
  return { line, start, end, block: content.slice(start, end), operations: structuredClone(operations), existing: operations.length > 0 }
}

/** Cursor selections resolve only within an actual authored node. */
export async function readMarkdownAudioAtCursor(content: string, line: number) {
  if (!Number.isSafeInteger(line) || line < 1 || content.length > 10 * 1024 * 1024)
    throw new Error('ADV_AUDIO_SOURCE_TARGET_INVALID')
  const ast = await parseAst(content)
  const node = ast.children.find(node => node.position && node.position.start.line <= line && node.position.end.line >= line)
  if (!node)
    throw new Error('ADV_AUDIO_SOURCE_TARGET_CHANGED: Place the cursor in a story block')
  return readMarkdownAudioTarget(content, node.position!.start.line)
}

export function validateProjectAudioOperations(operations: readonly ProjectAudioOperation[], catalog?: AdvAssetManifest) {
  if (!Array.isArray(operations) || operations.length > 64)
    throw new Error('ADV_AUDIO_OPERATION_LIMIT: A block supports at most 64 audio operations')
  for (const operation of operations) {
    if (!isAudio(operation))
      throw new Error('ADV_AUDIO_UNSUPPORTED_OPERATION')
    const diagnostics: Parameters<typeof validateAudioOperation>[1] = []
    validateAudioOperation(operation, diagnostics)
    if (diagnostics.length)
      throw new Error(`${diagnostics[0]!.code}: ${diagnostics[0]!.message}`)
    if (operation.asset && catalog) {
      const asset = catalog.assets.find(asset => asset.id === operation.asset)
      if (!asset || asset.type !== 'audio' || asset.kind !== operation.type || asset.state === 'rejected')
        throw new Error('ADV_AUDIO_OPERATION_ASSET_KIND: Choose a usable native asset matching the operation')
    }
  }
}

/** Canonical block edits preserve surrounding prose, line IDs and non-audio operations. */
export async function patchMarkdownAudioOperations(content: string, target: Pick<MarkdownAudioTarget, 'line' | 'block'>, operations: readonly ProjectAudioOperation[], catalog?: AdvAssetManifest) {
  validateProjectAudioOperations(operations, catalog)
  const current = await readMarkdownAudioTarget(content, target.line)
  if (current.block !== target.block)
    throw new Error('ADV_AUDIO_SOURCE_CONFLICT: The selected source block changed')
  const newline = content.includes('\r\n') ? '\r\n' : '\n'
  const fence = (values: unknown[]) => `\`\`\`advnode${newline}${JSON.stringify(values, null, 2).replaceAll('\n', newline)}${newline}\`\`\``
  if (!current.existing) {
    if (!operations.length)
      return content
    return `${content.slice(0, current.start)}${fence([...operations])}${newline}${newline}${content.slice(current.start)}`
  }
  const node = await targetNode(content, target.line)
  const values = (node as AdvAst.Code).value as AdvAst.CodeOperation[]
  const next: AdvAst.CodeOperation[] = []
  let index = 0
  for (const value of values) {
    if (isAudio(value)) {
      const replacement = operations[index++]
      if (replacement)
        next.push(replacement)
    }
    else {
      next.push(value)
    }
  }
  next.push(...operations.slice(index))
  const replacement = next.length ? fence(next) : ''
  return `${content.slice(0, current.start)}${replacement}${content.slice(current.end)}`
}

export interface FlowAudioTarget {
  nodeId: string
  /** Frozen authored record used for optimistic conflict detection. */
  block: string
  operations: ProjectAudioOperation[]
}

/** Exact serialized node identity; no editor-edge or legacy module interpretation. */
export function readFlowAudioTarget(content: string, nodeId: string): FlowAudioTarget {
  const diagnostics: Parameters<typeof parseProjectFlowChapter>[2] = []
  const chapter = parseProjectFlowChapter(content, 'chapter.chapter.json', diagnostics)
  if (!chapter)
    throw new Error(`${diagnostics[0]?.code ?? 'ADV_AUDIO_SOURCE_TARGET_INVALID'}: Invalid serialized Flow chapter`)
  const matches = chapter.nodes.filter(node => node.id === nodeId)
  if (matches.length !== 1 || matches[0]!.type !== 'audio')
    throw new Error('ADV_AUDIO_SOURCE_TARGET_CHANGED: Select a unique native Flow audio node')
  const node = matches[0]!
  return { nodeId, block: JSON.stringify(node), operations: JSON.parse(JSON.stringify(node.operations)) }
}

/** Preserve opaque author fields and all source bytes outside the declared nodes value. */
export function patchFlowAudioOperations(content: string, target: Pick<FlowAudioTarget, 'nodeId' | 'block'>, operations: readonly ProjectAudioOperation[], catalog?: AdvAssetManifest) {
  validateProjectAudioOperations(operations, catalog)
  const current = readFlowAudioTarget(content, target.nodeId)
  if (current.block !== target.block)
    throw new Error('ADV_AUDIO_SOURCE_CONFLICT: The selected Flow audio node changed')
  const chapter = JSON.parse(content)
  const node = chapter.nodes.find((node: { id: string }) => node.id === target.nodeId)
  node.operations = JSON.parse(JSON.stringify(operations))
  const path = 'chapter.chapter.json'
  return applyProjectPatches({ [path]: content }, [{ kind: 'json-set', path, key: 'nodes', value: chapter.nodes }]).files[path]!
}
