import type { RuntimeProgram } from '@advjs/types'
import { describe, expect, it } from 'vitest'
import { createAdvRuntimeHost } from '../../packages/client/composables/useAdvRuntime'

const program: RuntimeProgram = {
  schemaVersion: 1,
  id: 'client-host',
  hash: 'client-host-v1',
  entry: { chapterId: 'chapter-1', nodeId: 'stage' },
  requiredPlugins: {},
  chapters: {
    'chapter-1': {
      id: 'chapter-1',
      entry: 'stage',
      order: ['stage', 'line', 'choice', 'end'],
      nodes: {
        stage: {
          id: 'stage',
          kind: 'effects',
          data: { operations: [{ type: 'background', url: 'night.webp' }] },
          next: { chapterId: 'chapter-1', nodeId: 'line' },
        },
        line: {
          id: 'line',
          kind: 'dialog',
          data: { character: '我', text: '看见星图了。' },
          next: { chapterId: 'chapter-1', nodeId: 'choice' },
        },
        choice: {
          id: 'choice',
          kind: 'choices',
          data: { options: [{ id: 'continue', label: '继续' }] },
          next: { chapterId: 'chapter-1', nodeId: 'end' },
        },
        end: { id: 'end', kind: 'end' },
      },
    },
  },
}

describe('client runtime host', () => {
  it('mirrors immutable runtime state through shallow refs', async () => {
    const effects: string[] = []
    const host = createAdvRuntimeHost({
      program,
      onEffects: published => effects.push(...published.map(effect => effect.type)),
    })

    await host.start()
    expect(host.state.value).toMatchObject({
      status: 'playing',
      cursor: { chapterId: 'chapter-1', nodeId: 'line' },
      stage: { background: 'night.webp' },
    })
    expect(host.current.value).toMatchObject({ id: 'line', kind: 'dialog' })
    expect(effects).toEqual(['stage.background'])

    const exposed = host.snapshot()
    exposed.state.stage.background = 'mutated.webp'
    expect(host.snapshot().state.stage.background).toBe('night.webp')
  })

  it('delegates choices, snapshots, restore, and back to core runtime', async () => {
    const host = createAdvRuntimeHost({ program })
    await host.start()
    const line = host.snapshot()
    await host.next()
    await host.choose('continue')
    expect(host.state.value.status).toBe('ended')

    host.restore(line)
    expect(host.current.value?.id).toBe('line')
    await host.next()
    host.back()
    expect(host.current.value?.id).toBe('line')
  })

  it('can replace the installed program without leaking subscriptions', async () => {
    const host = createAdvRuntimeHost({ program })
    await host.start()
    host.install({ ...program, id: 'replacement', hash: 'replacement-v1' })

    expect(host.state.value.status).toBe('idle')
    expect(host.state.value.variables).toEqual({})
    expect(host.program.value?.id).toBe('replacement')
  })
})
