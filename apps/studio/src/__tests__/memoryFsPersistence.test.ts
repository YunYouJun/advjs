import type { IFileSystem } from '../utils/fs'
import { Blob as NodeBlob } from 'node:buffer'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryFsAdapter } from '../utils/fs/MemoryFsAdapter'
import { flushStudioFileMutations, observeStudioFileSystem, subscribeStudioFileMutations, whenStudioFileMutationsSettle } from '../utils/fs/mutations'

const storage = vi.hoisted(() => ({ rows: new Map<string, Record<string, unknown>>(), failNext: false, failRead: false, transactions: 0, queue: Promise.resolve() }))
vi.mock('../utils/db', () => {
  const table = {
    where: () => ({ startsWith: (prefix: string) => ({
      primaryKeys: async () => [...storage.rows.keys()].filter(key => key.startsWith(prefix)),
      toArray: async () => {
        if (storage.failRead)
          throw new Error('simulated read failure')
        return [...storage.rows].filter(([key]) => key.startsWith(prefix)).map(([, row]) => row)
      },
    }) }),
    async bulkDelete(keys: string[]) {
      for (const key of keys)
        storage.rows.delete(key)
    },
    async bulkPut(rows: Array<Record<string, unknown>>) {
      if (storage.failNext) {
        storage.failNext = false
        throw new Error('simulated storage failure')
      }
      for (const row of rows)
        storage.rows.set(String(row.key), row)
    },
  }
  return { db: {
    table: () => table,
    async transaction(_mode: string, _table: unknown, operation: () => Promise<unknown>) {
      storage.transactions++
      const pending = storage.queue.then(async () => {
        const before = new Map(storage.rows)
        try {
          return await operation()
        }
        catch (error) {
          storage.rows = before
          throw error
        }
      })
      storage.queue = pending.then(() => {}, () => {})
      return pending
    },
  } }
})
beforeEach(() => {
  storage.rows.clear()
  storage.failNext = false
  storage.failRead = false
  storage.transactions = 0
  storage.queue = Promise.resolve()
})
describe('portable atomic Studio media persistence', () => {
  it('provides a strict durable barrier that reports storage failure and restores bytes across immediate reload', async () => {
    const fs = new MemoryFsAdapter('strict-project')
    await fs.writeFile('adv/world.md', 'Before')
    await fs.flush()
    await fs.writeFile('adv/world.md', 'After')
    storage.failNext = true
    await expect(fs.flush()).rejects.toThrow('simulated storage failure')
    const previous = new MemoryFsAdapter('strict-project')
    await previous.init()
    expect(await previous.readFile('adv/world.md')).toBe('Before')
    await fs.flush()
    const restored = new MemoryFsAdapter('strict-project')
    await restored.init()
    expect(await restored.readFile('adv/world.md')).toBe('After')
  })
  it('restores unchanged binary bytes and MIME across adapter reload, without IndexedDB Blob cloning', async () => {
    const fs = new MemoryFsAdapter('project')
    await fs.writeFile('adv/chapters/intro.adv.md', 'Current source')
    await fs.writeBlob('public/voice.wav', new NodeBlob([new Uint8Array([0, 128, 255])], { type: 'audio/wav' }) as Blob)
    await fs.persist()
    const row = storage.rows.get('memfs:project:public/voice.wav')!
    expect(row.blob).toBeUndefined()
    expect(new Uint8Array(row.binary as ArrayBuffer)).toEqual(new Uint8Array([0, 128, 255]))
    expect(row.mimeType).toBe('audio/wav')
    vi.stubGlobal('Blob', NodeBlob)
    try {
      const reloaded = new MemoryFsAdapter('project')
      await reloaded.init()
      expect(await reloaded.readFile('adv/chapters/intro.adv.md')).toBe('Current source')
      const media = await reloaded.readBlob('public/voice.wav')
      expect(media.type).toBe('audio/wav')
      expect(new Uint8Array(await media.arrayBuffer())).toEqual(new Uint8Array([0, 128, 255]))
    }
    finally { vi.unstubAllGlobals() }
    expect(storage.transactions).toBe(1)
  })
  it('retains old Blob rows and other project scopes when upgrading a persisted project', async () => {
    const blob = new NodeBlob([new Uint8Array([1, 2])], { type: 'audio/wav' })
    storage.rows.set('memfs:legacy:voice.wav', { key: 'memfs:legacy:voice.wav', type: 'file', blob, size: 2, mtime: 0 })
    storage.rows.set('memfs:other:source.md', { key: 'memfs:other:source.md', type: 'file', content: 'Other account project', size: 21, mtime: 0 })
    const fs = new MemoryFsAdapter('legacy')
    await fs.init()
    expect(await fs.readBlob('voice.wav')).toBe(blob)
    await fs.persist()
    expect(new Uint8Array(storage.rows.get('memfs:legacy:voice.wav')!.binary as ArrayBuffer)).toEqual(new Uint8Array([1, 2]))
    expect(storage.rows.get('memfs:other:source.md')!.content).toBe('Other account project')
  })
  it('preserves the previous complete snapshot on storage failure and lets a later queued flush succeed', async () => {
    const fs = new MemoryFsAdapter('project')
    await fs.writeFile('source.md', 'Before')
    await fs.persist()
    await fs.writeFile('source.md', 'After')
    storage.failNext = true
    await fs.persist()
    expect(storage.rows.get('memfs:project:source.md')!.content).toBe('Before')
    await fs.persist()
    expect(storage.rows.get('memfs:project:source.md')!.content).toBe('After')
  })
})

