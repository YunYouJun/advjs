// @vitest-environment node

import { describe, expect, it } from 'vitest'
import { createAdvRuntime, defineAdvPlugin, diffRuntimeVariables } from '../../packages/core/src/runtime'

const program = {
  schemaVersion: 1 as const,
  id: 'trace-fixture',
  hash: 'trace-fixture-v1',
  entry: { chapterId: 'chapter-1', nodeId: 'line' },
  requiredPlugins: { test: '1.0.0' },
  chapters: {
    'chapter-1': {
      id: 'chapter-1',
      entry: 'line',
      order: ['line', 'choices', 'activity', 'result', 'end'],
      nodes: {
        line: {
          id: 'line',
          kind: 'dialog',
          next: { chapterId: 'chapter-1', nodeId: 'choices' },
        },
        choices: {
          id: 'choices',
          kind: 'choices',
          data: {
            options: [{
              id: 'observe',
              label: 'Observe',
              target: { chapterId: 'chapter-1', nodeId: 'activity' },
              actions: [{ type: 'variables/increment', args: { key: 'score', by: 1 } }],
            }],
          },
        },
        activity: {
          id: 'activity',
          kind: 'test/activity',
          next: { chapterId: 'chapter-1', nodeId: 'result' },
        },
        result: {
          id: 'result',
          kind: 'text',
          next: { chapterId: 'chapter-1', nodeId: 'end' },
        },
        end: { id: 'end', kind: 'end' },
      },
    },
    'chapter-2': {
      id: 'chapter-2',
      entry: 'arrival',
      order: ['arrival', 'end'],
      nodes: {
        arrival: { id: 'arrival', kind: 'text' },
        end: { id: 'end', kind: 'end' },
      },
    },
  },
}

const plugin = defineAdvPlugin({
  name: 'test',
  version: '1.0.0',
  nodes: {
    activity({ activity }) {
      activity('run')
    },
  },
  activities: {
    run({ state }) {
      state.variables.activityDone = true
    },
  },
})

describe('runtime trace variable diff', () => {
  it('reports created and changed scalar paths in sorted order', () => {
    expect(diffRuntimeVariables(
      { score: 1, profile: { mood: 'calm' } },
      { score: 2, profile: { mood: 'curious' }, unlocked: true },
    )).toEqual([
      { path: 'profile.mood', before: 'calm', after: 'curious' },
      { path: 'score', before: 1, after: 2 },
      { path: 'unlocked', after: true },
    ])
  })

  it('reports deletions without an after value', () => {
    expect(diffRuntimeVariables(
      { profile: { mood: 'calm', note: 'old' } },
      { profile: { mood: 'calm' } },
    )).toEqual([
      { path: 'profile.note', before: 'old' },
    ])
  })

  it('treats arrays and value type changes as path replacements', () => {
    expect(diffRuntimeVariables(
      { memories: ['one'], profile: { mood: 'calm' } },
      { memories: ['one', 'two'], profile: 'hidden' },
    )).toEqual([
      { path: 'memories', before: ['one'], after: ['one', 'two'] },
      { path: 'profile', before: { mood: 'calm' }, after: 'hidden' },
    ])
  })

  it('escapes literal dots and backslashes in object keys', () => {
    expect(diffRuntimeVariables(
      { 'a.b': 1, 'a\\b': 1 },
      { 'a.b': 2, 'a\\b': 2 },
    )).toEqual([
      { path: 'a\\.b', before: 1, after: 2 },
      { path: 'a\\\\b', before: 1, after: 2 },
    ])
  })

  it('returns no changes for deeply equal JSON with different key order', () => {
    expect(diffRuntimeVariables(
      { profile: { mood: 'calm', score: 1 }, memories: ['one'] },
      { memories: ['one'], profile: { score: 1, mood: 'calm' } },
    )).toEqual([])
  })
})

describe('core runtime command trace', () => {
  it('records every public command with inputs, effects, and variable changes', async () => {
    const runtime = createAdvRuntime({
      program,
      plugins: [plugin],
      initialVariables: { score: 0 },
    })

    await runtime.start()
    await runtime.next()
    await runtime.choose('observe')
    await runtime.completeActivity({ ok: true })
    const resultSnapshot = runtime.snapshot()
    await runtime.go('chapter-2#arrival')
    runtime.back()
    runtime.restore(resultSnapshot)

    expect(runtime.trace()).toEqual([
      expect.objectContaining({
        sequence: 1,
        command: 'start',
        from: { chapterId: 'chapter-1', nodeId: 'line' },
        to: { chapterId: 'chapter-1', nodeId: 'line' },
        status: 'playing',
      }),
      expect.objectContaining({ sequence: 2, command: 'next' }),
      expect.objectContaining({
        sequence: 3,
        command: 'choose',
        input: { choiceId: 'observe' },
        to: { chapterId: 'chapter-1', nodeId: 'activity' },
        status: 'waiting-activity',
        variableChanges: [{ path: 'score', before: 0, after: 1 }],
      }),
      expect.objectContaining({
        sequence: 4,
        command: 'complete-activity',
        input: { activityType: 'test/run' },
        to: { chapterId: 'chapter-1', nodeId: 'result' },
        variableChanges: [{ path: 'activityDone', after: true }],
      }),
      expect.objectContaining({
        sequence: 5,
        command: 'go',
        input: { target: { chapterId: 'chapter-2', nodeId: 'arrival' } },
      }),
      expect.objectContaining({ sequence: 6, command: 'back' }),
      expect.objectContaining({ sequence: 7, command: 'restore' }),
    ])
    expect(runtime.trace()[3].effects).toEqual([
      expect.objectContaining({ type: 'activity.complete' }),
    ])
  })

  it('bounds or disables trace storage and trace publication', async () => {
    const bounded = createAdvRuntime({ program, plugins: [plugin], maxTraceEntries: 2 })
    await bounded.start()
    await bounded.next()
    await bounded.choose('observe')
    expect(bounded.trace().map(entry => entry.sequence)).toEqual([2, 3])

    const disabled = createAdvRuntime({ program, plugins: [plugin], maxTraceEntries: 0 })
    const published: number[] = []
    disabled.subscribeTrace(entry => published.push(entry.sequence))
    await disabled.start()
    expect(disabled.trace()).toEqual([])
    expect(published).toEqual([])
    expect(() => createAdvRuntime({ program, plugins: [plugin], maxTraceEntries: -1 })).toThrow(/maxTraceEntries/)
  })

  it('supports unsubscribe and protects stored trace from mutation', async () => {
    const runtime = createAdvRuntime({ program, plugins: [plugin] })
    const published: number[] = []
    const stop = runtime.subscribeTrace((entry) => {
      published.push(entry.sequence)
      entry.from.nodeId = 'mutated'
    })

    await runtime.start()
    stop()
    await runtime.next()

    const returned = runtime.trace()
    returned[0].to.nodeId = 'also-mutated'
    expect(published).toEqual([1])
    expect(runtime.trace().map(entry => entry.from.nodeId)).toEqual(['line', 'line'])
    expect(runtime.trace()[0].to.nodeId).toBe('line')
  })
})
