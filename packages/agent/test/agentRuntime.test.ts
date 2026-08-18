import type {
  AgentEventEnvelope,
  AgentProposal,
  AgentRequest,
  AgentRuntime,
  AgentTaskSnapshot,
  AgentUsageSummary,
} from '../src'
import { describe, expect, it } from 'vitest'
import * as productionAgent from '../src'
import { AGENT_PROTOCOL_VERSION, AgentTaskStore, ManagedAgentRuntime } from '../src'
import { ByokDevAgentRuntime } from '../src/byok-dev'

const usage: AgentUsageSummary = {
  inputTokens: 1,
  outputTokens: 1,
  cachedInputTokens: 0,
  reasoningTokens: 0,
  totalTokens: 2,
  providerCostMicroCny: 3,
  chargedMicroPoints: 4,
}

const byokUsage: AgentUsageSummary = { ...usage, chargedMicroPoints: 0 }

const proposal: AgentProposal = {
  summary: 'Fixture outline',
  projectRevision: 'revision_fixture',
  patches: [{ kind: 'raw-text', path: 'adv/outline.md', content: '# Outline\n' }],
  diagnostics: [],
}

const request: AgentRequest<{ hint: string }> = {
  capability: 'generate-outline',
  clientRequestId: 'runtime_fixture_001',
  input: { hint: 'fixture' },
  locale: 'zh-CN',
  project: {
    id: 'project_fixture',
    revision: 'revision_fixture',
    files: { 'adv/world.md': '# World\n' },
  },
}

function completedSnapshot(taskId: string): AgentTaskSnapshot {
  return {
    protocolVersion: AGENT_PROTOCOL_VERSION,
    taskId,
    capability: 'generate-outline',
    status: 'completed',
    billingStatus: 'settled',
    projectId: request.project.id,
    projectRevision: request.project.revision,
    streamText: '# Outline\n',
    streamRevision: 1,
    reservedMicroPoints: 4,
    proposal,
    usage,
    points: { reservedMicroPoints: 0, chargedMicroPoints: 4 },
    createdAt: 1,
    updatedAt: 2,
  }
}

function envelope(taskId: string, sequence: number, event: AgentEventEnvelope['event']): AgentEventEnvelope {
  return {
    protocolVersion: AGENT_PROTOCOL_VERSION,
    id: `${taskId}:fixture:${sequence}`,
    cursor: `fixture:${sequence}`,
    event,
  }
}

function apiResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify({
    protocolVersion: AGENT_PROTOCOL_VERSION,
    data,
    requestId: 'request_fixture',
  }), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function apiErrorResponse(status: number, code: string, retryable: boolean): Response {
  return new Response(JSON.stringify({
    protocolVersion: AGENT_PROTOCOL_VERSION,
    error: {
      code,
      message: 'Fixture managed error',
      retryable,
      requestId: 'request_error_fixture',
    },
  }), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function sseResponse(events: readonly AgentEventEnvelope[]): Response {
  const body = events.map(item => `id: ${item.id}\nevent: message\ndata: ${JSON.stringify(item)}\n\n`).join('')
  const encoded = new TextEncoder().encode(body)
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (let offset = 0; offset < encoded.length; offset += 7)
        controller.enqueue(encoded.slice(offset, offset + 7))
      controller.close()
    },
  })
  return new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } })
}

function createManagedRuntime(): AgentRuntime {
  const taskId = 'task_managed_fixture'
  const snapshot = completedSnapshot(taskId)
  const events = [
    envelope(taskId, 1, { type: 'state.snapshot', task: snapshot }),
    envelope(taskId, 2, { type: 'proposal.ready', taskId, proposal }),
    envelope(taskId, 3, { type: 'usage.settled', taskId, usage }),
    envelope(taskId, 4, { type: 'run.finished', taskId }),
  ]
  return new ManagedAgentRuntime({
    baseUrl: 'https://www.yunle.fun/account-api/ai-gateway',
    getAccessToken: () => 'access-token-fixture',
    fetch: async (input, init) => {
      const url = new URL(String(input))
      if (url.pathname.endsWith('/v1/tasks') && init?.method === 'POST') {
        expect(new Headers(init.headers).get('idempotency-key')).toBe(request.clientRequestId)
        return apiResponse({
          taskId,
          status: 'queued',
          reservedMicroPoints: 4,
          eventsUrl: `/v1/tasks/${taskId}/events`,
        }, 201)
      }
      if (url.pathname.endsWith(`/v1/tasks/${taskId}/events`))
        return sseResponse(url.searchParams.has('cursor') ? [] : events)
      if (url.pathname.endsWith(`/v1/tasks/${taskId}/cancel`))
        return apiResponse({ ...snapshot, status: 'cancelled' })
      if (url.pathname.endsWith(`/v1/tasks/${taskId}`))
        return apiResponse(snapshot)
      throw new Error(`Unexpected managed runtime URL: ${url}`)
    },
  })
}

