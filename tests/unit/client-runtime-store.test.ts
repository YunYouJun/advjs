import type { RuntimeNode, RuntimeProgram, RuntimeState } from '@advjs/types'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useAdvStore } from '../../packages/client/stores/useAdvStore'

const program: RuntimeProgram = {
  schemaVersion: 1,
  id: 'store',
  hash: 'store-v1',
  entry: { chapterId: 'chapter-1', nodeId: 'line' },
  requiredPlugins: {},
  chapters: {
    'chapter-1': {
      id: 'chapter-1',
      entry: 'line',
      order: ['line'],
      nodes: { line: { id: 'line', kind: 'text', data: { text: 'hello' } } },
    },
  },
}

const state: RuntimeState = {
  status: 'playing',
  cursor: { chapterId: 'chapter-1', nodeId: 'line' },
  variables: {},
  stage: { background: 'night.webp', bgm: '', cg: '', tachies: {} },
  choices: [],
  visited: ['chapter-1#line'],
}

const node: RuntimeNode = program.chapters['chapter-1'].nodes.line

describe('client runtime store', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('holds only the immutable runtime view and derived status', () => {
    const store = useAdvStore()
    store.$syncRuntime(state, node, program)
    state.stage.background = 'mutated.webp'

    expect(store.state.stage.background).toBe('night.webp')
    expect(store.current).toEqual(node)
    expect(store.program?.id).toBe('store')
    expect(store.status.isEnd).toBe(false)

    store.$syncRuntime({ ...state, status: 'ended' }, undefined, program)
    expect(store.status.isEnd).toBe(true)
  })
})
