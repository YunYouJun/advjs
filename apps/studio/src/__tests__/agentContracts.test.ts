import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import fixture from '../agent/contracts/fixtures/agent-runtime-v1.json'
import {
  parseAgentEventEnvelope,
  parseAgentTaskSnapshot,
  parseCreateTaskRequest,
  parseCreateTaskResponse,
} from '../agent/core/contracts'

describe('agent runtime v1 contracts', () => {
  it('pins the cross-repository fixture payload', () => {
    expect(createHash('sha256').update(JSON.stringify(fixture)).digest('hex')).toBe(
      '5f42c41fa2844ebfc3593a26c74af39870bd3497710b996dea1a1e5262d8a57c',
    )
  })

  it('accepts the versioned completed-task fixture through public parsers', () => {
    const request = parseCreateTaskRequest(fixture.createRequest)
    const response = parseCreateTaskResponse(fixture.createResponse)
    const events = fixture.events.map(parseAgentEventEnvelope)
    const snapshot = parseAgentTaskSnapshot(fixture.snapshot)

    expect(request.capability).toBe('generate-outline')
    expect(response).toEqual({
      taskId: 'task_fixture_001',
      status: 'queued',
      reservedMicroPoints: 12000,
      eventsUrl: '/v1/tasks/task_fixture_001/events',
    })
    expect(events.map(item => item.event.type)).toEqual([
      'run.started',
      'text.delta',
      'proposal.ready',
      'usage.settled',
      'run.finished',
    ])
    expect(snapshot.proposal?.patches).toEqual([{
      kind: 'raw-text',
      path: 'adv/outline.md',
      content: '# Fixture outline\n',
    }])
    expect(snapshot.usage?.chargedMicroPoints).toBe(12000)
  })

  it('rejects an unsupported protocol version', () => {
    expect(() => parseAgentTaskSnapshot({
      ...fixture.snapshot,
      protocolVersion: 2,
    })).toThrowError(/protocol version/i)
  })

  it('ignores additive fields while preserving required v1 values', () => {
    const snapshot = parseAgentTaskSnapshot({
      ...fixture.snapshot,
      futureField: { enabled: true },
    })

    expect(snapshot.taskId).toBe('task_fixture_001')
    expect('futureField' in snapshot).toBe(false)
  })

  it('accepts empty project files and a patch that clears markdown', () => {
    const request = parseCreateTaskRequest({
      ...fixture.createRequest,
      project: {
        ...fixture.createRequest.project,
        files: { 'adv/outline.md': '' },
      },
    })
    const snapshot = parseAgentTaskSnapshot({
      ...fixture.snapshot,
      proposal: {
        ...fixture.snapshot.proposal,
        patches: [{ kind: 'raw-text', path: 'adv/outline.md', content: '' }],
      },
    })

    expect(request.project.files['adv/outline.md']).toBe('')
    expect(snapshot.proposal?.patches[0]).toEqual({
      kind: 'raw-text',
      path: 'adv/outline.md',
      content: '',
    })
  })

  it('covers cancellation and failure terminal contracts', () => {
    const cancelled = parseAgentTaskSnapshot(fixture.cancelledSnapshot)
    const failed = parseAgentEventEnvelope(fixture.failedEvent)

    expect(cancelled).toMatchObject({
      status: 'cancelled',
      billingStatus: 'settled',
      points: { reservedMicroPoints: 0, chargedMicroPoints: 4000 },
    })
    expect(failed.event).toMatchObject({
      type: 'run.failed',
      error: {
        code: 'parse_error',
        retryable: false,
      },
    })
  })
})
