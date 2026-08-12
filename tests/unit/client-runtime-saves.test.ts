import type { RuntimeSnapshot, RuntimeTraceEntry } from '@advjs/types'
import { createMemoryRuntimeStorage } from '@advjs/core'
import { describe, expect, it } from 'vitest'
import {
  createAutoSaveSlot,
  createGameSaveController,
  createManualSaveSlot,
  QUICK_SAVE_SLOT,
  shouldCreateAutoSave,
} from '../../packages/client/runtime/saves'

function snapshot(programId: string): RuntimeSnapshot {
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

function trace(overrides: Partial<RuntimeTraceEntry> = {}): RuntimeTraceEntry {
  return {
    sequence: 1,
    command: 'next',
    from: { chapterId: 'chapter-1', nodeId: 'line' },
    to: { chapterId: 'chapter-1', nodeId: 'next' },
    status: 'playing',
    effects: [],
    variableChanges: [],
    ...overrides,
  }
}

describe('game save controller', () => {
  it('keeps manual and quick saves independent behind one interface', async () => {
    let now = 10
    const saves = createGameSaveController({
      storage: createMemoryRuntimeStorage(),
      now: () => now++,
    })

    const manualSlot = createManualSaveSlot(1)
    const manual = await saves.save(manualSlot, snapshot('manual'), {
      memo: 'branch A',
      thumbnail: 'old-preview',
    })
    const quick = await saves.save(QUICK_SAVE_SLOT, snapshot('quick'))
    const overwritten = await saves.save(manualSlot, snapshot('manual-next'))

    expect(manual.meta.memo).toBe('branch A')
    expect(quick.snapshot.program.id).toBe('quick')
    expect(overwritten.meta).toMatchObject({ createdAt: 10, memo: 'branch A' })
    expect(overwritten.meta.thumbnail).toBeUndefined()
    expect((await saves.read(manualSlot))?.snapshot.program.id).toBe('manual-next')
    expect((await saves.list()).map(record => record.slot.kind)).toEqual(['manual', 'quick'])
  })

  it('fills auto slots and then replaces the oldest save', async () => {
    let now = 100
    const saves = createGameSaveController({
      storage: createMemoryRuntimeStorage(),
      now: () => now++,
    })

    await saves.autoSave(snapshot('auto-1'), { slots: 2 })
    await saves.autoSave(snapshot('auto-2'), { slots: 2 })
    const replacement = await saves.autoSave(snapshot('auto-3'), { slots: 2 })

    expect(replacement.slot).toEqual(createAutoSaveSlot(1))
    expect((await saves.read(createAutoSaveSlot(1)))?.snapshot.program.id).toBe('auto-3')
    expect((await saves.read(createAutoSaveSlot(2)))?.snapshot.program.id).toBe('auto-2')
  })

  it('autosaves only at stable recovery points', () => {
    expect(shouldCreateAutoSave(trace({ command: 'start' }))).toBe(true)
    expect(shouldCreateAutoSave(trace({ command: 'go' }))).toBe(true)
    expect(shouldCreateAutoSave(trace({ status: 'waiting-choice' }))).toBe(true)
    expect(shouldCreateAutoSave(trace({
      from: { chapterId: 'chapter-1', nodeId: 'end' },
      to: { chapterId: 'chapter-2', nodeId: 'start' },
    }))).toBe(true)
    expect(shouldCreateAutoSave(trace({ command: 'restore' }))).toBe(false)
    expect(shouldCreateAutoSave(trace())).toBe(false)
  })
})
