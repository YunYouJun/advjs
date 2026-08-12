import type { RuntimeSnapshot } from '@advjs/types'
import { describe, expect, it } from 'vitest'
import { projectRuntimeInspector } from './useRuntimeInspector'

describe('projectRuntimeInspector', () => {
  it('projects a complete runtime debugging model without sharing data', () => {
    const snapshot: RuntimeSnapshot = {
      schemaVersion: 1,
      program: { id: 'demo', hash: 'hash' },
      state: {
        status: 'playing',
        cursor: { chapterId: 'one', nodeId: 'hello' },
        variables: { observed: true },
        stage: { background: 'night', bgm: '', tachies: {}, cg: '' },
        choices: [],
        visited: ['one#hello'],
      },
      checkpoints: [{
        id: 'checkpoint-1',
        createdAt: 1,
        state: {
          status: 'playing',
          cursor: { chapterId: 'one', nodeId: 'hello' },
          variables: {},
          stage: { background: '', bgm: '', tachies: {}, cg: '' },
          choices: [],
          visited: [],
        },
      }],
      createdAt: 2,
    }

    const model = projectRuntimeInspector(snapshot, {
      id: 'hello',
      kind: 'dialog',
      data: { text: 'Hello' },
    })

    expect(model).toMatchObject({
      address: { chapterId: 'one', nodeId: 'hello' },
      status: 'playing',
      variables: { observed: true },
      checkpointCount: 1,
      current: { id: 'hello', kind: 'dialog' },
    })
    model.address.nodeId = 'changed'
    expect(snapshot.state.cursor.nodeId).toBe('hello')
  })
})
