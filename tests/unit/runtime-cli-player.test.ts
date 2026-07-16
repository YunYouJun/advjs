// @vitest-environment node

import type { RuntimeProgram } from '@advjs/types'
import { describe, expect, it } from 'vitest'
import { RuntimeCliPlayer } from '../../packages/advjs/node/runtime/player'
import { createAdvRuntime } from '../../packages/core/src/runtime'

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
})
