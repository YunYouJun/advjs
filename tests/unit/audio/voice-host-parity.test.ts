// @vitest-environment node
import type { VoiceDesignMutation, VoiceDesignPreview, VoiceDesignPreviewReview, VoiceDesignSnapshot } from '@advjs/types'
import type { EditorVoiceJobsReviewedPlan, EditorVoiceJobsSnapshot } from '../../../packages/advjs/shared/editor-audio'
import { createHash } from 'node:crypto'
import { readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { VoiceGenerationNotDispatchedError } from '@advjs/audio'
import { describe, expect, it, vi } from 'vitest'
import { withVoiceProviderPermit } from '../../../packages/advjs/node/audio/provider-permit'
import { createStudioVoiceService } from '../../../packages/advjs/node/audio/server'
import { createNodeVoiceAuthoringService } from '../../../packages/advjs/node/audio/voice'
import { createEditorBridge } from '../../../packages/advjs/node/editor'
import { createEditorVoiceJobsHost } from '../../../packages/advjs/node/editor/audio-jobs'
import { createEditorVoiceDesignFixture } from '../../fixtures/audio/editor-voice-design'
import { createEditorVoiceJobsFixture, editorJobLineIds } from '../../fixtures/audio/editor-voice-jobs'

/** Same registry fixture on the two real HTTP hosts. No model or cloud calls. */
async function host(kind: 'editor' | 'studio') {
  const fixture = await createEditorVoiceDesignFixture()
  const accountId = 'parity-local-device'
  const projectId = 'parity-native-project'
  const createService = async () => kind === 'editor'
    ? await createEditorBridge({ host: '127.0.0.1', port: 0, projectRoot: fixture.root, publicRoot: fixture.publicRoot, audioJobs: { config: fixture.config, storeDirectory: fixture.storeDirectory } })
    : await createStudioVoiceService({ host: '127.0.0.1', port: 0, stateDirectory: fixture.storeDirectory, allowedOrigins: ['http://127.0.0.1:4181'], authenticate: async token => token === 'fixture-only' ? { accountId } : undefined, projects: [{ accountId, projectId, root: fixture.root, config: fixture.config }] })
  let service = await createService()
  let url = new URL((await service.start()).url).origin
  let token = 'token' in service ? service.token : 'fixture-only'
  const prefix = kind === 'editor' ? '/__advjs/api/audio' : `/v1/audio/projects/${projectId}`
  async function request(path: string, body?: unknown) {
    const route = kind === 'studio' && path.startsWith('/jobs/') ? path.slice('/jobs'.length) : path
    return await fetch(`${url}${prefix}${route}`, { method: body === undefined ? 'GET' : 'POST', headers: { authorization: `Bearer ${token}`, origin: kind === 'editor' ? url : 'http://127.0.0.1:4181', ...(body === undefined ? {} : { 'content-type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
  }
  async function ok<T>(path: string, body?: unknown) {
    const response = await request(path, body)
    const result = await response.json()
    expect(response.status, JSON.stringify(result)).toBe(200)
    return result as T
  }
  async function failure(path: string, body: unknown) {
    const response = await request(path, body)
    expect(response.status).toBe(400)
    const result = await response.json()
    return typeof result.error === 'string' ? result.error : result.error.code
  }
  return { ...fixture, ok, request, failure, async restart() {
    await service.stop()
    service = await createService()
    url = new URL((await service.start()).url).origin
    token = 'token' in service ? service.token : 'fixture-only'
  }, async close() {
    await service.stop()
    await rm(fixture.directory, { recursive: true, force: true })
  } }
}

describe('editor and Studio voice authoring protocol parity (fixture provider, not a real model)', () => {
  it('does not trust a supplier throwing the actual host-only no-dispatch marker', async () => {
    const fixture = await createEditorVoiceJobsFixture()
    const target = await createEditorVoiceJobsHost({ projectRoot: fixture.root, config: fixture.config, storeDirectory: fixture.storeDirectory })
    fixture.provider.synthesize = async (request) => {
      fixture.calls.push(request)
      throw new VoiceGenerationNotDispatchedError()
    }
    try {
      const review = await target.plan({ lineIds: [editorJobLineIds[0]!], locale: 'zh-CN', providerId: 'fixture-tts', budget: { maxCharacters: 100, concurrency: 1, allowUnknownCost: true } })
      await target.enqueue({ planId: review.plan.id, planHash: review.planHash })
      await target.command({ jobId: review.plan.id, action: 'run' })
      await vi.waitFor(async () => expect((await target.read()).jobs[0]!.tasks[0]).toMatchObject({ status: 'unknown', attempts: 1, errorCode: 'PROVIDER_RESULT_UNKNOWN' }))
      expect((await target.read()).jobs[0]!.chargedCharacters).toBe(review.plan.tasks[0]!.characterCount)
      await expect(target.command({ jobId: review.plan.id, action: 'retry' })).rejects.toThrow('AUDIO_JOB_QUERY_REQUIRED')
      await target.command({ jobId: review.plan.id, action: 'run' })
      expect(fixture.calls).toHaveLength(1)
    }
    finally {
      await target.close()
      await rm(fixture.directory, { recursive: true, force: true })
    }
  })

  it.each(['text', 'profile', 'rights', 'consent', 'reference', 'access', 'cancel'] as const)('rechecks %s after waiting for the host-wide provider permit, without billing or dispatch', async (change) => {
    const fixture = await createEditorVoiceJobsFixture()
    let released!: () => void
    let entered!: () => void
    let acquired!: () => void
    const holding = new Promise<void>(resolve => released = resolve)
    const waiting = new Promise<void>(resolve => entered = resolve)
    const locked = new Promise<void>(resolve => acquired = resolve)
    let permitted = true
    const rights = { license: 'Synthetic test-only reference', subject: 'Fixture', consentRecord: 'consent.md' }
    const profile = { ...fixture.profile, locales: { 'zh-CN': { providers: { 'fixture-tts': { ...fixture.profile.locales['zh-CN'].providers['fixture-tts'], source: 'cloned', rights } } } } }
    const game = { characters: [{ id: 'hero', name: 'Hero', voiceProfile: profile }] }
    await writeFile(join(fixture.root, 'adv/settings/game.json'), JSON.stringify(game))
    await writeFile(join(fixture.root, 'consent.md'), 'Original synthetic fixture; no human identity or rights claim')
    await writeFile(join(fixture.root, 'public/media/reference.wav'), fixture.bytes)
    await writeFile(join(fixture.root, 'adv/assets.json'), JSON.stringify({ schemaVersion: 2, id: 'editor-jobs-assets', defaultProfile: 'local', profiles: { local: { provider: 'project', root: 'public/media' } }, assets: [{ id: 'voice-reference', type: 'audio', kind: 'reference', path: 'reference.wav', sha256: fixture.sha256, bytes: fixture.bytes.length, mimeType: 'audio/wav' }] }))
    const inspect = fixture.provider.inspectPreset
    fixture.provider.inspectPreset = async (input) => {
      const result = await inspect(input)
      result.characters[0]!.generation = { ...result.characters[0]!.generation!, source: 'cloned', referenceAssetId: 'voice-reference', referenceSha256: fixture.sha256 }
      return result
    }
    const target = await createEditorVoiceJobsHost({ projectRoot: fixture.root, config: fixture.config, storeDirectory: fixture.storeDirectory, async validateProjectAccess() {
      if (!permitted)
        throw new Error('ADV_AUDIO_PROJECT_FORBIDDEN')
    }, async withProviderPermit(providerId, signal, operation) {
      entered()
      return await withVoiceProviderPermit(providerId, 1, signal, operation)
    } })
    const blocker = withVoiceProviderPermit('fixture-tts', 1, new AbortController().signal, async () => {
      acquired()
      await holding
    })
    try {
      await locked
      const review = await target.plan({ lineIds: [editorJobLineIds[0]!], locale: 'zh-CN', providerId: 'fixture-tts', budget: { maxCharacters: 100, concurrency: 1, allowUnknownCost: true } })
      await target.enqueue({ planId: review.plan.id, planHash: review.planHash })
      await target.command({ jobId: review.plan.id, action: 'run' })
      await waiting
      expect(fixture.calls).toHaveLength(0)
      if (change === 'text')
        await writeFile(join(fixture.root, 'adv/chapters/intro.adv.md'), `@Hero\n排队期间修改的正文。 {#${editorJobLineIds[0]}}`)
      else if (change === 'profile')
        await writeFile(join(fixture.root, 'adv/settings/game.json'), JSON.stringify({ ...game, characters: [{ ...game.characters[0], voiceProfile: { ...profile, intent: { pitch: 'high' } } }] }))
      else if (change === 'rights')
        await writeFile(join(fixture.root, 'adv/settings/game.json'), JSON.stringify({ ...game, characters: [{ ...game.characters[0], voiceProfile: { ...profile, locales: { 'zh-CN': { providers: { 'fixture-tts': { ...profile.locales['zh-CN'].providers['fixture-tts'], rights: { ...rights, license: 'Revoked' } } } } } } }] }))
      else if (change === 'consent')
        await rm(join(fixture.root, 'consent.md'))
      else if (change === 'reference')
        await writeFile(join(fixture.root, 'public/media/reference.wav'), 'Reference changed while queued')
      else if (change === 'access')
        permitted = false
      else
        await target.command({ jobId: review.plan.id, action: 'cancel' })
      released()
      await blocker
      await vi.waitFor(async () => {
        const document = JSON.parse(await readFile(join(fixture.storeDirectory, 'audio-jobs.json'), 'utf8'))
        const job = document.jobs[review.plan.id]
        expect(job.tasks[0]).toMatchObject({ status: 'failed', errorCode: 'INPUT_INVALID', attempts: 0 })
        expect(job).toMatchObject({ chargedCharacters: 0, chargedCostMicros: 0 })
        expect(Object.values(document.idempotency)).toEqual([expect.objectContaining({ status: 'failed', errorCode: 'INPUT_INVALID' })])
      })
      expect(fixture.calls).toHaveLength(0)
      expect(await readFile(join(fixture.root, 'adv/audio/voice-ledger.json'), 'utf8').catch(() => undefined)).toBeUndefined()
    }
    finally {
      released()
      await blocker
      await target.close()
      await rm(fixture.directory, { recursive: true, force: true })
    }
  }, 15_000)

  it('does not reserve rejected hashes and restores an authenticated unknown job without another supplier dispatch', async () => {
    const fixture = await host('studio')
    try {
      const review = await fixture.ok<EditorVoiceJobsReviewedPlan>('/jobs/plan', { lineIds: [editorJobLineIds[0]], locale: 'zh-CN', providerId: 'fixture-tts', budget: { maxCharacters: 100, allowUnknownCost: true, concurrency: 1 } })
      const request = { planId: review.plan.id, planHash: review.planHash }
      const privateScope = createHash('sha256').update(JSON.stringify(['parity-local-device', 'parity-native-project'])).digest('hex')
      const receiptPath = join(fixture.storeDirectory, privateScope, 'enqueue-receipts.json')
      expect(await fixture.failure('/jobs/enqueue', { ...request, planHash: 'incorrect' })).toBe('ADV_AUDIO_JOB_REVIEW_REQUIRED')
      expect(await readFile(receiptPath, 'utf8').catch(error => error.code === 'ENOENT' ? '{}' : Promise.reject(error))).toBe('{}')
      // Cooperating concurrent requests serialize before mutating this receipt.
      const [accepted, rejected] = await Promise.all([fixture.ok<{ id: string }>('/jobs/enqueue', request), fixture.failure('/jobs/enqueue', { ...request, planHash: 'foreign' })])
      expect(accepted.id).toBe(review.plan.id)
      expect(rejected).toBe('ADV_AUDIO_JOB_REVIEW_REQUIRED')
      expect(JSON.parse(await readFile(receiptPath, 'utf8'))).toEqual({ [review.plan.id]: review.planHash })
      await fixture.restart()
      expect((await fixture.ok<{ id: string }>('/jobs/enqueue', request)).id).toBe(review.plan.id)
      expect(fixture.calls).toHaveLength(0)
      fixture.provider.synthesize = async (input) => {
        fixture.calls.push(input)
        await new Promise<void>((_resolve, reject) => input.signal!.addEventListener('abort', () => reject(new Error('Fixture accepted request interrupted')), { once: true }))
        throw new Error('Fixture must never complete')
      }
      await fixture.ok('/jobs/command', { jobId: review.plan.id, action: 'run' })
      await vi.waitFor(() => expect(fixture.calls).toHaveLength(1))
      await fixture.ok('/jobs/command', { jobId: review.plan.id, action: 'cancel' })
      await vi.waitFor(async () => expect((await fixture.ok<EditorVoiceJobsSnapshot>('/jobs')).jobs[0]!.tasks[0]!.status).toBe('unknown'))
      await fixture.restart()
      expect((await fixture.ok<{ tasks: Array<{ status: string }> }>('/jobs/enqueue', request)).tasks[0]!.status).toBe('unknown')
      expect(await fixture.failure('/jobs/enqueue', { ...request, planHash: 'foreign' })).toBe('ADV_AUDIO_JOB_REVIEW_REQUIRED')
      await fixture.ok('/jobs/command', { jobId: review.plan.id, action: 'run' })
      expect((await fixture.ok<EditorVoiceJobsSnapshot>('/jobs')).jobs[0]!.tasks[0]).toMatchObject({ status: 'unknown', attempts: 1 })
      expect(fixture.calls).toHaveLength(1)
    }
    finally { await fixture.close() }
  }, 15_000)

  it('shares review guards, immutable presets, sample selection, Profile application, job fingerprints and explicit take binding', async () => {
    const traces = []
    for (const kind of ['editor', 'studio'] as const) {
      const fixture = await host(kind)
      try {
        const initial = await fixture.ok<VoiceDesignSnapshot>('/voice-design')
        expect(fixture.calls).toHaveLength(0)
        const draft = { id: 'parity-original', version: '1', characterId: 'hero', label: 'Parity original', intent: { speakingStyle: '清晰温暖' }, locales: { 'zh-CN': { providers: { 'fixture-tts': { preset: 'fixture', source: 'designed' as const, description: '清晰温暖的原创验收音色' } } } } }
        const saved = await fixture.ok<VoiceDesignMutation>('/voice-design/save', { expectedRevision: initial.revision, draft })
        expect(fixture.calls).toHaveLength(0)
        const previewInput = { voiceId: draft.id, locale: 'zh-CN', providerId: 'fixture-tts', text: '这是共享协议的审核试听。', expectedRevision: saved.snapshot.revision, budget: { maxCharacters: 100, allowUnknownCost: true } }
        const guards = [await fixture.failure('/voice-design/plan', { ...previewInput, budget: { ...previewInput.budget, allowUnknownCost: false } })]
        const reviewed = await fixture.ok<VoiceDesignPreviewReview>('/voice-design/plan', previewInput)
        guards.push(await fixture.failure('/voice-design/execute', { reviewId: reviewed.id, reviewHash: 'invalid' }))
        expect(fixture.calls).toHaveLength(0)
        const preview = await fixture.ok<VoiceDesignPreview>('/voice-design/execute', { reviewId: reviewed.id, reviewHash: reviewed.reviewHash })
        await vi.waitFor(async () => expect((await fixture.ok<VoiceDesignPreview>(`/voice-design/previews/${preview.id}`)).status).toBe('ready'), { timeout: 10_000 })
        const media = await fixture.request(`/voice-design/previews/${preview.id}/media`)
        expect(createHash('sha256').update(new Uint8Array(await media.arrayBuffer())).digest('hex')).toBe(fixture.sha256)
        expect(fixture.calls).toHaveLength(1)
        const registered = await fixture.ok<VoiceDesignMutation>('/voice-design/register', { previewId: preview.id, expectedRevision: saved.snapshot.revision })
        expect(registered.snapshot.library.voices[0]!.design!.selectedSamples).toEqual({})
        guards.push(await fixture.failure('/voice-design/apply', { voiceId: draft.id, locale: 'zh-CN', providerId: 'fixture-tts', expectedRevision: registered.snapshot.revision, replaceBinding: true }))
        const selected = await fixture.ok<VoiceDesignMutation>('/voice-design/select', { voiceId: draft.id, locale: 'zh-CN', providerId: 'fixture-tts', assetId: registered.media!.asset.id, expectedRevision: registered.snapshot.revision })
        guards.push(await fixture.failure('/voice-design/apply', { voiceId: draft.id, locale: 'zh-CN', providerId: 'fixture-tts', expectedRevision: selected.snapshot.revision }))
        const applied = await fixture.ok<VoiceDesignMutation>('/voice-design/apply', { voiceId: draft.id, locale: 'zh-CN', providerId: 'fixture-tts', expectedRevision: selected.snapshot.revision, replaceBinding: true })
        const native = await createNodeVoiceAuthoringService({ root: fixture.root })
        expect((await native.read()).ledger.lines[editorJobLineIds[0]!]).toBeUndefined()
        const repeated = await fixture.ok<VoiceDesignPreviewReview>('/voice-design/plan', { ...previewInput, expectedRevision: applied.snapshot.revision })
        expect((await fixture.ok<VoiceDesignPreview>('/voice-design/execute', { reviewId: repeated.id, reviewHash: repeated.reviewHash })).id).toBe(preview.id)
        expect(fixture.calls).toHaveLength(1)
        const jobReview = await fixture.ok<EditorVoiceJobsReviewedPlan>('/jobs/plan', { lineIds: [editorJobLineIds[0]], locale: 'zh-CN', providerId: 'fixture-tts', budget: { maxCharacters: 100, allowUnknownCost: true, concurrency: 1 } })
        expect(fixture.calls).toHaveLength(1)
        expect(await fixture.failure('/jobs/enqueue', { planId: jobReview.plan.id, planHash: 'invalid' })).toBe('ADV_AUDIO_JOB_REVIEW_REQUIRED')
        await fixture.ok('/jobs/enqueue', { planId: jobReview.plan.id, planHash: jobReview.planHash })
        await fixture.ok('/jobs/command', { jobId: jobReview.plan.id, action: 'run' })
        await vi.waitFor(async () => expect((await fixture.ok<EditorVoiceJobsSnapshot>('/jobs')).jobs.find(job => job.id === jobReview.plan.id)!.tasks[0]!.status).toBe('committed'), { timeout: 10_000 })
        const generated = await native.read()
        const binding = generated.ledger.lines[editorJobLineIds[0]!]!.locales['zh-CN']!
        expect(binding.selectedTake).toBeNull()
        expect(binding.takes).toHaveLength(1)
        const take = binding.takes[0]!
        expect(take).toMatchObject({ source: 'designed', projectVoiceId: draft.id, projectVoiceVersion: '1', sha256: fixture.sha256 })
        await native.select({ lineId: editorJobLineIds[0]!, locale: 'zh-CN', takeId: take.id, expectedRevision: generated.revision })
        expect((await native.read()).ledger.lines[editorJobLineIds[0]!]!.locales['zh-CN']!.selectedTake).toBe(take.id)
        const cached = await fixture.ok<EditorVoiceJobsReviewedPlan>('/jobs/plan', { lineIds: [editorJobLineIds[0]], locale: 'zh-CN', providerId: 'fixture-tts', budget: { maxCharacters: 100, allowUnknownCost: false, concurrency: 1 } })
        expect(cached.plan.summary).toMatchObject({ cacheHits: 1, newGenerations: 0 })
        expect(fixture.calls).toHaveLength(2)
        const preset = saved.changes.find(change => change.path !== 'authoring/voices/library.json')!
        traces.push({ guards, providers: initial.providers, profile: applied.profile, preset: JSON.parse(await readFile(join(fixture.root, preset.path), 'utf8')), reviewed: { model: reviewed.model, providerVoiceId: reviewed.providerVoiceId, source: reviewed.source, presetSha256: reviewed.presetSha256, characterCount: reviewed.characterCount }, jobFingerprint: jobReview.plan.tasks[0]!.inputFingerprint, takeFingerprint: take.inputFingerprint, texts: fixture.calls.map(call => call.text), sampleSha256: registered.media!.asset.sha256, takeSha256: take.sha256 })
      }
      finally { await fixture.close() }
    }
    expect(traces[0]).toEqual(traces[1])
    expect(traces[0]!.guards).toEqual(['VOICE_DESIGN_BUDGET_REVIEW_REQUIRED', 'VOICE_DESIGN_REVIEW_REQUIRED', 'VOICE_DESIGN_REVIEWED_SAMPLE_REQUIRED', 'VOICE_DESIGN_REPLACE_REQUIRED'])
  }, 30_000)
})
