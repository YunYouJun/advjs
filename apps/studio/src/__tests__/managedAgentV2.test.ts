import type { AgentProposal, AgentUsageSummary } from '../agent/core/contracts'
import { describe, expect, it } from 'vitest'
import { ManagedAgentPointsClient } from '../agent/managed/points'
import { ManagedAgentRuntime } from '../agent/managed/runtime'

const applicationId = 'ai-runtime-dev-synthetic'
const taskId = 'task_v2_fixture'
const projectRevision = 'revision_v2_fixture'
const proposal: AgentProposal = {
  summary: 'P6 synthetic no-op proposal',
  projectRevision,
  patches: [],
  diagnostics: [{
    code: 'p6-synthetic-noop',
    message: 'Synthetic validation never changes project files.',
    severity: 'info',
  }],
}
const usage: AgentUsageSummary = {
  inputTokens: 0,
  outputTokens: 0,
  totalTokens: 0,
  providerCostMicroCny: 0,
  chargedMicroPoints: 0,
}

function snapshot(status: 'queued' | 'completed' | 'cancelled') {
  return {
    protocolVersion: 2,
    taskId,
    applicationId,
    capability: 'generate-outline',
    status,
    billingStatus: status === 'queued' ? 'reserved' : status === 'completed' ? 'settled' : 'released',
    streamText: status === 'completed' ? 'p6 synthetic ok' : '',
    streamRevision: status === 'completed' ? 1 : 0,
    reservedMicroPoints: 100,
    chargedMicroPoints: 0,
    context: { projectId: 'project_v2_fixture', projectRevision },
    ...(status === 'completed' ? { result: proposal, usage } : {}),
    traceId: 'request_v2_fixture',
    createdAt: 1,
    updatedAt: 2,
  }
}

function sse(events: readonly unknown[]): Response {
  return new Response(events.map((event, index) => [
    `id: event_v2_${index + 1}`,
    'event: message',
    `data: ${JSON.stringify(event)}`,
    '',
    '',
  ].join('\n')).join(''), { status: 200, headers: { 'content-type': 'text/event-stream' } })
}

describe('managed Runtime protocol v2', () => {
  it('projects v2 submit, SSE, snapshot and cancel into the stable Studio AgentRuntime', async () => {
    const paths: string[] = []
    const fetch: typeof globalThis.fetch = async (input, init) => {
      const url = new URL(String(input))
      paths.push(`${init?.method ?? 'GET'} ${url.pathname}`)
      expect(new Headers(init?.headers).get('authorization')).toBe('Bearer access-token-v2')
      if (url.pathname === `/ai/v2/apps/${applicationId}/tasks` && init?.method === 'POST') {
        expect(JSON.parse(String(init.body))).toMatchObject({
          protocolVersion: 2,
          context: { project: { revision: projectRevision } },
        })
        return Response.json({
          protocolVersion: 2,
          taskId,
          status: 'queued',
          reservedMicroPoints: 100,
          eventsUrl: `/ai/v2/apps/${applicationId}/tasks/${taskId}/events`,
        }, { status: 202 })
      }
      if (url.pathname.endsWith(`/${taskId}/events`)) {
        return sse([
          { protocolVersion: 2, id: 'event_v2_1', cursor: 'v2:1:1', event: { type: 'state.snapshot', task: snapshot('completed') } },
          { protocolVersion: 2, id: 'event_v2_2', cursor: 'v2:1:2', event: { type: 'result.ready', taskId, result: proposal } },
          { protocolVersion: 2, id: 'event_v2_3', cursor: 'v2:1:3', event: { type: 'usage.settled', taskId, usage } },
          { protocolVersion: 2, id: 'event_v2_4', cursor: 'v2:1:4', event: { type: 'run.finished', taskId } },
        ])
      }
      if (url.pathname.endsWith(`/${taskId}/cancel`) && init?.method === 'POST')
        return Response.json(snapshot('cancelled'))
      if (url.pathname.endsWith(`/${taskId}`))
        return Response.json(snapshot('completed'))
      throw new Error(`Unexpected v2 path: ${url.pathname}`)
    }
    const runtime = new ManagedAgentRuntime({
      baseUrl: 'https://runtime-v2.fixture.invalid',
      getAccessToken: () => 'access-token-v2',
      protocol: 'v2',
      applicationId,
      fetch,
    })
    const run = await runtime.start({
      capability: 'generate-outline',
      clientRequestId: 'p6s-client-request',
      input: { goal: 'synthetic' },
      locale: 'zh-CN',
      project: { id: 'project_v2_fixture', revision: projectRevision, files: {} },
    })
    const events = []
    for await (const event of run.events)
      events.push(event.event.type)
    await expect(run.result).resolves.toEqual({ taskId, proposal, usage })
    await expect(runtime.getTask(taskId)).resolves.toMatchObject({ protocolVersion: 1, taskId, proposal })
    await runtime.cancel(taskId)
    expect(events).toEqual(['state.snapshot', 'proposal.ready', 'usage.settled', 'run.finished'])
    expect(paths).toContain(`POST /ai/v2/apps/${applicationId}/tasks`)
  })

  it('uses the raw v2 points endpoint without weakening account parsing', async () => {
    const client = new ManagedAgentPointsClient({
      baseUrl: 'https://runtime-v2.fixture.invalid',
      getAccessToken: () => 'access-token-v2',
      protocol: 'v2',
      applicationId,
      fetch: async (input) => {
        expect(new URL(String(input)).pathname).toBe('/ai/v2/points/me')
        return Response.json({
          availableMicroPoints: 1_000_000,
          reservedMicroPoints: 0,
          chargedMicroPoints: 0,
        })
      },
    })
    await expect(client.getPoints()).resolves.toEqual({
      availableMicroPoints: 1_000_000,
      reservedMicroPoints: 0,
      chargedMicroPoints: 0,
    })
  })
})
