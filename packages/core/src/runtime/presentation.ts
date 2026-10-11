import type {
  AudioAmbienceSlot,
  AudioTrackState,
  JsonObject,
  JsonValue,
  RuntimeAddress,
  RuntimeProgram,
  RuntimeStageState,
} from '@advjs/types'
import { validateAudioOperation } from './audio-validation'
import { runtimeConditionMatches } from './expression'

export interface RuntimePresentationDiagnostic {
  code: 'ADV_RUNTIME_PREVIEW_SCENE_BASELINE_MISSING' | 'ADV_RUNTIME_PREVIEW_BACKGROUND_MISSING'
  severity: 'warning'
  message: string
  address: RuntimeAddress
}

export interface RuntimePresentationDerivation {
  stage: RuntimeStageState
  anchor?: RuntimeAddress
  diagnostics: RuntimePresentationDiagnostic[]
}

interface CachedAnchor {
  index: number
  address: RuntimeAddress
  stage: RuntimeStageState
}

const anchorCache = new WeakMap<RuntimeProgram, Map<string, CachedAnchor[]>>()

function emptyStage(): RuntimeStageState {
  return { background: '', audio: { bgm: null, ambience: {} }, cg: '', tachies: {} }
}

function cacheKey(chapterId: string, variables: Readonly<JsonObject>): string {
  return `${chapterId}\u0000${JSON.stringify(variables)}`
}

function record(value: JsonValue | undefined): JsonObject | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : undefined
}

/** Apply only durable presentation state. One-shot motion and transitions are intentionally ignored. */
export function applyRuntimeStageOperation(
  stage: RuntimeStageState,
  operation: Readonly<JsonObject>,
): void {
  const diagnostics: Parameters<typeof validateAudioOperation>[1] = []
  validateAudioOperation(operation, diagnostics)
  if (diagnostics.length)
    throw new Error(`${diagnostics[0].code}: ${diagnostics[0].message}`)
  if (operation.type === 'background') {
    stage.background = String(operation.url ?? operation.name ?? '')
    stage.cg = ''
    return
  }

  if (operation.type === 'bgm' || operation.type === 'ambience') {
    const fade = record(operation.fade)
    const track: AudioTrackState | null = operation.action === 'clear'
      ? null
      : {
          assetId: String(operation.asset),
          loop: operation.loop !== false,
          ...(typeof operation.gain === 'number' ? { gain: operation.gain } : {}),
          ...(typeof fade?.in === 'number' ? { fadeInMs: fade.in } : {}),
          ...(typeof fade?.out === 'number' ? { fadeOutMs: fade.out } : {}),
        }
    if (operation.type === 'bgm') {
      stage.audio.bgm = track
    }
    else {
      const slot = operation.slot as AudioAmbienceSlot
      if (track)
        stage.audio.ambience[slot] = track
      else
        delete stage.audio.ambience[slot]
    }
    return
  }

  if (operation.type === 'tachie') {
    const enters = Array.isArray(operation.enter) ? operation.enter : [operation.enter]
    for (const item of enters) {
      if (typeof item === 'string') {
        stage.tachies[item] = stage.tachies[item] ?? { status: '' }
        continue
      }
      const data = record(item)
      if (!data)
        continue
      const name = String(data.name ?? '')
      if (!name)
        continue
      const previous = stage.tachies[name]
      const position = typeof data.position === 'number'
        || data.position === 'left'
        || data.position === 'center'
        || data.position === 'right'
        ? data.position
        : previous?.position
      const scale = typeof data.scale === 'number' ? data.scale : previous?.scale
      const mirror = typeof data.mirror === 'boolean' ? data.mirror : previous?.mirror
      stage.tachies[name] = {
        status: typeof data.status === 'string' ? data.status : previous?.status ?? '',
        ...(position !== undefined ? { position } : {}),
        ...(scale !== undefined ? { scale } : {}),
        ...(mirror !== undefined ? { mirror } : {}),
      }
    }
    const exits = Array.isArray(operation.exit) ? operation.exit : []
    for (const item of exits) {
      const data = record(item)
      const name = typeof item === 'string' ? item : String(data?.name ?? '')
      if (name)
        delete stage.tachies[name]
    }
    return
  }

  if (operation.type === 'cg') {
    stage.cg = operation.action === 'hide' ? '' : String(operation.id ?? '')
  }
}

function cacheAnchors(program: RuntimeProgram, key: string): CachedAnchor[] {
  let programCache = anchorCache.get(program)
  if (!programCache) {
    programCache = new Map()
    anchorCache.set(program, programCache)
  }
  let anchors = programCache.get(key)
  if (!anchors) {
    anchors = []
    programCache.set(key, anchors)
  }
  return anchors
}

/**
 * Derive a deterministic Studio preview stage without executing actions,
 * choices, plugin nodes, activities, persistence, or one-shot animation cues.
 */
export function derivePresentationState(
  program: RuntimeProgram,
  target: RuntimeAddress,
  variables: Readonly<JsonObject> = {},
): RuntimePresentationDerivation {
  const chapter = program.chapters[target.chapterId]
  const targetIndex = chapter?.order.indexOf(target.nodeId) ?? -1
  if (!chapter || targetIndex < 0 || !chapter.nodes[target.nodeId]) {
    throw new Error(
      `ADV_RUNTIME_UNKNOWN_TARGET: Unknown runtime target: ${target.chapterId}#${target.nodeId}`,
    )
  }

  const anchors = cacheAnchors(program, cacheKey(chapter.id, variables))
  const cached = anchors
    .filter(anchor => anchor.index <= targetIndex)
    .sort((left, right) => right.index - left.index)[0]
  const stage = cached ? structuredClone(cached.stage) : emptyStage()
  let anchor = cached ? structuredClone(cached.address) : undefined
  const startIndex = cached ? cached.index + 1 : 0

  for (let index = startIndex; index <= targetIndex; index++) {
    const nodeId = chapter.order[index]
    const node = chapter.nodes[nodeId]
    if (!node || !runtimeConditionMatches(node.when, variables))
      continue

    if (node.kind === 'effects') {
      const data = record(node.data)
      const operations = Array.isArray(data?.operations) ? data.operations : []
      for (const value of operations) {
        const operation = record(value)
        if (operation)
          applyRuntimeStageOperation(stage, operation)
      }
    }

    if (node.kind === 'scene') {
      anchor = { chapterId: chapter.id, nodeId }
      const existing = anchors.find(item => item.index === index)
      if (existing) {
        existing.stage = structuredClone(stage)
        existing.address = structuredClone(anchor)
      }
      else {
        anchors.push({ index, address: structuredClone(anchor), stage: structuredClone(stage) })
      }
    }
  }

  const diagnostics: RuntimePresentationDiagnostic[] = []
  if (!anchor) {
    diagnostics.push({
      code: 'ADV_RUNTIME_PREVIEW_SCENE_BASELINE_MISSING',
      severity: 'warning',
      message: `No scene anchor precedes ${target.chapterId}#${target.nodeId}; preview starts from an empty stage`,
      address: structuredClone(target),
    })
  }
  if (!stage.background) {
    diagnostics.push({
      code: 'ADV_RUNTIME_PREVIEW_BACKGROUND_MISSING',
      severity: 'warning',
      message: `No background is defined before ${target.chapterId}#${target.nodeId}`,
      address: structuredClone(target),
    })
  }

  return {
    stage: structuredClone(stage),
    ...(anchor ? { anchor: structuredClone(anchor) } : {}),
    diagnostics,
  }
}
