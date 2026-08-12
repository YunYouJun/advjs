import type { RuntimeSaveRecord } from '../../packages/core/src/storage'
import { describe, expect, it } from 'vitest'
import { createBrowserRuntimeStorage } from '../../packages/client/runtime/storage'

class MemoryWebStorage implements Storage {
  private readonly values = new Map<string, string>()

  get length() {
    return this.values.size
  }

  clear(): void {
    this.values.clear()
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  key(index: number): string | null {
    return Array.from(this.values.keys())[index] ?? null
  }

  removeItem(key: string): void {
    this.values.delete(key)
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }
}

function record(id: string, updatedAt: number): RuntimeSaveRecord {
  return {
    id,
    snapshot: {
      schemaVersion: 1,
      program: { id: 'browser', hash: 'browser-v1' },
      state: {
        status: 'playing',
        cursor: { chapterId: 'chapter-1', nodeId: 'line' },
        variables: {},
        stage: { background: '', bgm: '', cg: '', tachies: {} },
        choices: [],
        visited: [],
      },
      checkpoints: [],
      createdAt: 1,
    },
    metadata: { slot: id },
    updatedAt,
  }
}

describe('browser runtime storage', () => {
  it('implements the shared clone-safe storage contract', async () => {
    const webStorage = new MemoryWebStorage()
    const storage = createBrowserRuntimeStorage({ storage: webStorage, prefix: 'test:' })
    const input = record('slot-a', 1)
    await storage.set(input)
    input.metadata!.slot = 'mutated'
    await storage.set(record('slot-b', 3))
    await storage.set(record('slot-c', 2))

    expect((await storage.list()).map(item => item.id)).toEqual(['slot-b', 'slot-c', 'slot-a'])
    const read = await storage.get('slot-a')
    expect(read?.metadata).toEqual({ slot: 'slot-a' })
    read!.snapshot.state.variables.changed = true
    expect((await storage.get('slot-a'))?.snapshot.state.variables).toEqual({})

    await storage.remove('slot-b')
    expect(await storage.get('slot-b')).toBeUndefined()
  })

  it('rejects malformed records before touching web storage', async () => {
    const webStorage = new MemoryWebStorage()
    const storage = createBrowserRuntimeStorage({ storage: webStorage })
    const invalid = record('bad', 1)
    Object.assign(invalid.metadata!, { value: undefined })

    await expect(storage.set(invalid)).rejects.toThrow(/ADV_RUNTIME_INVALID_SAVE_RECORD/)
    expect(webStorage.length).toBe(0)
  })
})
