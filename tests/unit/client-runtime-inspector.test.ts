// @vitest-environment node

import type { RuntimeSnapshot, RuntimeTraceEntry } from '@advjs/types'
import { describe, expect, it } from 'vitest'
import {
  createRuntimeDebugReport,
  projectRuntimeInspector,
} from '../../packages/client/runtime/inspector'

const snapshot: RuntimeSnapshot = {
  schemaVersion: 1,
  program: { id: 'fixture', hash: 'fixture-v1' },
  state: {
    status: 'waiting-choice',
    cursor: { chapterId: 'chapter-1', nodeId: 'choice' },
    variables: { profile: { mood: 'curious' } },
    stage: { background: 'night.svg', bgm: 'ambient.wav', tachies: {} },
    choices: [{
      node: { chapterId: 'chapter-1', nodeId: 'choice' },
      choiceId: 'observe',
    }],
    visited: ['chapter-1#line', 'chapter-1#choice'],
  },
  checkpoints: [{
    id: 'checkpoint-1',
    createdAt: 1,
    state: {
      status: 'playing',
      cursor: { chapterId: 'chapter-1', nodeId: 'line' },
      variables: {},
      stage: { background: '', bgm: '', tachies: {} },
      choices: [],
      visited: [],
    },
  }],
  createdAt: 2,
}

const trace: RuntimeTraceEntry[] = [{
  sequence: 1,
  command: 'choose',
  input: { choiceId: 'observe' },
  from: { chapterId: 'chapter-1', nodeId: 'choice' },
  to: { chapterId: 'chapter-1', nodeId: 'result' },
  status: 'playing',
  effects: [],
  variableChanges: [{ path: 'profile.mood', before: 'calm', after: 'curious' }],
}]

describe('client runtime inspector', () => {
  it('projects a complete model without current-node prose', () => {
    const model = projectRuntimeInspector(snapshot, {
      id: 'choice',
      kind: 'dialog',
      data: { text: 'KNOWN SECRET DIALOGUE' },
    }, trace)

    expect(model).toMatchObject({
      address: { chapterId: 'chapter-1', nodeId: 'choice' },
      status: 'waiting-choice',
      current: { id: 'choice', kind: 'dialog' },
      variables: { profile: { mood: 'curious' } },
      stage: { background: 'night.svg' },
      checkpointCount: 1,
      trace: [{ sequence: 1, command: 'choose' }],
    })
    expect(model.current).not.toHaveProperty('data')
    expect(JSON.stringify(model)).not.toContain('KNOWN SECRET DIALOGUE')
  })

  it('creates a source-free report with an author-data review notice', () => {
    const report = createRuntimeDebugReport({
      snapshot,
      trace,
      diagnostics: [{ code: 'EXAMPLE', severity: 'warning' }],
    })

    expect(report).toMatchObject({
      schemaVersion: 1,
      engine: 'advjs',
      program: { id: 'fixture', hash: 'fixture-v1' },
      snapshot: expect.any(Object),
      trace: expect.any(Array),
      diagnostics: [{ code: 'EXAMPLE', severity: 'warning' }],
      metadata: {
        notice: expect.stringContaining('author-defined data'),
      },
    })
    expect(JSON.stringify(report)).not.toContain('KNOWN SECRET DIALOGUE')
  })

  it('returns detached inspector and report data', () => {
    const model = projectRuntimeInspector(snapshot, undefined, trace)
    const report = createRuntimeDebugReport({ snapshot, trace })
    model.address.nodeId = 'changed'
    model.trace[0].to.nodeId = 'changed'
    report.snapshot.state.variables.profile = null

    expect(snapshot.state.cursor.nodeId).toBe('choice')
    expect(trace[0].to.nodeId).toBe('result')
    expect(snapshot.state.variables.profile).toEqual({ mood: 'curious' })
  })
})
