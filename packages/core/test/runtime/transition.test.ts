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

  it('keeps durable stage state separate from one-shot presentation effects', () => {
    const effectsProgram: RuntimeProgram = {
      ...program,
      entry: { chapterId: 'chapter-1', nodeId: 'effects' },
      chapters: {
        'chapter-1': {
          ...program.chapters['chapter-1'],
          entry: 'effects',
          order: ['effects', 'dialog'],
          nodes: {
            effects: {
              id: 'effects',
              kind: 'effects',
              data: {
                operations: [
                  {
                    type: 'background',
                    url: 'orbit.webp',
                    transition: { name: 'dissolve', duration: 900 },
                  },
                  {
                    type: 'tachie',
                    enter: [{
                      name: '观测者',
                      status: 'curious',
                      position: 'left',
                      scale: 0.92,
                      mirror: true,
                      motion: 'slide-left',
                    }],
                    exit: [],
                  },
                  {
                    type: 'bgm',
                    name: 'star-proof',
                    loop: true,
                    fade: { in: 1200, out: 700 },
                  },
                  {
                    type: 'cg',
                    id: 'star-in-hand',
                    transition: 'crossfade',
                  },
                  { type: 'transition', name: 'flash-white', duration: 360 },
                ],
              },
              next: { chapterId: 'chapter-1', nodeId: 'dialog' },
            },
            dialog: program.chapters['chapter-1'].nodes.dialog,
          },
        },
      },
    }

    const update = transitionRuntime(
      effectsProgram,
      createInitialRuntimeState(effectsProgram),
      { type: 'start' },
    )

    expect(update.state.stage).toEqual({
      background: 'orbit.webp',
      bgm: 'star-proof',
      cg: 'star-in-hand',
      tachies: {
        观测者: {
          status: 'curious',
          position: 'left',
          scale: 0.92,
          mirror: true,
        },
      },
    })
    expect(update.effects).toContainEqual({
      type: 'stage.background',
      payload: {
        url: 'orbit.webp',
        transition: { name: 'dissolve', duration: 900 },
      },
    })
    expect(update.effects).toContainEqual({
      type: 'stage.cg',
      payload: {
        id: 'star-in-hand',
        action: 'show',
        unlock: true,
        transition: { name: 'crossfade' },
      },
    })
    expect(update.effects).toContainEqual({
      type: 'stage.transition',
      payload: { name: 'flash-white', duration: 360 },
    })
    expect(JSON.stringify(update.state)).not.toContain('slide-left')
    expect(JSON.stringify(update.state)).not.toContain('flash-white')
  })

  it('clears an active CG on the next background and accepts rich exits', () => {
    const initial = createInitialRuntimeState(program)
    initial.stage.cg = 'old-cg'
    initial.stage.tachies = {
      观测者: { status: 'default' },
      读书人: { status: 'default' },
    }
    const effectsProgram: RuntimeProgram = {
      ...program,
      chapters: {
        'chapter-1': {
          ...program.chapters['chapter-1'],
          entry: 'background',
          order: ['background', 'dialog'],
          nodes: {
            background: {
              id: 'background',
              kind: 'effects',
              data: {
                operations: [
                  { type: 'background', url: 'next.webp' },
                  { type: 'tachie', enter: [], exit: [{ name: '读书人', motion: 'fade' }] },
                ],
              },
              next: { chapterId: 'chapter-1', nodeId: 'dialog' },
            },
            dialog: program.chapters['chapter-1'].nodes.dialog,
          },
        },
      },
    }

    const update = transitionRuntime(effectsProgram, initial, { type: 'start' })
    expect(update.state.stage.cg).toBe('')
    expect(update.state.stage.tachies).toEqual({ 观测者: { status: 'default' } })
  })

  it('passes through heading anchor nodes before pausing on content', () => {
    const anchorProgram: RuntimeProgram = {
      ...program,
      entry: { chapterId: 'chapter-1', nodeId: 'anchor' },
      chapters: {
        'chapter-1': {
          ...program.chapters['chapter-1'],
          entry: 'anchor',
          order: ['anchor', 'dialog'],
          nodes: {
            anchor: {
              id: 'anchor',
              kind: 'anchor',
              data: { depth: 2, text: '比对结果' },
              next: { chapterId: 'chapter-1', nodeId: 'dialog' },
            },
            dialog: program.chapters['chapter-1'].nodes.dialog,
          },
        },
      },
    }

    const update = transitionRuntime(
      anchorProgram,
      createInitialRuntimeState(anchorProgram),
      { type: 'start' },
    )

    expect(update.state.cursor.nodeId).toBe('dialog')
  })

  it('passes through scene metadata before pausing on content', () => {
    const sceneProgram: RuntimeProgram = {
      ...program,
      entry: { chapterId: 'chapter-1', nodeId: 'scene' },
      chapters: {
        'chapter-1': {
          ...program.chapters['chapter-1'],
          entry: 'scene',
          order: ['scene', 'dialog'],
          nodes: {
            scene: {
              id: 'scene',
              kind: 'scene',
              data: { place: '观测室', time: '午后', inOrOut: '内景' },
              next: { chapterId: 'chapter-1', nodeId: 'dialog' },
            },
            dialog: program.chapters['chapter-1'].nodes.dialog,
          },
        },
      },
    }

    const update = transitionRuntime(
      sceneProgram,
      createInitialRuntimeState(sceneProgram),
      { type: 'start' },
    )

    expect(update.state.cursor.nodeId).toBe('dialog')
    expect(update.state.visited).toEqual([
      'chapter-1#scene',
      'chapter-1#dialog',
    ])
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
