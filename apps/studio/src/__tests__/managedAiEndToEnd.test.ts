import type { AgentEventEnvelope, AgentProposal, AgentTaskSnapshot, AgentUsageSummary } from '../agent/core/contracts'
import type { FsEntry, IFileSystem } from '../utils/fs'
import { describe, expect, it } from 'vitest'
import { AGENT_PROTOCOL_VERSION } from '../agent/core/contracts'
import { ManagedAgentRuntime } from '../agent/managed/runtime'
import { toAgentProposalCandidate } from '../agent/proposals/candidate'
import {
  AgentProposalReviewService,
  computeAgentProjectRevision,
  createStudioAgentProjectWorkspace,
} from '../agent/proposals/review'

const initialFiles = {
  'adv.config.json': JSON.stringify({ format: 'adv-md', root: 'adv' }),
  'adv/settings/game.json': JSON.stringify({ entryChapterId: 'intro' }),
  'adv/chapters/intro.adv.md': '# Intro {#start}\n\nFixture opening.\n',
  'adv/outline.md': '# Outline\n\nOld fixture outline.\n',
}

class FakeFileSystem implements IFileSystem {
  readonly backend = 'memory' as const
  readonly files: Record<string, string>

  constructor(files: Record<string, string>) {
    this.files = { ...files }
  }

  async readFile(path: string) {
    const content = this.files[path]
    if (content === undefined)
      throw new Error(`Fixture file not found: ${path}`)
    return content
  }

  async writeFile(path: string, content: string) { this.files[path] = content }
  async collectAllFiles() {
    return Object.entries(this.files).map(([path, content]) => ({ path, content, lastModified: new Date(0) }))
  }

  async exists(path: string) { return path in this.files }
  async readBlob(): Promise<Blob> { throw new Error('not used') }
  async readdir() { return [] }
  async stat(): Promise<FsEntry> { throw new Error('not used') }
  async writeBlob() { throw new Error('not used') }
  async mkdir() {}
  async deleteFile() { throw new Error('not used') }
  async rmdir() { throw new Error('not used') }
  async listFiles() { return [] }
  async listFilesByExts() { return [] }
  async readBlobUrl(): Promise<string> { throw new Error('not used') }
}

