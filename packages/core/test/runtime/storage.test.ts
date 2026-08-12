import type { RuntimeSnapshot } from '@advjs/types'
import type { RuntimeSaveRecord, RuntimeStorage } from '../../src/storage'
import { describe, expect, it } from 'vitest'
import { createMemoryRuntimeStorage } from '../../src/storage'

function snapshot(id = 'program'): RuntimeSnapshot {
  return {
    schemaVersion: 1,
    program: { id, hash: `${id}-hash` },
    state: {
      status: 'playing',
      cursor: { chapterId: 'chapter-1', nodeId: 'line' },
      variables: { count: 1 },
      stage: { background: '', bgm: '', cg: '', tachies: {} },
      choices: [],
      visited: ['chapter-1#line'],
    },
    checkpoints: [],
    createdAt: 1,
  }
}

function record(id: string, updatedAt: number): RuntimeSaveRecord {
  return {
    id,
    snapshot: snapshot(),
    metadata: { label: id },
    updatedAt,
  }
}

async function exerciseStorage(storage: RuntimeStorage): Promise<void> {
  expect(await storage.list()).toEqual([])

  const first = record('slot-a', 10)
  await storage.set(first)
  first.snapshot.state.variables.count = 99
  first.metadata!.label = 'mutated'

  expect(await storage.get('slot-a')).toMatchObject({
    id: 'slot-a',
    snapshot: { state: { variables: { count: 1 } } },
    metadata: { label: 'slot-a' },
  })

  const read = await storage.get('slot-a')
  read!.snapshot.state.stage.background = 'mutated.webp'
  expect((await storage.get('slot-a'))?.snapshot.state.stage.background).toBe('')

  await storage.set(record('slot-b', 30))
  await storage.set(record('slot-c', 20))
  expect((await storage.list()).map(item => item.id)).toEqual(['slot-b', 'slot-c', 'slot-a'])

  await storage.set({ ...record('slot-a', 40), metadata: { label: 'overwritten' } })
  expect((await storage.list()).map(item => item.id)).toEqual(['slot-a', 'slot-b', 'slot-c'])
  expect(JSON.parse(JSON.stringify(await storage.get('slot-a')))).toEqual(await storage.get('slot-a'))

  await storage.remove('slot-b')
  await storage.remove('missing')
  expect((await storage.list()).map(item => item.id)).toEqual(['slot-a', 'slot-c'])
}

describe('runtime storage contract', () => {
  it('provides clone-safe, sorted memory records', async () => {
    await exerciseStorage(createMemoryRuntimeStorage())
  })

  it.each([
    ['empty id', () => ({ ...record('', 1) })],
    ['invalid timestamp', () => ({ ...record('slot', 1), updatedAt: Number.NaN })],
    ['invalid snapshot schema', () => {
      const value = record('slot', 1)
      value.snapshot.schemaVersion = 2 as 1
      return value
    }],
    ['non-json metadata', () => ({
      ...record('slot', 1),
      metadata: { invalid: undefined },
    })],
  ])('rejects %s records', async (_name, createRecord) => {
    const storage = createMemoryRuntimeStorage()
    await expect(storage.set(createRecord() as RuntimeSaveRecord)).rejects.toThrow(/ADV_RUNTIME_INVALID_SAVE_RECORD/)
    expect(await storage.list()).toEqual([])
  })
})
