import type { DevToolsSession, DevToolsSnapshot } from './types'
import { Buffer } from 'node:buffer'

const statuses = new Set(['idle', 'playing', 'waiting-choice', 'waiting-activity', 'ended', 'error'])
const resourceTypes = new Set(['chapter', 'character', 'scene', 'bgm', 'cg'])
const MAX_SNAPSHOT_BYTES = 512 * 1024

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/** Receive bounded JSON projections, never live objects or full configuration. */
export function readDevToolsSnapshot(value: unknown): DevToolsSnapshot | undefined {
  try {
    const json = JSON.stringify(value)
    if (!json || Buffer.byteLength(json) > MAX_SNAPSHOT_BYTES)
      return undefined
    const data: unknown = JSON.parse(json)
    if (!record(data) || typeof data.title !== 'string' || typeof data.url !== 'string'
      || !record(data.state) || !statuses.has(String(data.state.status))
      || !record(data.state.cursor) || typeof data.state.cursor.chapterId !== 'string'
      || typeof data.state.cursor.nodeId !== 'string' || !record(data.state.variables)
      || !record(data.state.stage) || !Array.isArray(data.trace) || data.trace.length > 100
      || !Array.isArray(data.resources) || !Array.isArray(data.diagnostics)) {
      return undefined
    }
    if (!data.resources.every(item => record(item) && resourceTypes.has(String(item.type))
      && typeof item.id === 'string' && typeof item.name === 'string')
    || !data.diagnostics.every(item => record(item) && typeof item.severity === 'string'
      && typeof item.code === 'string' && typeof item.message === 'string')
    || !data.trace.every(item => record(item) && typeof item.sequence === 'number'
      && typeof item.command === 'string' && record(item.to)
      && typeof item.to.chapterId === 'string' && typeof item.to.nodeId === 'string')) {
      return undefined
    }
    return data as unknown as DevToolsSnapshot
  }
  catch {
    return undefined
  }
}

export function createDevToolsSessions<Key>() {
  const sessions = new Map<Key, DevToolsSession>()
  let sequence = 0
  return {
    update(key: Key, value: unknown) {
      const snapshot = readDevToolsSnapshot(value)
      if (!snapshot)
        return false
      const previous = sessions.get(key)
      if (!previous && sessions.size >= 20)
        return false
      sessions.set(key, {
        id: previous?.id ?? `runtime-${++sequence}`,
        updatedAt: Date.now(),
        snapshot,
      })
      return true
    },
    remove: (key: Key) => sessions.delete(key),
    clear: () => sessions.clear(),
    list: () => structuredClone([...sessions.values()]),
  }
}
