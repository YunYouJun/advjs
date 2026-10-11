import { Blob as NodeBlob } from 'node:buffer'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryFsAdapter } from '../utils/fs/MemoryFsAdapter'

const storage = vi.hoisted(() => ({ rows: new Map<string, Record<string, unknown>>(), failNext: false, transactions: 0 }))
vi.mock('../utils/db', () => {
  const table = {
    where: () => ({ startsWith: (prefix: string) => ({
      primaryKeys: async () => [...storage.rows.keys()].filter(key => key.startsWith(prefix)),
      toArray: async () => [...storage.rows].filter(([key]) => key.startsWith(prefix)).map(([, row]) => row),
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
    async transaction(_mode: string, _table: unknown, operation: () => Promise<void>) {
      storage.transactions++
      const before = new Map(storage.rows)
      try {
        await operation()
      }
      catch (error) {
        storage.rows = before
        throw error
      }
    },
  } }
})
beforeEach(() => {
  storage.rows.clear()
  storage.failNext = false
  storage.transactions = 0
})
describe('portable atomic Studio media persistence', () => {
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