describe('independent Studio memory workspaces', () => {
  async function pair() {
    const first = new MemoryFsAdapter('shared')
    await first.writeFile('adv/world.md', 'Original world')
    await first.writeFile('adv/chapters/intro.adv.md', 'Original chapter')
    await first.flush()
    const second = new MemoryFsAdapter('shared')
    await second.init()
    return { first, second }
  }

  it('merges disjoint edits and refreshes untouched paths instead of replacing a project snapshot', async () => {
    const { first, second } = await pair()
    await first.writeFile('adv/world.md', 'New world')
    await second.writeFile('adv/chapters/intro.adv.md', 'New chapter')
    await Promise.all([first.flush(), second.flush()])
    await first.refresh()
    expect(await first.readFile('adv/chapters/intro.adv.md')).toBe('New chapter')
    expect(await second.readFile('adv/world.md')).toBe('New world')
    const restored = new MemoryFsAdapter('shared')
    await restored.init()
    expect(await restored.readFile('adv/world.md')).toBe('New world')
    expect(await restored.readFile('adv/chapters/intro.adv.md')).toBe('New chapter')
  })

  it('rejects an entire stale batch and retains its draft without overwriting the other window', async () => {
    const { first, second } = await pair()
    await first.writeFile('adv/world.md', 'Saved author change')
    await first.flush()
    await second.writeFile('adv/world.md', 'Stale candidate')
    await second.writeFile('adv/chapters/intro.adv.md', 'Dependent candidate')
    await expect(second.flush()).rejects.toThrow('ADV_STUDIO_SOURCE_CONFLICT')
    await expect(second.refresh()).rejects.toThrow('ADV_STUDIO_SOURCE_CONFLICT')
    expect(await second.readFile('adv/world.md')).toBe('Stale candidate')
    const restored = new MemoryFsAdapter('shared')
    await restored.init()
    expect(await restored.readFile('adv/world.md')).toBe('Saved author change')
    expect(await restored.readFile('adv/chapters/intro.adv.md')).toBe('Original chapter')
    // Clear the scheduled nonfatal retry while keeping the conflicting draft.
    await second.persist()
  })

  it('preserves remote creations/deletions and refuses to resurrect a remotely removed parent', async () => {
    const { first, second } = await pair()
    await first.deleteFile('adv/world.md')
    await first.writeFile('adv/new.md', 'Created elsewhere')
    await first.flush()
    await second.writeFile('adv/chapters/intro.adv.md', 'Only my chapter')
    await second.flush()
    expect(await second.exists('adv/world.md')).toBe(false)
    expect(await second.readFile('adv/new.md')).toBe('Created elsewhere')
    await first.refresh()
    await first.rmdir('adv/chapters')
    await first.flush()
    await second.writeFile('adv/chapters/other.adv.md', 'Stale new child')
    await expect(second.flush()).rejects.toThrow('ADV_STUDIO_SOURCE_CONFLICT')
  })

  it('rejects recursive removal when another window added a child', async () => {
    const { first, second } = await pair()
    await second.rmdir('adv/chapters')
    await first.writeFile('adv/chapters/new.adv.md', 'New child')
    await first.flush()
    await expect(second.flush()).rejects.toThrow('ADV_STUDIO_SOURCE_CONFLICT')
    expect(storage.rows.get('memfs:shared:adv/chapters/new.adv.md')?.content).toBe('New child')
  })

  it('does not discard a newer local edit while an earlier queued snapshot is committing', async () => {
    const { first } = await pair()
    await first.writeFile('adv/world.md', 'First edit')
    const earlier = first.flush()
    await first.writeFile('adv/world.md', 'Second edit')
    const later = first.flush()
    await Promise.all([earlier, later])
    expect(await first.readFile('adv/world.md')).toBe('Second edit')
    expect(storage.rows.get('memfs:shared:adv/world.md')?.content).toBe('Second edit')
  })

  it('rejects stale deletion and an intervening edit even when the saved text returns to its original bytes', async () => {
    const { first, second } = await pair()
    await first.writeFile('adv/world.md', 'Intervening edit')
    await first.flush()
    await first.writeFile('adv/world.md', 'Original world')
    await first.flush()
    await second.deleteFile('adv/world.md')
    await expect(second.flush()).rejects.toThrow('ADV_STUDIO_SOURCE_CONFLICT')
    expect(storage.rows.get('memfs:shared:adv/world.md')?.content).toBe('Original world')
  })

  it('refreshes an independent change while retaining an unpersisted draft', async () => {
    const { first, second } = await pair()
    await second.writeFile('adv/world.md', 'My unsaved draft')
    await first.writeFile('adv/chapters/intro.adv.md', 'Remote chapter')
    await first.flush()
    await second.refresh()
    expect(await second.readFile('adv/world.md')).toBe('My unsaved draft')
    expect(await second.readFile('adv/chapters/intro.adv.md')).toBe('Remote chapter')
    await second.flush()
    expect(storage.rows.get('memfs:shared:adv/world.md')?.content).toBe('My unsaved draft')
  })

  it('reports an unreadable project instead of opening an empty workspace', async () => {
    await pair()
    storage.failRead = true
    await expect(new MemoryFsAdapter('shared').init()).rejects.toThrow('simulated read failure')
    expect(storage.rows.get('memfs:shared:adv/world.md')?.content).toBe('Original world')
  })

  it.each(['modify', 'create', 'delete'] as const)('rejects a whole-project transaction when another instance performs an unrelated %s', async (operation) => {
    const { first, second } = await pair()
    await expect(second.transaction(async (scope) => {
      await scope.writeFile('adv/chapters/intro.adv.md', 'Candidate')
      await scope.flush?.()
      expect(await second.readFile('adv/chapters/intro.adv.md')).toBe('Original chapter')
      if (operation === 'modify')
        await first.writeFile('adv/world.md', 'Author changed the constraints')
      else if (operation === 'create')
        await first.writeFile('adv/new.md', 'New constraint')
      else
        await first.deleteFile('adv/world.md')
      await first.flush()
    })).rejects.toThrow('ADV_STUDIO_SOURCE_CONFLICT')
    await second.refresh()
    expect(await second.readFile('adv/chapters/intro.adv.md')).toBe('Original chapter')
    expect(await second.exists('adv/world.md')).toBe(operation !== 'delete')
    expect(await second.exists('adv/new.md')).toBe(operation === 'create')
  })

  it('isolates staged files, blocks concurrent same-instance writes and expires the scoped view', async () => {
    const { first } = await pair()
    let view: IFileSystem | undefined
    await first.transaction(async (scope) => {
      view = scope
      await scope.writeFile('adv/world.md', 'Validated candidate')
      await scope.flush?.()
      await scope.refresh?.()
      expect(await scope.readFile('adv/world.md')).toBe('Validated candidate')
      expect(await first.readFile('adv/world.md')).toBe('Original world')
      await expect(first.writeFile('adv/new.md', 'Concurrent draft')).rejects.toThrow('ADV_STUDIO_TRANSACTION_BUSY')
    })
    expect(await first.readFile('adv/world.md')).toBe('Validated candidate')
    expect(await first.exists('adv/new.md')).toBe(false)
    await expect(view!.readFile('adv/world.md')).rejects.toThrow('ADV_STUDIO_TRANSACTION_BUSY')
    await expect(view!.writeFile('adv/world.md', 'Late write')).rejects.toThrow('ADV_STUDIO_TRANSACTION_BUSY')
  })

  it('discards failed validation without compensating writes and allows a fresh transaction after storage failure', async () => {
    const { first } = await pair()
    await expect(first.transaction(async (scope) => {
      await scope.writeFile('adv/world.md', 'Rejected candidate')
      throw new Error('post-write validation rejected')
    })).rejects.toThrow('post-write validation rejected')
    expect(await first.readFile('adv/world.md')).toBe('Original world')
    storage.failNext = true
    await expect(first.transaction(scope => scope.writeFile('adv/world.md', 'Storage candidate'))).rejects.toThrow('simulated storage failure')
    expect(await first.readFile('adv/world.md')).toBe('Original world')
    expect(storage.rows.get('memfs:shared:adv/world.md')?.content).toBe('Original world')
    await first.transaction(scope => scope.writeFile('adv/world.md', 'Reviewed retry'))
    expect(await first.readFile('adv/world.md')).toBe('Reviewed retry')
  })

  it('revalidates scope inside the actual durable transaction and aborts changes already issued to storage', async () => {
    const { first } = await pair()
    await expect(first.transaction(scope => scope.writeFile('adv/world.md', 'Candidate'), () => {
      if (storage.rows.get('memfs:shared:adv/world.md')?.content === 'Candidate')
        throw new Error('account changed while committing')
    })).rejects.toThrow('account changed while committing')
    expect(storage.rows.get('memfs:shared:adv/world.md')?.content).toBe('Original world')
    expect(await first.readFile('adv/world.md')).toBe('Original world')
  })

  it('does not mark a fresh observer-triggered author edit as part of the completed durable transaction', async () => {
    const { first } = await pair()
    observeStudioFileSystem(first)
    let written = false
    const unsubscribe = subscribeStudioFileMutations(first, (event) => {
      if (!event.pending && !written) {
        written = true
        void first.writeFile('adv/world.md', 'Next author edit')
      }
    })
    try {
      await first.transaction(scope => scope.writeFile('adv/world.md', 'Candidate'))
      await whenStudioFileMutationsSettle(first)
      await flushStudioFileMutations(first)
      expect(storage.rows.get('memfs:shared:adv/world.md')?.content).toBe('Next author edit')
    }
    finally { unsubscribe() }
  })
})

