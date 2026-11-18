import type { AdvAssetManifest, AdvProjectDiagnostic, JsonObject, RuntimeActionCall, RuntimeProgram } from '@advjs/types'
import type { AdvExtrasUnlockKind, AdvGameExtrasConfig } from './config'
import { extrasUnlockKey, parseGameExtras } from './config'
import { createRuntimeRouteGraph } from './route'

export interface ValidateGameExtrasOptions {
  game: Readonly<JsonObject>
  /** Project-relative game settings path for configuration diagnostics. */
  gamePath?: string
  program?: RuntimeProgram
  assets?: AdvAssetManifest
  /** Chapter ID → source paths, used to point unlock diagnostics at the script. */
  chapterSources?: Readonly<Record<string, readonly string[]>>
  files?: ReadonlyMap<string, string>
}

const UNLOCK_ACTIONS = new Set(['variables/push', 'variables/push-unique'])

interface UnlockWrite {
  value: unknown
  chapterId: string
  nodeId: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

/** Every literal pushed into a top-level variable, including choice actions. */
function collectUnlockWrites(program: RuntimeProgram, key: string): UnlockWrite[] {
  const writes: UnlockWrite[] = []
  const visit = (calls: readonly RuntimeActionCall[] | undefined, chapterId: string, nodeId: string) => {
    for (const call of calls ?? []) {
      if (call.args?.key !== key)
        continue
      if (UNLOCK_ACTIONS.has(call.type))
        writes.push({ value: call.args.value, chapterId, nodeId })
      else if (call.type === 'variables/set' && Array.isArray(call.args.value))
        writes.push(...call.args.value.map(value => ({ value, chapterId, nodeId })))
    }
  }
  for (const chapter of Object.values(program.chapters)) {
    for (const nodeId of chapter.order) {
      const node = chapter.nodes[nodeId]
      visit(node.actions, chapter.id, nodeId)
      const options = node.data?.options
      if (Array.isArray(options)) {
        for (const option of options) {
          if (isRecord(option) && Array.isArray(option.actions))
            visit(option.actions as unknown as RuntimeActionCall[], chapter.id, nodeId)
        }
      }
    }
  }
  return writes
}

/** Best-effort line of a literal in the chapter source, so editors can jump to it. */
function locate(options: ValidateGameExtrasOptions, chapterId: string, needle: string) {
  for (const path of options.chapterSources?.[chapterId] ?? []) {
    const lines = options.files?.get(path)?.split('\n') ?? []
    const index = lines.findIndex(line => line.includes(needle))
    if (index >= 0)
      return { path, line: index + 1 }
  }
  return { path: options.chapterSources?.[chapterId]?.[0] ?? options.gamePath }
}

/** The game settings line declaring `id`, falling back to the file itself. */
function locateSetting(options: ValidateGameExtrasOptions, id: string) {
  const lines = options.gamePath ? options.files?.get(options.gamePath)?.split('\n') ?? [] : []
  const index = lines.findIndex(line => line.includes(`"${id}"`))
  return index >= 0 ? { path: options.gamePath, line: index + 1 } : { path: options.gamePath }
}

function validateUnlocks(
  kind: AdvExtrasUnlockKind,
  extras: AdvGameExtrasConfig,
  options: ValidateGameExtrasOptions,
  diagnostics: AdvProjectDiagnostic[],
) {
  const config = extras[kind]
  if (!config)
    return
  const key = extrasUnlockKey(config, kind)
  const label = kind === 'endings' ? 'ending' : 'achievement'
  const code = kind === 'endings' ? 'ADV_PROJECT_UNKNOWN_ENDING' : 'ADV_PROJECT_UNKNOWN_ACHIEVEMENT'
  const progression = isRecord(options.game.progression) ? options.game.progression : undefined
  if (!Array.isArray(progression?.keys) || !progression.keys.includes(key)) {
    diagnostics.push({
      code: 'ADV_PROJECT_EXTRAS_NOT_PERSISTED',
      severity: 'warning',
      message: `${kind}.key "${key}" is not listed in progression.keys; new games do not inherit the unlock variable`,
      path: options.gamePath,
      suggestion: `Add "${key}" to progression.keys.`,
      certainty: 'certain',
    })
  }
  if (!options.program)
    return
  const declared = new Set(config.items.map(item => item.id))
  const written = new Set<string>()
  for (const write of collectUnlockWrites(options.program, key)) {
    if (typeof write.value === 'string')
      written.add(write.value)
    if (typeof write.value === 'string' && declared.has(write.value))
      continue
    const value = typeof write.value === 'string' ? write.value : JSON.stringify(write.value)
    diagnostics.push({
      code,
      severity: 'error',
      message: `Unknown ${label} "${value}" unlocked at ${write.chapterId}#${write.nodeId}`,
      ...locate(options, write.chapterId, value),
      suggestion: `Declare it in ${kind}.items of the game settings, or correct the ID.`,
      certainty: 'certain',
    })
  }
  for (const item of config.items) {
    if (written.has(item.id))
      continue
    diagnostics.push({
      code: kind === 'endings' ? 'ADV_PROJECT_UNREACHABLE_ENDING' : 'ADV_PROJECT_UNREACHABLE_ACHIEVEMENT',
      severity: 'warning',
      message: `No script action unlocks ${label} "${item.id}"`,
      ...locateSetting(options, item.id),
      suggestion: `Add a variables/push-unique action with key "${key}" and value "${item.id}".`,
      certainty: 'uncertain',
    })
  }
}

function validateReplays(extras: AdvGameExtrasConfig, options: ValidateGameExtrasOptions, diagnostics: AdvProjectDiagnostic[]) {
  if (!extras.replays?.length || !options.program)
    return
  const routeNodes = new Set(createRuntimeRouteGraph(options.program).nodes.map(node => node.id))
  for (const replay of extras.replays) {
    const chapter = options.program.chapters[replay.chapterId]
    const unknown = (message: string) => diagnostics.push({
      code: 'ADV_PROJECT_UNKNOWN_REPLAY_ANCHOR',
      severity: 'error',
      message: `Replay "${replay.id}" ${message}`,
      ...locateSetting(options, replay.id),
      suggestion: 'Use a chapter ID and an anchor written as `## Title {#anchor-id}`.',
      certainty: 'certain',
    })
    if (!chapter) {
      unknown(`references unknown chapter: ${replay.chapterId}`)
      continue
    }
    const start = replay.nodeId ?? chapter.entry
    if (!routeNodes.has(`${replay.chapterId}#${start}`))
      unknown(`starts at ${replay.chapterId}#${start}, which is not an anchor`)
    if (replay.endNodeId && (!routeNodes.has(`${replay.chapterId}#${replay.endNodeId}`) || replay.endNodeId === start))
      unknown(`ends at ${replay.chapterId}#${replay.endNodeId}; use a different anchor in the same chapter`)
  }
}

function validateMusicRoom(extras: AdvGameExtrasConfig, options: ValidateGameExtrasOptions, diagnostics: AdvProjectDiagnostic[]) {
  if (!extras.musicRoom?.tracks || !options.assets)
    return
  const bgms = new Set(options.assets.assets.filter(asset => asset.kind === 'bgm' && asset.state !== 'rejected').map(asset => asset.id))
  for (const track of extras.musicRoom.tracks) {
    if (bgms.has(track.id))
      continue
    diagnostics.push({
      code: 'ADV_PROJECT_UNKNOWN_MUSIC_TRACK',
      severity: 'error',
      message: `Music room track is not a BGM asset: ${track.id}`,
      ...locateSetting(options, track.id),
      suggestion: 'Register the track in adv/assets.json with type audio and kind bgm.',
      certainty: 'certain',
    })
  }
}

/** Diagnostics for `endings`, `achievements`, `replays` and `musicRoom` in game settings. */
export function validateGameExtras(options: ValidateGameExtrasOptions): AdvProjectDiagnostic[] {
  let extras: AdvGameExtrasConfig
  try {
    extras = parseGameExtras(options.game)
  }
  catch (error) {
    return [{
      code: 'ADV_PROJECT_INVALID_EXTRAS',
      severity: 'error',
      message: error instanceof Error ? error.message : String(error),
      path: options.gamePath,
      certainty: 'certain',
    }]
  }
  const diagnostics: AdvProjectDiagnostic[] = []
  validateUnlocks('endings', extras, options, diagnostics)
  validateUnlocks('achievements', extras, options, diagnostics)
  validateReplays(extras, options, diagnostics)
  validateMusicRoom(extras, options, diagnostics)
  return diagnostics
}
