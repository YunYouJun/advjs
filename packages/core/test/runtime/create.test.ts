import type { RuntimeEffect, RuntimeProgram, RuntimeState } from '@advjs/types'
import { describe, expect, it } from 'vitest'
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
})
