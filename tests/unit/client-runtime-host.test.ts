import type { RuntimeProgram } from '@advjs/types'
import { describe, expect, it } from 'vitest'
import { createAdvRuntimeHost } from '../../packages/client/composables/useAdvRuntime'
import { defineAdvPlugin } from '../../packages/core/src/runtime'

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
    host.forward()
    expect(host.current.value?.id).toBe('choice')
  })

  it('can replace the installed program without leaking subscriptions', async () => {
    const host = createAdvRuntimeHost({ program })
    await host.start()
    host.install({ ...program, id: 'replacement', hash: 'replacement-v1' })

    expect(host.state.value.status).toBe('idle')
    expect(host.state.value.variables).toEqual({})
    expect(host.program.value?.id).toBe('replacement')
  })

  it('keeps host trace subscriptions across runtime replacement', async () => {
    const host = createAdvRuntimeHost({ program, maxTraceEntries: 1 })
    const commands: string[] = []
    const stop = host.subscribeTrace(entry => commands.push(entry.command))

    await host.start()
    expect(host.trace()).toEqual([
      expect.objectContaining({ sequence: 1, command: 'start' }),
    ])

    host.install({ ...program, id: 'replacement', hash: 'replacement-v1' })
    await host.start()
    expect(commands).toEqual(['start', 'start'])
    expect(host.trace()).toEqual([
      expect.objectContaining({ sequence: 1, command: 'start' }),
    ])

    stop()
    await host.next()
    expect(commands).toEqual(['start', 'start'])
    expect(host.trace()).toEqual([
      expect.objectContaining({ sequence: 2, command: 'next' }),
    ])
    host.dispose()
  })

  it('forwards activity completion through the host', async () => {
    const plugin = defineAdvPlugin({
      name: 'test',
      version: '1.0.0',
      nodes: {
        activity({ activity }) {
          activity('activity')
        },
      },
      activities: {
        activity({ state }, result) {
          state.variables.result = result
        },
      },
    })
    const activityProgram: RuntimeProgram = {
      ...program,
      requiredPlugins: { test: '1.0.0' },
      entry: { chapterId: 'chapter-1', nodeId: 'activity' },
      chapters: {
        'chapter-1': {
          id: 'chapter-1',
          entry: 'activity',
          order: ['activity', 'end'],
          nodes: {
            activity: {
              id: 'activity',
              kind: 'test/activity',
              next: { chapterId: 'chapter-1', nodeId: 'end' },
            },
            end: { id: 'end', kind: 'end' },
          },
        },
      },
    }
    const host = createAdvRuntimeHost({ program: activityProgram, plugins: [plugin] })

    await host.start()
    expect(host.state.value.status).toBe('waiting-activity')
    await host.completeActivity({ ok: true })
    expect(host.state.value.variables.result).toEqual({ ok: true })
  })
})
