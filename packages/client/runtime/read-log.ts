import type { RuntimeProgram, RuntimeState } from '@advjs/types'
import type { DeepReadonly, Ref } from 'vue'
import { runtimeAddressKey } from '@advjs/core'
import { readonly, shallowRef } from 'vue'

export interface BrowserReadLogOptions {
  /** Omit for a session-only log, such as Studio draft playback. */
  storage?: Storage
  prefix?: string
}

/**
 * Player-facing read history shared by every playthrough of one compiled program.
 *
 * Node keys use `runtimeAddressKey()` (`chapter#node`), the same form as `RuntimeState.visited`.
 */
export interface RuntimeReadLogController {
  readonly storageKey?: string
  /** Increments whenever the log changes, so views can track it reactively. */
  readonly revision: DeepReadonly<Ref<number>>
  /** Whether the current node had been read before the runtime last entered it. */
  readonly currentWasRead: DeepReadonly<Ref<boolean>>
  isRead: (address: string) => boolean
  isChoiceTaken: (address: string, choiceId: string) => boolean
  /** Merge visited nodes and choices from a runtime state update. */
  capture: (state: Readonly<RuntimeState>, options?: { restored?: boolean }) => void
  clear: () => void
}

interface StoredReadLog {
  schemaVersion: 1
  hash: string
  nodes: string[]
  choices: Record<string, string[]>
}

function readStored(storage: Storage | undefined, key: string, hash: string): Omit<StoredReadLog, 'schemaVersion' | 'hash'> {
  const empty = { nodes: [], choices: {} }
  if (!storage)
    return empty
  try {
    const raw = storage.getItem(key)
    if (!raw)
      return empty
    const parsed = JSON.parse(raw) as Partial<StoredReadLog>
    // A changed script may reuse node IDs for different lines; start a fresh log.
    if (parsed.schemaVersion !== 1 || parsed.hash !== hash || !Array.isArray(parsed.nodes))
      return empty
    const choices: Record<string, string[]> = Object.create(null)
    if (parsed.choices && typeof parsed.choices === 'object' && !Array.isArray(parsed.choices)) {
      for (const [address, ids] of Object.entries(parsed.choices)) {
        if (Array.isArray(ids))
          choices[address] = ids.filter(id => typeof id === 'string')
      }
    }
    return { nodes: parsed.nodes.filter(node => typeof node === 'string'), choices }
  }
  catch {
    return empty
  }
}

export function createBrowserReadLog(
  program: Pick<RuntimeProgram, 'id' | 'hash'>,
  options: BrowserReadLogOptions = {},
): RuntimeReadLogController {
  const { storage } = options
  const storageKey = storage ? `${options.prefix ?? 'advjs:read-log:'}${encodeURIComponent(program.id)}` : undefined
  const stored = readStored(storage, storageKey ?? '', program.hash)
  const nodes = new Set(stored.nodes)
  const choices = new Map(Object.entries(stored.choices).map(([address, ids]) => [address, new Set(ids)]))
  const revision = shallowRef(0)
  const currentWasRead = shallowRef(false)
  let currentAddress: string | undefined

  function persist() {
    if (!storage || !storageKey) {
      revision.value++
      return
    }
    // Another tab or player instance may have seen a different branch.
    const latest = readStored(storage, storageKey, program.hash)
    for (const address of latest.nodes)
      nodes.add(address)
    for (const [address, ids] of Object.entries(latest.choices)) {
      if (!choices.has(address))
        choices.set(address, new Set())
      for (const id of ids)
        choices.get(address)!.add(id)
    }
    revision.value++
    const record: StoredReadLog = {
      schemaVersion: 1,
      hash: program.hash,
      nodes: [...nodes],
      choices: Object.fromEntries([...choices].map(([address, ids]) => [address, [...ids]])),
    }
    try {
      storage.setItem(storageKey, JSON.stringify(record))
    }
    catch (error) {
      console.warn('[advjs] Failed to persist read log', error)
    }
  }

  return {
    storageKey,
    revision: readonly(revision),
    currentWasRead: readonly(currentWasRead),
    isRead: address => nodes.has(address),
    isChoiceTaken: (address, choiceId) => choices.get(address)?.has(choiceId) ?? false,
    capture(state, { restored = false } = {}) {
      if (state.status === 'idle') {
        currentAddress = undefined
        currentWasRead.value = false
        return
      }
      const address = runtimeAddressKey(state.cursor)
      // A restored snapshot can supply read history that predates the browser log.
      if (restored || address !== currentAddress) {
        currentAddress = address
        currentWasRead.value = nodes.has(address) || (restored && state.visited.includes(address))
      }
      let changed = false
      for (const visited of state.visited) {
        if (!nodes.has(visited)) {
          nodes.add(visited)
          changed = true
        }
      }
      for (const record of state.choices) {
        const key = runtimeAddressKey(record.node)
        let ids = choices.get(key)
        if (!ids)
          choices.set(key, ids = new Set())
        if (!ids.has(record.choiceId)) {
          ids.add(record.choiceId)
          changed = true
        }
      }
      if (changed)
        persist()
    },
    clear() {
      nodes.clear()
      choices.clear()
      currentWasRead.value = false
      revision.value++
      if (storage && storageKey) {
        try {
          storage.removeItem(storageKey)
        }
        catch {}
      }
    },
  }
}