/** Transport-only fixture; real two-page delivery is covered separately in Playwright. */
function broadcastFixture() {
  const channels = new Set<Channel>()
  const messages: Array<{ name: string, data: unknown }> = []
  class Channel {
    listeners = new Set<(event: MessageEvent) => void>()
    active = true
    constructor(readonly name: string) { channels.add(this) }
    addEventListener(_type: string, listener: (event: MessageEvent) => void) { this.listeners.add(listener) }
    removeEventListener(_type: string, listener: (event: MessageEvent) => void) { this.listeners.delete(listener) }
    postMessage(data: unknown) {
      messages.push({ name: this.name, data: structuredClone(data) })
      for (const peer of channels) {
        if (peer !== this && peer.name === this.name) {
          queueMicrotask(() => {
            if (peer.active) {
              for (const listener of peer.listeners)
                listener({ data: structuredClone(data) } as MessageEvent)
            }
          })
        }
      }
    }

    close() {
      this.active = false
      channels.delete(this)
    }
  }
  vi.stubGlobal('BroadcastChannel', Channel)
  return { channels, messages }
}

describe('durable cross-window memory hints', () => {
  async function pair() {
    const first = new MemoryFsAdapter('notified')
    await first.writeFile('adv/world.md', 'Original world')
    await first.writeFile('adv/chapters/intro.adv.md', 'Original chapter')
    await first.flush()
    const second = new MemoryFsAdapter('notified')
    await second.init()
    return { first, second }
  }

  it('notifies another instance only after durable commits, with no source bytes or self echo', async () => {
    const transport = broadcastFixture()
    const { first, second } = await pair()
    const own = vi.fn()
    const remote = vi.fn()
    const stopOwn = first.subscribeExternalChanges(own)
    const stopRemote = second.subscribeExternalChanges(remote)
    try {
      await first.writeFile('adv/world.md', 'Saved secret source')
      expect(remote).not.toHaveBeenCalled()
      await first.flush()
      expect(remote).toHaveBeenCalledOnce()
      expect(own).not.toHaveBeenCalled()
      await first.transaction(scope => scope.writeFile('adv/world.md', 'Atomic saved source'))
      expect(remote).toHaveBeenCalledTimes(2)
      expect(own).not.toHaveBeenCalled()
      await first.writeFile('adv/world.md', 'Failed source')
      storage.failNext = true
      await expect(first.flush()).rejects.toThrow('simulated storage failure')
      expect(remote).toHaveBeenCalledTimes(2)
      await first.flush()
      expect(remote).toHaveBeenCalledTimes(3)
      for (const message of transport.messages)
        expect(message.data).toEqual({ protocolVersion: 1, sender: expect.any(String) })
    }
    finally {
      stopOwn()
      stopRemote()
      vi.unstubAllGlobals()
    }
    expect(transport.channels.size).toBe(0)
  })

  it('revises observation state without flushing a clean adapter or accepting message contents as files', async () => {
    const transport = broadcastFixture()
    const { first, second } = await pair()
    observeStudioFileSystem(second)
    const events: boolean[] = []
    const stop = subscribeStudioFileMutations(second, event => events.push(Boolean(event.external)))
    try {
      await first.writeFile('adv/world.md', 'Durable remote world')
      await first.flush()
      expect(events).toEqual([true])
      const writes = storage.transactions
      await flushStudioFileMutations(second)
      expect(storage.transactions).toBe(writes)
      expect(await second.readFile('adv/world.md')).toBe('Original world')
      await second.refresh()
      expect(await second.readFile('adv/world.md')).toBe('Durable remote world')
      stop()
      await first.writeFile('adv/world.md', 'After unsubscribe')
      await first.flush()
      expect(events).toEqual([true])
    }
    finally {
      stop()
      vi.unstubAllGlobals()
    }
    expect(transport.channels.size).toBe(0)
  })

  it('preserves a dirty local draft and isolates other project notifications', async () => {
    const transport = broadcastFixture()
    const { first, second } = await pair()
    observeStudioFileSystem(second)
    const remote = vi.fn()
    const stop = subscribeStudioFileMutations(second, event => event.external && remote())
    try {
      await second.writeFile('adv/chapters/intro.adv.md', 'My draft')
      const other = new MemoryFsAdapter('other-project')
      await other.writeFile('adv/world.md', 'Different project')
      await other.flush()
      expect(remote).not.toHaveBeenCalled()
      await first.writeFile('adv/world.md', 'Remote world')
      await first.flush()
      expect(remote).toHaveBeenCalledOnce()
      await flushStudioFileMutations(second)
      expect(storage.rows.get('memfs:notified:adv/chapters/intro.adv.md')?.content).toBe('My draft')
      expect(await second.readFile('adv/world.md')).toBe('Remote world')
    }
    finally {
      stop()
      vi.unstubAllGlobals()
    }
    expect(transport.channels.size).toBe(0)
  })

  it('keeps persistence and explicit refresh available when the broadcast API is unavailable', async () => {
    vi.stubGlobal('BroadcastChannel', undefined)
    const { first, second } = await pair()
    const remote = vi.fn()
    const stop = second.subscribeExternalChanges(remote)
    try {
      await first.writeFile('adv/world.md', 'Without notification')
      await first.flush()
      expect(remote).not.toHaveBeenCalled()
      await second.refresh()
      expect(await second.readFile('adv/world.md')).toBe('Without notification')
    }
    finally {
      stop()
      vi.unstubAllGlobals()
    }
  })
})