function createByokDevRuntime(): AgentRuntime {
  return new ByokDevAgentRuntime({
    enabled: true,
    mode: 'test',
    createTaskId: () => 'task_byok_fixture',
    now: () => 1,
    executor: {
      execute: async (_request, context) => {
        context.onTextDelta('# Outline\n')
        return { proposal, usage }
      },
    },
  })
}

async function collectEvents(runtime: AgentRuntime, expectedUsage: AgentUsageSummary): Promise<{
  cursors: string[]
  taskId: string
}> {
  const run = await runtime.start(request)
  const cursors: string[] = []
  for await (const item of run.events)
    cursors.push(item.cursor)
  const result = await run.result
  expect(result.proposal).toEqual(proposal)
  expect(result.usage).toEqual(expectedUsage)
  expect((await runtime.getTask(run.taskId)).status).toBe('completed')
  return { cursors, taskId: run.taskId }
}

describe('agent runtime adapters', () => {
  it('runs the same semantic capability through managed and explicit byok-dev adapters', async () => {
    for (const [runtime, expectedUsage] of [
      [createManagedRuntime(), usage],
      [createByokDevRuntime(), byokUsage],
    ] as const) {
      const completed = await collectEvents(runtime, expectedUsage)
      expect(completed.cursors.length).toBeGreaterThan(0)
      const resumed = await runtime.resume(completed.taskId, completed.cursors.at(-1))
      await expect(resumed.result).resolves.toMatchObject({ taskId: completed.taskId })
    }
  })

  it('keeps byok-dev out of the production agent surface', () => {
    expect('ByokDevAgentRuntime' in productionAgent).toBe(false)
  })

  it('requires an explicit development/test switch for byok-dev', () => {
    expect(() => new ByokDevAgentRuntime({
      enabled: true,
      mode: 'production',
      executor: { execute: async () => ({ usage }) },
    } as unknown as ConstructorParameters<typeof ByokDevAgentRuntime>[0])).toThrow(/local development switch/i)
  })

  it('cancels an in-memory byok-dev run with the stable cancelled error', async () => {
    const runtime = new ByokDevAgentRuntime({
      enabled: true,
      mode: 'test',
      createTaskId: () => 'task_cancel_fixture',
      executor: {
        execute: (_request, context) => new Promise((_resolve, reject) => {
          context.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })
        }),
      },
    })
    const run = await runtime.start(request)
    await runtime.cancel(run.taskId)

    await expect(run.result).rejects.toMatchObject({
      detail: { code: 'cancelled', retryable: false },
    })
    await expect(runtime.getTask(run.taskId)).resolves.toMatchObject({ status: 'cancelled' })
  })

  it('maps managed API failures to stable client error codes', async () => {
    const runtime = new ManagedAgentRuntime({
      baseUrl: 'https://www.yunle.fun/account-api/ai-gateway',
      getAccessToken: () => 'expired-token-fixture',
      fetch: async () => apiErrorResponse(401, 'AUTH_REQUIRED', false),
    })

    await expect(runtime.start(request)).rejects.toMatchObject({
      detail: {
        code: 'unauthenticated',
        requestId: 'request_error_fixture',
        retryable: false,
      },
      status: 401,
    })
  })

  it('recovers a snapshot when an SSE delta offset is discontinuous', async () => {
    const taskId = 'task_store_fixture'
    const snapshot = completedSnapshot(taskId)
    let getTaskCalls = 0
    const runtime: AgentRuntime = {
      start: async () => ({
        taskId,
        events: (async function* () {
          yield envelope(taskId, 1, { type: 'text.delta', taskId, delta: 'bad', offset: 9 })
        })(),
        result: Promise.resolve({ taskId, proposal, usage }),
      }),
      resume: async () => { throw new Error('not used') },
      getTask: async () => {
        getTaskCalls += 1
        return snapshot
      },
      cancel: async () => {},
    }
    const store = new AgentTaskStore(runtime)

    await store.start(request)
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(getTaskCalls).toBeGreaterThan(0)
    expect(store.read(taskId)).toMatchObject({
      streamText: snapshot.streamText,
      snapshot: { status: 'completed' },
    })
  })
})
