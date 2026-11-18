import type {
  AdvGameConfig,
  AdvGameExtraItem,
  AdvGameMusicRoomConfig,
  AdvGameMusicTrack,
  AdvGameReplayConfig,
  AdvGameUnlockListConfig,
  JsonObject,
  JsonValue,
  RuntimeAddress,
  RuntimeProgram,
  RuntimeState,
} from '@advjs/types'

export const DEFAULT_ENDINGS_KEY = 'unlockedEndings'
export const DEFAULT_ACHIEVEMENTS_KEY = 'unlockedAchievements'

export type AdvExtrasUnlockKind = 'endings' | 'achievements'

export interface AdvGameExtrasConfig {
  endings?: AdvGameUnlockListConfig
  achievements?: AdvGameUnlockListConfig
  replays?: AdvGameReplayConfig[]
  musicRoom?: AdvGameMusicRoomConfig
}

export interface AdvMusicRoomTrack {
  id: string
  title: string
  description?: string
}

const ID_PATTERN = /^[\w:/.-]+$/u
const KEY_PATTERN = /^[A-Za-z_][\w-]*$/u
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function optionalString(value: Record<string, unknown>, field: string, path: string) {
  if (value[field] !== undefined && typeof value[field] !== 'string')
    throw new TypeError(`${path}.${field} must be a string`)
  return value[field] as string | undefined
}

function requiredId(value: Record<string, unknown>, field: string, path: string) {
  const id = value[field]
  if (typeof id !== 'string' || !ID_PATTERN.test(id))
    throw new TypeError(`${path}.${field} must be a non-empty identifier`)
  return id
}

function uniqueIds<T extends { id: string }>(items: T[], path: string) {
  const seen = new Set<string>()
  for (const item of items) {
    if (seen.has(item.id))
      throw new TypeError(`${path} contains duplicate id: ${item.id}`)
    seen.add(item.id)
  }
  return items
}

function parseItem(value: unknown, path: string): AdvGameExtraItem {
  if (!isRecord(value))
    throw new TypeError(`${path} must be an object`)
  const title = value.title
  if (typeof title !== 'string' || !title.trim())
    throw new TypeError(`${path}.title must be a non-empty string`)
  const hint = optionalString(value, 'hint', path)
  const description = optionalString(value, 'description', path)
  return {
    id: requiredId(value, 'id', path),
    title,
    ...(hint === undefined ? {} : { hint }),
    ...(description === undefined ? {} : { description }),
  }
}

function parseUnlockList(value: unknown, path: string): AdvGameUnlockListConfig {
  if (!isRecord(value) || !Array.isArray(value.items))
    throw new TypeError(`${path} must declare an items array`)
  const key = optionalString(value, 'key', path)
  if (key !== undefined && (!KEY_PATTERN.test(key) || FORBIDDEN_KEYS.has(key)))
    throw new TypeError(`${path}.key must be a top-level variable name`)
  return {
    ...(key === undefined ? {} : { key }),
    items: uniqueIds(value.items.map((item, index) => parseItem(item, `${path}.items[${index}]`)), `${path}.items`),
  }
}

function parseReplay(value: unknown, path: string): AdvGameReplayConfig {
  if (!isRecord(value))
    throw new TypeError(`${path} must be an object`)
  const title = value.title
  if (typeof title !== 'string' || !title.trim())
    throw new TypeError(`${path}.title must be a non-empty string`)
  if (value.variables !== undefined && !isRecord(value.variables))
    throw new TypeError(`${path}.variables must be an object`)
  const hint = optionalString(value, 'hint', path)
  const nodeId = value.nodeId === undefined ? undefined : requiredId(value, 'nodeId', path)
  const endNodeId = value.endNodeId === undefined ? undefined : requiredId(value, 'endNodeId', path)
  return {
    id: requiredId(value, 'id', path),
    title,
    ...(hint === undefined ? {} : { hint }),
    chapterId: requiredId(value, 'chapterId', path),
    ...(nodeId === undefined ? {} : { nodeId }),
    ...(endNodeId === undefined ? {} : { endNodeId }),
    ...(value.variables === undefined ? {} : { variables: structuredClone(value.variables) as JsonObject }),
  }
}

