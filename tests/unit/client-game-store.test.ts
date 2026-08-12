import type { AdvGameRecord } from '../../packages/client/stores/useAdvStore'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { createManualSaveSlot } from '../../packages/client/runtime/saves'
import { useGameStore } from '../../packages/client/stores/useGameStore'

function snapshot(programId: string): AdvGameRecord {
  return {
    schemaVersion: 1,
    program: { id: programId, hash: `${programId}-v1` },
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
  }
}

describe('client game record store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('isolates the same save slot by game namespace while preserving the legacy default', async () => {
    const store = useGameStore()
    const slot = createManualSaveSlot(1)

    await store.save(slot, snapshot('default-game'))

    store.setRecordNamespace('pominis:alpha')
    expect(await store.read(slot)).toBeUndefined()
    await store.save(slot, snapshot('alpha-game'))

    store.setRecordNamespace('pominis:beta')
    expect(await store.read(slot)).toBeUndefined()
    await store.save(slot, snapshot('beta-game'))

    store.setRecordNamespace('pominis:alpha')
    expect((await store.read(slot))?.snapshot.program.id).toBe('alpha-game')

    store.setRecordNamespace()
    expect((await store.read(slot))?.snapshot.program.id).toBe('default-game')
    expect(Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index)).sort()).toEqual([
      'advjs:records:1',
      'advjs:records:pominis%3Aalpha:1',
      'advjs:records:pominis%3Abeta:1',
    ])
  })
})
