import type { CreativeTeamRun } from '../src'
import { describe, expect, it, vi } from 'vitest'
import { createCreativeBootstrapPlan, createCreativeTeamRun, ManagedCreativeTeamClient, parseCreativePartnerOutput, parseCreativePartnerOutputSnapshot, parseCreativeTeamRun, parseCreativeTeamStartRequest } from '../src'
import project from './fixtures/creative-team/v2/project.json'

const request = parseCreativeTeamStartRequest({ protocolVersion: 1, project: { id: project.id, revision: 'r1', files: project.files }, partner: 'director', goal: '雨夜车站，两个结局', locale: 'zh-CN', limits: { maxTasks: 12, maxToolCalls: 64, maxReworkRounds: 2, maxMicroPoints: 1000 } })
function run(): CreativeTeamRun {
  return createCreativeTeamRun({ id: 'run1', accountId: 'account1', plan: createCreativeBootstrapPlan(request), now: 1 })
}

describe('managed creative team client', () => {
  it('reads an atomic source state without writes and rejects invalid or cross-account state', async () => {
    const projectRevision = `sha256:${'a'.repeat(64)}`
    const fetch = vi.fn<typeof globalThis.fetch>(async () => new Response(JSON.stringify({ protocolVersion: 1, run: run(), projectRevision })))
    const client = new ManagedCreativeTeamClient({ baseUrl: 'https://runtime.example', accountId: 'account1', getAccessToken: () => 'session-token', fetch })
    expect(await client.getSourceState(project.id, 'run1')).toMatchObject({ projectRevision, run: { id: 'run1' } })
    expect(fetch.mock.calls[0]![0]).toContain('/runs/run1/source-state?projectId=')
    expect(fetch.mock.calls[0]![1]).toMatchObject({ method: 'GET' })
    expect(fetch.mock.calls[0]![1]!.body).toBeUndefined()
    fetch.mockResolvedValueOnce(new Response(JSON.stringify({ protocolVersion: 1, run: run(), projectRevision: 'invented' })))
    await expect(client.getSourceState(project.id, 'run1')).rejects.toThrow()
    fetch.mockResolvedValueOnce(new Response(JSON.stringify({ protocolVersion: 1, run: { ...run(), accountId: 'another' }, projectRevision })))
    await expect(client.getSourceState(project.id, 'run1')).rejects.toThrow()
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it('recovers with GET only and sends explicit decisions with the supplied stable intent', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => new Response(JSON.stringify({ protocolVersion: 1, run: run() })))
    const client = new ManagedCreativeTeamClient({ baseUrl: 'https://runtime.example', accountId: 'account1', getAccessToken: () => 'session-token', fetch })
    expect((await client.get(project.id, 'run1')).status).toBe('awaiting_plan_review')
    expect(fetch.mock.calls[0]![1]!.method).toBe('GET')
    expect(fetch.mock.calls[0]![1]!.body).toBeUndefined()
    await client.decide(project.id, 'run1', { type: 'approve-plan' }, 'author-intent-1')
    expect(fetch.mock.calls[1]![1]).toMatchObject({ method: 'POST', headers: { 'authorization': 'Bearer session-token', 'idempotency-key': 'author-intent-1' }, body: JSON.stringify({ type: 'approve-plan' }) })
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('submits a bounded author-host media candidate once with its stable intent', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => new Response(JSON.stringify({ protocolVersion: 1, run: run() })))
    const client = new ManagedCreativeTeamClient({ baseUrl: 'https://runtime.example', accountId: 'account1', getAccessToken: () => 'session-token', fetch })
    const media = { artifactId: 'art-plan', fingerprint: 'plan-v1', project: request.project, target: { kind: 'image' as const, assetId: 'character/lin/default' }, writes: { 'adv/assets.json': '{"schemaVersion":2}' }, reason: 'Author reviewed local media' }
    await client.registerMediaCandidate(project.id, 'run1', media, 'stable-media-intent')
    expect(String(fetch.mock.calls[0]![0])).toContain('/runs/run1/media-candidates?projectId=')
    expect(fetch.mock.calls[0]![1]).toMatchObject({ method: 'POST', headers: { 'idempotency-key': 'stable-media-intent' } })
    expect(JSON.parse(String(fetch.mock.calls[0]![1]!.body))).toEqual(media)
    expect(() => client.registerMediaCandidate(project.id, 'run1', { ...media, verification: 'verified-managed' } as typeof media, 'forged-authority')).toThrow('INVALID_AUTHORITY')
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('rejects account/project/run escapes, malformed states and unknown output shapes', async () => {
    expect(() => parseCreativeTeamRun(run(), { accountId: 'other', projectId: project.id })).toThrow(/boundary/)
    expect(() => parseCreativeTeamRun(run(), { accountId: 'account1', projectId: 'other' })).toThrow(/boundary/)
    expect(() => parseCreativeTeamRun(run(), { accountId: 'account1', projectId: project.id, runId: 'other' })).toThrow(/boundary/)
    expect(() => parseCreativeTeamRun({ ...run(), status: 'fake-completed' }, { accountId: 'account1', projectId: project.id })).toThrow()
    expect(() => parseCreativeTeamRun({ ...run(), tasks: [] }, { accountId: 'account1', projectId: project.id })).toThrow(/identities/)
    expect(() => parseCreativePartnerOutputSnapshot({ kind: 'playtest-report', summary: 'fabricated pass' }, { projectId: project.id, projectRevision: 'r1', files: {}, characterIds: [], limits: request.limits })).toThrow()
  })

  it('retains a stale voice candidate without granting it current-source validation', () => {
    const output = { kind: 'voice-direction' as const, summary: '旧台词方案', cast: [{ speakerId: 'narrator', designBrief: '旁白', performance: '克制' }], dictionary: [], lines: [{ path: 'adv/chapters/station.adv.md', line: 1, speakerId: 'lin', text: '旧台词', instruction: '短句' }] }
    const context = { projectId: project.id, projectRevision: 'r1', files: {}, characterIds: [], limits: request.limits }
    expect(parseCreativePartnerOutputSnapshot(output, context)).toEqual(output)
    expect(() => parseCreativePartnerOutput('voice-direction', output, context)).toThrow(/frozen|speaker/)
  })

  it('does not retry a failed submission or attach credentials to another route', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => {
      throw new Error('offline')
    })
    const client = new ManagedCreativeTeamClient({ baseUrl: 'https://runtime.example', accountId: 'account1', getAccessToken: () => 'session-token', fetch })
    await expect(client.start(request, 'same-intent')).rejects.toThrow()
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(() => client.get(project.id, 'https://other.example')).toThrow()
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('preserves actionable capability and source errors without retrying', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => new Response(JSON.stringify({ error: { code: 'CREATIVE_CAPABILITY_DISABLED', message: 'Capability unavailable' } }), { status: 409 }))
    const client = new ManagedCreativeTeamClient({ baseUrl: 'https://runtime.example', accountId: 'account1', getAccessToken: () => 'session-token', fetch })
    await expect(client.start(request, 'intent')).rejects.toMatchObject({ detail: { code: 'capability_disabled' } })
    fetch.mockResolvedValue(new Response(JSON.stringify({ error: { code: 'CREATIVE_SOURCE_CONFLICT', message: 'Source changed' } }), { status: 409 }))
    await expect(client.get(project.id, 'run1')).rejects.toMatchObject({ detail: { code: 'conflict' } })
    expect(fetch).toHaveBeenCalledTimes(2)
  })
})
