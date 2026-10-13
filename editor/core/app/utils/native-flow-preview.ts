import type { FlowEditDocument } from '@advjs/core'
import type { AdvProjectFileMap, JsonObject, RuntimeAddress, RuntimeProgram, RuntimeSnapshot } from '@advjs/types'
import { createInitialRuntimeState, createProjectGameConfig, derivePresentationState, planFlowChapterCreation, runtimeConditionMatches, serializeFlowDocument, validateFlowEdit, visibleRuntimeChoices } from '@advjs/core'

export interface NativeFlowPreviewSelection {
  document: FlowEditDocument
  nodeId: string
  lineId?: string
}

/** Resolve authored identity, never a node's current array index or guessed compiler suffix. */
export function nativeFlowPreviewAddress(program: RuntimeProgram, selection: NativeFlowPreviewSelection): RuntimeAddress {
  const source = selection.document.nodes.find(node => node.id === selection.nodeId)
  const chapter = program.chapters[selection.document.id]
  if (!source || !chapter?.nodes[source.id])
    throw new Error('ADV_FLOW_PREVIEW_NODE_MISSING: Select a node in the current draft')
  const lineId = selection.lineId
    ?? (typeof source.lineId === 'string' ? source.lineId : undefined)
    ?? (Array.isArray(source.dialogues) && typeof source.dialogues[0]?.lineId === 'string' ? source.dialogues[0].lineId : undefined)
  if (!lineId)
    return { chapterId: chapter.id, nodeId: source.id }
  const authoredLines = [source.lineId, ...(Array.isArray(source.dialogues) ? source.dialogues.map(dialogue => dialogue.lineId) : [])]
  const matches = Object.values(chapter.nodes).filter(node => node.data?.lineId === lineId)
  if (!authoredLines.includes(lineId) || matches.length !== 1)
    throw new Error('ADV_FLOW_PREVIEW_LINE_MISSING: The selected dialogue line is no longer in this node')
  return { chapterId: chapter.id, nodeId: matches[0]!.id }
}

/** Compile only in memory, including a new chapter's source declaration. No write port exists here. */
export async function compileNativeFlowPreview(input: NativeFlowPreviewSelection & { files: AdvProjectFileMap, path: string }) {
  const files = Object.hasOwn(input.files, input.path)
    ? { ...input.files, [input.path]: serializeFlowDocument(input.document) }
    : (await planFlowChapterCreation(input)).files
  const result = await validateFlowEdit({ files, path: input.path, document: input.document })
  if (!result.valid || !result.compilation.project.program)
    return { ...result, files, config: undefined }
  const config = createProjectGameConfig(result.compilation, files)
  const selected = nativeFlowPreviewAddress(result.compilation.project.program, input)
  const { cursor } = nativeFlowPreviewCursor(result.compilation.project.program, selected, config.variables)
  derivePresentationState(result.compilation.project.program, cursor, config.variables)
  return { ...result, files, config }
}

function nativeFlowPreviewCursor(program: RuntimeProgram, selected: RuntimeAddress, variables: JsonObject = {}) {
  const state = createInitialRuntimeState(program, variables)
  const silentKinds = new Set(['anchor', 'scene', 'effects', 'actions'])
  const seen = new Set<string>()
  let cursor = selected
  let terminal = false
  while (true) {
    const key = `${cursor.chapterId}#${cursor.nodeId}`
    if (seen.has(key) || seen.size >= 1000)
      throw new Error('ADV_FLOW_PREVIEW_SILENT_LOOP: No playable node follows this selection')
    seen.add(key)
    const node = program.chapters[cursor.chapterId]?.nodes[cursor.nodeId]
    if (!node)
      throw new Error('ADV_FLOW_PREVIEW_NODE_MISSING: The selected route is no longer available')
    if (runtimeConditionMatches(node.when, variables) && !silentKinds.has(node.kind)
      && (node.kind !== 'choices' || visibleRuntimeChoices(node.data, state).length > 0)) {
      break
    }
    // The compiler has already resolved implicit order. Never fall through an
    // explicitly disconnected or redirected Flow edge using array positions.
    if (!node.next) {
      terminal = true
      break
    }
    cursor = node.next
  }
  return { cursor, terminal, state }
}

/** Same durable-stage primitive as Studio authoring; no entry traversal, actions or one-shot cues. */
export function nativeFlowPreviewSnapshot(
  program: RuntimeProgram,
  origin: RuntimeSnapshot,
  selection: NativeFlowPreviewSelection,
  variables: JsonObject = {},
) {
  const selected = nativeFlowPreviewAddress(program, selection)
  const { cursor, terminal, state } = nativeFlowPreviewCursor(program, selected, variables)
  const node = program.chapters[cursor.chapterId]!.nodes[cursor.nodeId]!
  const derived = derivePresentationState(program, cursor, variables)
  const snapshot: RuntimeSnapshot = {
    ...structuredClone(origin),
    state: {
      ...state,
      status: terminal || node.kind === 'end' ? 'ended' : node.kind === 'choices' ? 'waiting-choice' : 'playing',
      cursor: structuredClone(cursor),
      stage: derived.stage,
      visited: [`${cursor.chapterId}#${cursor.nodeId}`],
    },
    checkpoints: [],
    createdAt: Date.now(),
  }
  return { snapshot, selected, diagnostics: derived.diagnostics }
}
