import type { RuntimeProgram } from '@advjs/types'
import { describe, expect, it } from 'vitest'
import { derivePresentationState } from '../../src/runtime'

const program: RuntimeProgram = {
  schemaVersion: 1,
  id: 'presentation-preview',
  hash: 'presentation-preview-v1',
  entry: { chapterId: 'chapter-1', nodeId: 'scene-a' },
  requiredPlugins: {},
  chapters: {
    'chapter-1': {
      id: 'chapter-1',
      entry: 'scene-a',
      order: ['scene-a', 'base', 'night', 'scene-b', 'cg', 'target'],
      nodes: {
        'scene-a': { id: 'scene-a', kind: 'scene' },
        'base': {
          id: 'base',
          kind: 'effects',
          data: {
            operations: [
              { type: 'background', name: 'day' },
              { type: 'bgm', name: 'theme' },
              {
                type: 'tachie',
                enter: [{ name: 'hero', status: 'smile', position: 'left', motion: 'hop' }],
              },
            ],
          },
        },
        'night': {
          id: 'night',
          kind: 'effects',
          when: {
            type: 'binary',
            operator: '==',
            left: { type: 'variable', path: ['route'] },
            right: { type: 'literal', value: 'night' },
          },
          data: { operations: [{ type: 'background', name: 'night' }] },
        },
        'scene-b': { id: 'scene-b', kind: 'scene' },
        'cg': {
          id: 'cg',
          kind: 'effects',
          data: { operations: [{ type: 'cg', id: 'memory', transition: 'fade' }] },
        },
        'target': { id: 'target', kind: 'text', data: { text: 'hello' } },
      },
    },
  },
}

describe('derivePresentationState', () => {
  it('derives durable stage state from source order without one-shot motion', () => {
    const result = derivePresentationState(
      program,
      { chapterId: 'chapter-1', nodeId: 'target' },
      { route: 'night' },
    )

    expect(result).toMatchObject({
      anchor: { chapterId: 'chapter-1', nodeId: 'scene-b' },
      stage: {
        background: 'night',
        bgm: 'theme',
        cg: 'memory',
        tachies: { hero: { status: 'smile', position: 'left' } },
      },
      diagnostics: [],
    })
    expect(JSON.stringify(result.stage)).not.toContain('hop')
  })

  it('evaluates conditions from read-only preview variables and returns isolated copies', () => {
    const day = derivePresentationState(
      program,
      { chapterId: 'chapter-1', nodeId: 'target' },
      { route: 'day' },
    )
    expect(day.stage.background).toBe('day')

    day.stage.background = 'mutated'
    const repeated = derivePresentationState(
      program,
      { chapterId: 'chapter-1', nodeId: 'target' },
      { route: 'day' },
    )
    expect(repeated.stage.background).toBe('day')
  })

  it('warns when a standalone chapter preview has no scene or background baseline', () => {
    const withoutBaseline: RuntimeProgram = {
      ...program,
      chapters: {
        'chapter-1': {
          id: 'chapter-1',
          entry: 'target',
          order: ['target'],
          nodes: { target: { id: 'target', kind: 'text' } },
        },
      },
    }

    expect(derivePresentationState(
      withoutBaseline,
      { chapterId: 'chapter-1', nodeId: 'target' },
    ).diagnostics.map(item => item.code)).toEqual([
      'ADV_RUNTIME_PREVIEW_SCENE_BASELINE_MISSING',
      'ADV_RUNTIME_PREVIEW_BACKGROUND_MISSING',
    ])
  })
})
