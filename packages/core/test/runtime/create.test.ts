import type { RuntimeEffect, RuntimeProgram, RuntimeState } from '@advjs/types'
import { describe, expect, it } from 'vitest'
import { reactive } from 'vue'
import { createAdvRuntime } from '../../src/runtime'

const program: RuntimeProgram = {
  schemaVersion: 1,
  id: 'facade',
  hash: 'facade',
  entry: { chapterId: 'chapter-1', nodeId: 'first' },
  requiredPlugins: {},
  chapters: {
    'chapter-1': {
      id: 'chapter-1',
      entry: 'first',
      order: ['first', 'end'],
      nodes: {
        first: {
          id: 'first',
          kind: 'text',
          data: { text: 'hello' },
          next: { chapterId: 'chapter-1', nodeId: 'end' },
        },
        end: { id: 'end', kind: 'end' },
      },
    },
  },
}

describe('createAdvRuntime', () => {
  it('offers a small state/current/action/subscription API', async () => {
    const runtime = createAdvRuntime({ program, initialVariables: { count: 1 } })
    const updates: Array<{
      state: Readonly<RuntimeState>
      effects: readonly RuntimeEffect[]
    }> = []
    const stop = runtime.subscribe((state, effects) => {
      updates.push({ state, effects })
      state.variables.count = 77
    })

    await runtime.start()
    expect(runtime.current?.id).toBe('first')
    expect(runtime.state.variables.count).toBe(1)

    const published = await runtime.next()
    published.state.variables.count = 99
    expect(runtime.state.variables.count).toBe(1)

    expect(runtime.state.status).toBe('ended')
    expect(updates).toHaveLength(2)

    stop()
  })

  it('accepts reactive host input at the pure-data boundary', async () => {
    const runtime = createAdvRuntime({
      program: reactive(program),
      initialVariables: reactive({ count: 1 }),
    })

    await runtime.start()

    expect(runtime.current?.id).toBe('first')
    expect(runtime.state.variables).toEqual({ count: 1 })
    expect(() => structuredClone(runtime.snapshot())).not.toThrow()
  })

  it('accepts exact string addresses without fuzzy matching', async () => {
    const navigationProgram: RuntimeProgram = {
      ...program,
      chapters: {
        ...program.chapters,
        'chapter-2': {
          id: 'chapter-2',
          entry: 'arrival',
          order: ['arrival', 'result'],
          nodes: {
            arrival: { id: 'arrival', kind: 'text' },
            result: { id: 'result', kind: 'text' },
          },
        },
      },
    }
    const runtime = createAdvRuntime({ program: navigationProgram })

    await runtime.go('#first')
    expect(runtime.state.cursor).toEqual({ chapterId: 'chapter-1', nodeId: 'first' })
    await runtime.go('chapter-2')
    expect(runtime.state.cursor).toEqual({ chapterId: 'chapter-2', nodeId: 'arrival' })
    await runtime.go('chapter-2#result')
    expect(runtime.state.cursor).toEqual({ chapterId: 'chapter-2', nodeId: 'result' })

    await expect(runtime.go('第二章')).rejects.toThrow(/ADV_RUNTIME_INVALID_TARGET/)
    await expect(runtime.go('chapter-2#missing')).rejects.toThrow(/ADV_RUNTIME_UNKNOWN_TARGET/)
  })

  it('uses session history for forward and clears abandoned futures', async () => {
    const historyProgram: RuntimeProgram = {
      ...program,
      chapters: {
        'chapter-1': {
          id: 'chapter-1',
          entry: 'first',
          order: ['first', 'second', 'third'],
          nodes: {
            first: { id: 'first', kind: 'text', next: { chapterId: 'chapter-1', nodeId: 'second' } },
            second: { id: 'second', kind: 'text', next: { chapterId: 'chapter-1', nodeId: 'third' } },
            third: { id: 'third', kind: 'text' },
          },
        },
      },
    }
    const runtime = createAdvRuntime({ program: historyProgram })

    await runtime.start()
    await runtime.next()
    await runtime.next()
    runtime.back()
    expect(runtime.state.cursor.nodeId).toBe('second')

    const restored = await runtime.next()
    expect(restored.state.cursor.nodeId).toBe('third')
    expect(restored.effects).toEqual([{ type: 'runtime.forward' }])
    expect(runtime.trace().at(-1)?.command).toBe('forward')

    runtime.back()
    await runtime.go('#first')
    expect(() => runtime.forward()).toThrow(/ADV_RUNTIME_NO_FUTURE/)
  })

  it('clears the session future when restoring a save snapshot', async () => {
    const runtime = createAdvRuntime({ program })
    await runtime.start()
    const snapshot = runtime.snapshot()
    await runtime.next()
    runtime.back()

    runtime.restore(snapshot)
    expect(() => runtime.forward()).toThrow(/ADV_RUNTIME_NO_FUTURE/)
  })

  it('moves through a previously chosen future before requiring a new choice', async () => {
    const choiceProgram: RuntimeProgram = {
      ...program,
      entry: { chapterId: 'chapter-1', nodeId: 'line' },
      chapters: {
        'chapter-1': {
          id: 'chapter-1',
          entry: 'line',
          order: ['line', 'choice', 'end'],
          nodes: {
            line: { id: 'line', kind: 'text', next: { chapterId: 'chapter-1', nodeId: 'choice' } },
            choice: {
              id: 'choice',
              kind: 'choices',
              data: { options: [{ id: 'continue', label: 'Continue' }] },
              next: { chapterId: 'chapter-1', nodeId: 'end' },
            },
            end: { id: 'end', kind: 'end' },
          },
        },
      },
    }
    const runtime = createAdvRuntime({ program: choiceProgram })
    await runtime.start()
    await runtime.next()
    await runtime.choose('continue')

    runtime.back()
    expect(runtime.state.status).toBe('waiting-choice')
    await runtime.next()
    expect(runtime.state.status).toBe('ended')

    runtime.back()
    await runtime.choose('continue')
    expect(() => runtime.forward()).toThrow(/ADV_RUNTIME_NO_FUTURE/)
  })
})
