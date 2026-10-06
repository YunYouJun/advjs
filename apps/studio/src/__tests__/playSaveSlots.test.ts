// @vitest-environment node

import type { RuntimeSnapshot } from '@advjs/types'
import { describe, expect, it, vi } from 'vitest'
import { usePlaySaveSlots } from '../composables/usePlaySaveSlots'

const database = vi.hoisted(() => ({ rows: [] as unknown[] }))
vi.mock('../utils/db', () => ({ db: { playSaveSlots: {
  where: () => ({ equals: () => ({ toArray: async () => database.rows }) }),
} } }))

describe('studio save slot selection', () => {
  it('keeps loaded snapshots cloneable when emitted from the slot list to the runtime', async () => {
    const snapshot: RuntimeSnapshot = {
      schemaVersion: 1,
      program: { id: 'preview', hash: 'fixture' },
      state: {
        status: 'playing',
        cursor: { chapterId: 'one', nodeId: 'line-1' },
        variables: { affection: 3 },
        stage: { background: '', bgm: '', tachies: {}, cg: '' },
        choices: [],
        visited: ['one#line-1'],
      },
      checkpoints: [],
      createdAt: 1,
    }
    database.rows = [{ slot: 'slot-01', snapshot, savedAt: 1 }]
    const saves = usePlaySaveSlots(() => 'project')
    await saves.refresh()
    expect(saves.hasSlots.value).toBe(true)
    const restored = structuredClone(saves.slots.value[0].snapshot)
    expect(restored).toEqual(snapshot)
    restored.state.variables.affection = 10
    expect(saves.slots.value[0].snapshot.state.variables.affection).toBe(3)
    database.rows = []
    await saves.refresh()
    expect(saves.hasSlots.value).toBe(false)
  })
})
