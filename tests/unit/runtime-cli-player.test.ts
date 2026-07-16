// @vitest-environment node

import type { RuntimeProgram } from '@advjs/types'
import { describe, expect, it } from 'vitest'
import { RuntimeCliPlayer } from '../../packages/advjs/node/runtime/player'
import { createAdvRuntime, defineAdvPlugin } from '../../packages/core/src/runtime'

const program: RuntimeProgram = {
  schemaVersion: 1,
  id: 'cli-player',
  hash: 'cli-player-v1',
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
          data: { character: '我', status: 'smile', text: '星图正在移动。' },
          next: { chapterId: 'chapter-1', nodeId: 'choice' },
        },
        choice: {
          id: 'choice',
          kind: 'choices',
          data: {
            options: [{
              id: 'observe',
              label: '继续观察',
              target: { chapterId: 'chapter-2', nodeId: 'result' },
            }],
          },
        },
        end: { id: 'end', kind: 'end' },
      },
    },
    'chapter-2': {
      id: 'chapter-2',
      entry: 'result',
      order: ['result', 'end'],
      nodes: {
        result: {
          id: 'result',
          kind: 'narration',
          data: { text: '比对完成。' },
          next: { chapterId: 'chapter-2', nodeId: 'end' },
        },
        end: { id: 'end', kind: 'end' },
      },
    },
  },
}

describe('runtimeCliPlayer', () => {
  it('delegates the same command sequence to createAdvRuntime', async () => {
    const clock = () => {
      let time = 1
      return () => time++
    }
    const direct = createAdvRuntime({ program, initialVariables: { count: 1 }, now: clock() })
    const player = new RuntimeCliPlayer({ program, initialVariables: { count: 1 }, now: clock() })

    await direct.start()
    await direct.next()
    await direct.choose('observe')

    await player.start()
    await player.next()
    await player.choose(1)

    expect(player.snapshot()).toEqual(direct.snapshot())
    expect(player.current()).toMatchObject({
      type: 'narration',
      text: '比对完成。',
      address: { chapterId: 'chapter-2', nodeId: 'result' },
      stage: { background: 'night.webp' },
    })
  })

  it('formats numbered choices and supports checkpoint back', async () => {
    const player = new RuntimeCliPlayer({ program })
    await player.start()
    const choices = await player.next()

    expect(choices).toMatchObject({
      type: 'choices',
      options: [{ index: 1, id: 'observe', label: '继续观察' }],
    })
    await player.choose(1)
    const result = player.back(5)
    expect(result.poppedSteps).toBe(2)
    expect(result.current).toMatchObject({
      type: 'dialog',
      text: '星图正在移动。',
    })
  })

  it('restores snapshots and emits structured command traces', async () => {
    const traces: unknown[] = []
    const player = new RuntimeCliPlayer({
      program,
      trace: trace => traces.push(trace),
    })
    await player.start()
    const snapshot = player.snapshot()
    await player.next()
    player.restore(snapshot)

    expect(player.current()).toMatchObject({ type: 'dialog' })
    expect(traces).toMatchObject([
      { command: 'start', address: { chapterId: 'chapter-1', nodeId: 'line' }, status: 'playing' },
      { command: 'next', address: { chapterId: 'chapter-1', nodeId: 'choice' }, status: 'waiting-choice' },
      { command: 'restore', address: { chapterId: 'chapter-1', nodeId: 'line' }, status: 'playing' },
    ])
  })

  it('formats and completes plugin activities through the CLI host', async () => {
    const traces: unknown[] = []
    const observer = defineAdvPlugin({
      name: 'observer',
      version: '1.0.0',
      nodes: {
        compare({ activity }) {
          activity('compare', { tolerance: 0.8 })
        },
      },
      activities: {
        compare({ state }, result) {
          state.variables.result = result
        },
      },
    })
    const activityProgram: RuntimeProgram = {
      schemaVersion: 1,
      id: 'cli-activity',
      hash: 'cli-activity-v1',
      entry: { chapterId: 'chapter-1', nodeId: 'compare' },
      requiredPlugins: { observer: '1.0.0' },
      chapters: {
        'chapter-1': {
          id: 'chapter-1',
          entry: 'compare',
          order: ['compare', 'end'],
          nodes: {
            compare: {
              id: 'compare',
              kind: 'observer/compare',
              next: { chapterId: 'chapter-1', nodeId: 'end' },
            },
            end: { id: 'end', kind: 'end' },
          },
        },
      },
    }
    const player = new RuntimeCliPlayer({
      program: activityProgram,
      plugins: [observer],
      trace: trace => traces.push(trace),
    })

    expect(await player.start()).toMatchObject({
      type: 'activity',
      text: 'observer/compare {"tolerance":0.8}',
    })
    expect(await player.completeActivity({ matched: true })).toMatchObject({ type: 'end' })
    expect(player.status().variables.result).toEqual({ matched: true })
    expect(traces).toMatchObject([
      { command: 'start', status: 'waiting-activity' },
      { command: 'activity', status: 'ended' },
    ])
  })
})