function envelope(sequence: number, event: AgentEventEnvelope['event']): AgentEventEnvelope {
  return {
    protocolVersion: AGENT_PROTOCOL_VERSION,
    id: `event_e2e_fixture_${sequence}`,
    cursor: `cursor_e2e_fixture_${sequence}`,
    event,
  }
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify({
    protocolVersion: AGENT_PROTOCOL_VERSION,
    data,
    requestId: 'request_e2e_fixture_001',
  }), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function unavailableResponse(): Response {
  return new Response(JSON.stringify({
    protocolVersion: AGENT_PROTOCOL_VERSION,
    error: {
      code: 'UPSTREAM_UNAVAILABLE',
      message: 'Synthetic snapshot outage',
      requestId: 'request_e2e_outage_fixture',
      retryable: true,
    },
  }), { status: 503, headers: { 'content-type': 'application/json' } })
}

function sseResponse(events: readonly AgentEventEnvelope[]): Response {
  const text = events.map(item => `id: ${item.id}\nevent: message\ndata: ${JSON.stringify(item)}\n\n`).join('')
  return new Response(text, { status: 200, headers: { 'content-type': 'text/event-stream' } })
}

describe('managed AI fake acceptance journey', () => {
  it('recovers an SSO-authenticated task stream, settles a proposal, applies it and undoes it', async () => {
    const fs = new FakeFileSystem(initialFiles)
    const projectRevision = await computeAgentProjectRevision(initialFiles)
    const taskId = 'task_e2e_fixture_001'
    const usage: AgentUsageSummary = {
      inputTokens: 800,
      outputTokens: 120,
      cachedInputTokens: 0,
      reasoningTokens: 0,
      totalTokens: 920,
      providerCostMicroCny: 12_000,
      chargedMicroPoints: 12_000,
    }
    const proposal: AgentProposal = {
      summary: 'Replace the fixture outline',
      projectRevision,
      patches: [{
        kind: 'raw-text',
        path: 'adv/outline.md',
        content: '# Outline\n\nRecovered fixture outline.\n',
      }],
      diagnostics: [],
    }
    const snapshot: AgentTaskSnapshot = {
      protocolVersion: AGENT_PROTOCOL_VERSION,
      taskId,
      capability: 'generate-outline',
      status: 'completed',
      billingStatus: 'settled',
      projectId: 'project_e2e_fixture_001',
      projectRevision,
      streamText: '# Outline\n\nRecovered fixture outline.\n',
      streamRevision: 2,
      reservedMicroPoints: 12_000,
      proposal,
      usage,
      points: { reservedMicroPoints: 0, chargedMicroPoints: 12_000 },
      createdAt: 1_786_698_000_000,
      updatedAt: 1_786_698_005_000,
    }
    const firstEvents = [
      envelope(1, { type: 'run.started', taskId }),
      envelope(2, { type: 'text.delta', taskId, delta: '# Outline\n', offset: 0 }),
    ]
    const recoveredEvents = [
      envelope(3, { type: 'state.snapshot', task: snapshot }),
      envelope(4, { type: 'proposal.ready', taskId, proposal }),
      envelope(5, { type: 'usage.settled', taskId, usage }),
      envelope(6, { type: 'run.finished', taskId }),
    ]
    let streamRequests = 0
    const seenAuthorization: string[] = []
    const seenResumeHeaders: string[] = []
    const runtime = new ManagedAgentRuntime({
      baseUrl: 'https://runtime.fixture.invalid',
      getAccessToken: () => 'sso-access-token-fixture',
      fetch: async (input, init) => {
        const url = new URL(String(input))
        const headers = new Headers(init?.headers)
        seenAuthorization.push(headers.get('authorization') ?? '')
        if (url.pathname === '/v1/tasks' && init?.method === 'POST') {
          expect(headers.get('idempotency-key')).toBe('create_e2e_fixture_001')
          return jsonResponse({
            taskId,
            status: 'queued',
            reservedMicroPoints: 12_000,
            eventsUrl: `/v1/tasks/${taskId}/events`,
          }, 201)
        }
        if (url.pathname === `/v1/tasks/${taskId}/events`) {
          streamRequests += 1
          if (streamRequests === 1)
            return sseResponse(firstEvents)
          seenResumeHeaders.push(headers.get('last-event-id') ?? '')
          expect(url.searchParams.get('cursor')).toBe('cursor_e2e_fixture_2')
          return sseResponse(recoveredEvents)
        }
        if (url.pathname === `/v1/tasks/${taskId}`)
          return unavailableResponse()
        throw new Error(`Unexpected fake Runtime request: ${url.pathname}`)
      },
    })

    const started = await runtime.start({
      capability: 'generate-outline',
      clientRequestId: 'create_e2e_fixture_001',
      input: { goal: 'fixture acceptance' },
      locale: 'zh-CN',
      project: {
        id: 'project_e2e_fixture_001',
        revision: projectRevision,
        files: { 'adv/outline.md': initialFiles['adv/outline.md'] },
      },
    })
    const initialCursors: string[] = []
    for await (const event of started.events)
      initialCursors.push(event.cursor)
    await expect(started.result).rejects.toMatchObject({ detail: { retryable: true } })

    const resumed = await runtime.resume(taskId, initialCursors.at(-1))
    const recoveredCursors: string[] = []
    for await (const event of resumed.events)
      recoveredCursors.push(event.cursor)
    const result = await resumed.result

    expect(initialCursors).toEqual(['cursor_e2e_fixture_1', 'cursor_e2e_fixture_2'])
    expect(recoveredCursors.at(-1)).toBe('cursor_e2e_fixture_6')
    expect(seenResumeHeaders).toEqual(['cursor_e2e_fixture_2'])
    expect(seenAuthorization.every(value => value === 'Bearer sso-access-token-fixture')).toBe(true)
    expect(result.usage.chargedMicroPoints).toBe(12_000)

    const candidate = toAgentProposalCandidate(result, 'project_e2e_fixture_001')
    expect(candidate).toBeDefined()
    const reviewService = new AgentProposalReviewService(
      createStudioAgentProjectWorkspace(fs, 'project_e2e_fixture_001'),
    )
    const review = await reviewService.review(candidate!)
    expect(fs.files['adv/outline.md']).toBe(initialFiles['adv/outline.md'])

    const applied = await reviewService.apply(review)
    expect(fs.files['adv/outline.md']).toBe('# Outline\n\nRecovered fixture outline.\n')
    expect(applied.changedPaths).toEqual(['adv/outline.md'])

    await reviewService.undo(applied)
    expect(fs.files).toEqual(initialFiles)
  })
})
