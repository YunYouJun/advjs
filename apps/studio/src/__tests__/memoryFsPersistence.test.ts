import { Blob as NodeBlob } from 'node:buffer'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryFsAdapter } from '../utils/fs/MemoryFsAdapter'

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
})