function parseMusicRoom(value: unknown, path: string): AdvGameMusicRoomConfig {
  if (!isRecord(value))
    throw new TypeError(`${path} must be an object`)
  if (value.tracks === undefined)
    return {}
  if (!Array.isArray(value.tracks))
    throw new TypeError(`${path}.tracks must be an array`)
  return {
    tracks: uniqueIds(value.tracks.map((track, index): AdvGameMusicTrack => {
      const trackPath = `${path}.tracks[${index}]`
      if (!isRecord(track))
        throw new TypeError(`${trackPath} must be an object`)
      const title = optionalString(track, 'title', trackPath)
      const description = optionalString(track, 'description', trackPath)
      return {
        id: requiredId(track, 'id', trackPath),
        ...(title === undefined ? {} : { title }),
        ...(description === undefined ? {} : { description }),
      }
    }), `${path}.tracks`),
  }
}

/**
 * Validate the extras fields of a `game.json` record. Throws a `TypeError`
 * naming the first invalid field; absent fields stay absent.
 */
export function parseGameExtras(game: Readonly<Record<string, unknown>>): AdvGameExtrasConfig {
  const extras: AdvGameExtrasConfig = {}
  if (game.endings !== undefined)
    extras.endings = parseUnlockList(game.endings, 'endings')
  if (game.achievements !== undefined)
    extras.achievements = parseUnlockList(game.achievements, 'achievements')
  if (game.replays !== undefined) {
    if (!Array.isArray(game.replays))
      throw new TypeError('replays must be an array')
    extras.replays = uniqueIds(game.replays.map((replay, index) => parseReplay(replay, `replays[${index}]`)), 'replays')
  }
  if (game.musicRoom !== undefined)
    extras.musicRoom = parseMusicRoom(game.musicRoom, 'musicRoom')
  return extras
}

export function extrasUnlockKey(config: AdvGameUnlockListConfig | undefined, kind: AdvExtrasUnlockKind): string {
  return config?.key ?? (kind === 'endings' ? DEFAULT_ENDINGS_KEY : DEFAULT_ACHIEVEMENTS_KEY)
}

/** Declared IDs present in the unlock variable, in declaration order. Unknown values are ignored. */
export function unlockedExtraIds(
  config: AdvGameUnlockListConfig | undefined,
  kind: AdvExtrasUnlockKind,
  variables: Readonly<JsonObject> | undefined,
): string[] {
  const value: JsonValue | undefined = variables?.[extrasUnlockKey(config, kind)]
  if (!config || !Array.isArray(value))
    return []
  const present = new Set(value.filter((item): item is string => typeof item === 'string'))
  return config.items.filter(item => present.has(item.id)).map(item => item.id)
}

export function replayStartAddress(replay: AdvGameReplayConfig, program?: RuntimeProgram): RuntimeAddress | undefined {
  const nodeId = replay.nodeId ?? program?.chapters[replay.chapterId]?.entry
  return nodeId ? { chapterId: replay.chapterId, nodeId } : undefined
}

/** A replay is available once its start anchor was reached in any recorded playthrough. */
export function isReplayAvailable(
  replay: AdvGameReplayConfig,
  visited: ReadonlySet<string> | readonly string[],
  program?: RuntimeProgram,
): boolean {
  const start = replayStartAddress(replay, program)
  if (!start)
    return false
  const key = `${start.chapterId}#${start.nodeId}`
  return Array.isArray(visited) ? visited.includes(key) : (visited as ReadonlySet<string>).has(key)
}

/**
 * Whether an isolated replay session has played past its scene: the runtime
 * ended, reached `endNodeId`, or entered another chapter.
 */
export function isReplayFinished(
  replay: AdvGameReplayConfig,
  state: { readonly status: RuntimeState['status'], readonly visited: readonly string[] },
): boolean {
  if (state.status === 'ended')
    return true
  const end = replay.endNodeId ? `${replay.chapterId}#${replay.endNodeId}` : undefined
  return state.visited.some(address => address === end || !address.startsWith(`${replay.chapterId}#`))
}

/** Music room entries: declared tracks, or every BGM asset when none are declared. */
export function musicRoomTracks(game: Pick<AdvGameConfig, 'audio' | 'musicRoom'>): AdvMusicRoomTrack[] {
  const assets = game.audio?.assets ?? {}
  const declared: AdvGameMusicTrack[] = game.musicRoom?.tracks
    ?? Object.entries(assets).filter(([, asset]) => asset.kind === 'bgm').map(([id]) => ({ id }))
  return declared
    .filter(track => assets[track.id]?.kind === 'bgm')
    .map((track): AdvMusicRoomTrack => ({
      id: track.id,
      title: track.title ?? assets[track.id].title ?? track.id,
      ...(track.description ? { description: track.description } : {}),
    }))
}
