import type { RuntimeProgram } from '@advjs/types'
import { describe, expect, it } from 'vitest'
import { createInitialRuntimeState, transitionRuntime } from '../../src/runtime/transition'

const program: RuntimeProgram = {
  schemaVersion: 1,
  id: 'transition-test',
  hash: 'test',
  entry: { chapterId: 'chapter-1', nodeId: 'background' },
  requiredPlugins: {},
  chapters: {
    'chapter-1': {
      id: 'chapter-1',
      entry: 'background',
      order: ['background', 'dialog', 'choices', 'end'],
      nodes: {
        background: {
          id: 'background',
          kind: 'effects',
          data: { operations: [{ type: 'background', url: 'stars.webp' }] },
          next: { chapterId: 'chapter-1', nodeId: 'dialog' },
        },
        dialog: {
          id: 'dialog',
          kind: 'dialog',
          data: { character: '我', text: '看见星图了。' },
          next: { chapterId: 'chapter-1', nodeId: 'choices' },
        },
        choices: {
          id: 'choices',
          kind: 'choices',
          data: { options: [{ id: 'continue', label: '继续' }] },
          next: { chapterId: 'chapter-1', nodeId: 'end' },
        },
        end: { id: 'end', kind: 'end' },
      },
    },
  },
}

describe('transitionRuntime', () => {
  it('processes silent stage nodes before pausing on content', () => {
    const initial = createInitialRuntimeState(program)
    const update = transitionRuntime(program, initial, { type: 'start' })

    expect(update.state.cursor.nodeId).toBe('dialog')
    expect(update.state.stage.background).toBe('stars.webp')
    expect(update.effects).toContainEqual({
      type: 'stage.background',
      payload: { url: 'stars.webp' },
    })
  })

  it('waits for a choice and records the selected option', () => {
    const started = transitionRuntime(program, createInitialRuntimeState(program), { type: 'start' })
    const choices = transitionRuntime(program, started.state, { type: 'next' })
    const ended = transitionRuntime(program, choices.state, { type: 'choose', choiceId: 'continue' })

    expect(choices.state.status).toBe('waiting-choice')
    expect(ended.state.choices).toContainEqual({
      node: { chapterId: 'chapter-1', nodeId: 'choices' },
      choiceId: 'continue',
    })
    expect(ended.state.status).toBe('ended')
  })

  it('stops a cycle of silent nodes with a structured error', () => {
    const loopProgram: RuntimeProgram = {
      schemaVersion: 1,
      id: 'silent-loop',
      hash: 'silent-loop',
      entry: { chapterId: 'chapter-1', nodeId: 'loop' },
      requiredPlugins: {},
      chapters: {
        'chapter-1': {
          id: 'chapter-1',
          entry: 'loop',
          order: ['loop'],
          nodes: {
            loop: {
              id: 'loop',
              kind: 'effects',
              data: { operations: [] },
              next: { chapterId: 'chapter-1', nodeId: 'loop' },
            },
          },
        },
      },
    }

    const update = transitionRuntime(
      loopProgram,
      createInitialRuntimeState(loopProgram),
      { type: 'start' },
    )

    expect(update.state.error?.code).toBe('ADV_RUNTIME_SILENT_LOOP')
  })
})
