// @vitest-environment node
import type { EditorBridge } from '../../../packages/advjs/node/editor'
import type { EditorVoiceJobsReviewedPlan, EditorVoiceJobsSnapshot } from '../../../packages/advjs/shared/editor-audio'
import { readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createLocalBridgeAdapter } from '../../../editor/core/app/adapters/local'
import { createLocalProjectWorkspace } from '../../../editor/core/app/adapters/local/workspace'
import { runVoiceGenerateTake, runVoiceLedger } from '../../../packages/advjs/node/audio/voice'
import { createEditorBridge } from '../../../packages/advjs/node/editor'
import { createEditorVoiceJobsFixture, editorJobLineIds } from '../../fixtures/audio/editor-voice-jobs'

let fixture: Awaited<ReturnType<typeof createEditorVoiceJobsFixture>>
let bridge: EditorBridge
let origin: string
const budget = { maxCharacters: 100, concurrency: 2, allowUnknownCost: true }

async function start() {
  bridge = await createEditorBridge({ host: '127.0.0.1', port: 0, projectRoot: fixture.root, publicRoot: fixture.publicRoot, audioJobs: { config: fixture.config, storeDirectory: fixture.storeDirectory } })
  origin = new URL((await bridge.start()).url).origin
}
function request(path: string, body?: unknown, token = bridge.token, foreignOrigin?: string) {
  return fetch(`${origin}/__advjs/api/audio/jobs${path}`, { method: body === undefined ? 'GET' : 'POST', headers: { 'authorization': `Bearer ${token}`, 'content-type': 'application/json', ...(foreignOrigin ? { origin: foreignOrigin } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
}
async function plan(lineIds = editorJobLineIds, override = {}) {
  const response = await request('/plan', { lineIds, locale: 'zh-CN', providerId: 'fixture-tts', budget: { ...budget, ...override } })
  expect(response.status).toBe(200)
  return await response.json() as EditorVoiceJobsReviewedPlan
}
async function enqueue(review: EditorVoiceJobsReviewedPlan) {
  const response = await request('/enqueue', { planId: review.plan.id, planHash: review.planHash })
  expect(response.status).toBe(200)
  return await response.json()
}
async function snapshot() {
  const response = await request('')
  expect(response.status).toBe(200)
  return await response.json() as EditorVoiceJobsSnapshot
}

beforeEach(async () => {
  fixture = await createEditorVoiceJobsFixture()
  await start()
})
afterEach(async () => {
  await bridge?.stop()
  await rm(fixture.directory, { recursive: true, force: true })
})

describe('authenticated native Editor voice jobs', () => {
  it('runs through the actual local workspace and registry, preserves narrator identity and registers unselected immutable takes', async () => {
    const adapter = createLocalBridgeAdapter({ origin, token: bridge.token })
    const workspace = createLocalProjectWorkspace(adapter)
    try {
      const loaded = await workspace.snapshot()
      expect(loaded.project.compilation.project.program, JSON.stringify(loaded.project.compilation.diagnostics)).toBeDefined()
      expect(loaded.project.compilation.project.characters[0]?.voiceProfile).toEqual(fixture.profile)
      const port = workspace.voiceJobs!
      expect((await port.read()).providers).toEqual([{ id: 'fixture-tts', backend: 'local', models: ['fixture-model'], default: true }])
      expect(fixture.calls).toHaveLength(0)
      const reviewed = await port.plan({ lineIds: editorJobLineIds, locale: 'zh-CN', providerId: 'fixture-tts', budget })
      expect(reviewed.plan.tasks.map(task => task.speakerId)).toEqual(['hero', 'narrator'])
      expect(JSON.stringify(reviewed)).not.toContain('你好，世界')
      expect(JSON.stringify(reviewed)).not.toContain('parameters')
      await port.enqueue({ planId: reviewed.plan.id, planHash: reviewed.planHash })
      expect(fixture.calls).toHaveLength(0)
      await port.command({ jobId: reviewed.plan.id, action: 'run' })
      await vi.waitFor(async () => expect((await port.read()).jobs[0]!.tasks.map(task => task.status)).toEqual(['committed', 'committed']), { timeout: 10000 })
      expect(fixture.calls).toHaveLength(2)
      const native = await workspace.readDocuments()
      const ledger = JSON.parse(native.files['adv/audio/voice-ledger.json']!)
      expect(ledger.lines[editorJobLineIds[1]!].speakerId).toBe('narrator')
      for (const lineId of editorJobLineIds) {
        const binding = ledger.lines[lineId!].locales['zh-CN']
        expect(binding.selectedTake).toBeNull()
        expect(binding.takes).toHaveLength(1)
        const asset = native.catalog!.assets.find(asset => asset.id === binding.takes[0].assetId)!
        expect(await readFile(join(fixture.root, 'public/media', asset.path!))).toEqual(fixture.bytes)
      }
      const cached = await port.plan({ lineIds: editorJobLineIds, locale: 'zh-CN', providerId: 'fixture-tts', budget: { ...budget, allowUnknownCost: false } })
      expect(cached.plan.summary).toMatchObject({ cacheHits: 2, newGenerations: 0, characters: 0 })
      await port.enqueue({ planId: cached.plan.id, planHash: cached.planHash })
      await port.command({ jobId: cached.plan.id, action: 'run' })
      await vi.waitFor(async () => expect((await port.read()).jobs.find(job => job.id === cached.plan.id)!.tasks.every(task => task.status === 'committed')).toBe(true))
      expect(fixture.calls).toHaveLength(2)
      const jobData = await readFile(join(fixture.storeDirectory, 'audio-jobs.json'), 'utf8')
      expect(jobData).not.toContain('你好，世界')
      expect(jobData).not.toContain('故事开始了')
      expect(jobData).not.toContain('preset.json')
    }
    finally {
      workspace.dispose()
    }
  })

  it('enforces authenticated finite requests, unknown-cost approval, character caps and reviewed-plan hashes before any dispatch', async () => {
    expect((await request('', undefined, '')).status).toBe(401)
    expect((await request('', undefined, bridge.token, 'https://foreign.invalid')).status).toBe(403)
    for (const extra of [{ projectRoot: fixture.root }, { accountId: 'other' }, { parameters: { apiKey: 'secret' } }]) {
      expect(await (await request('/plan', { lineIds: editorJobLineIds, locale: 'zh-CN', providerId: 'fixture-tts', budget, ...extra })).json()).toEqual({ error: 'ADV_AUDIO_JOB_INPUT_INVALID' })
    }
    expect(await (await request('/plan', { lineIds: editorJobLineIds, locale: 'zh-CN', providerId: 'fixture-tts', budget: { ...budget, allowUnknownCost: false } })).json()).toEqual({ error: 'AUDIO_JOB_UNKNOWN_COST' })
    expect(await (await request('/plan', { lineIds: editorJobLineIds, locale: 'zh-CN', providerId: 'fixture-tts', budget: { ...budget, maxCharacters: 1 } })).json()).toEqual({ error: 'AUDIO_JOB_CHARACTER_LIMIT' })
    const reviewed = await plan()
    expect(await (await request('/enqueue', { planId: reviewed.plan.id, planHash: 'wrong' })).json()).toEqual({ error: 'ADV_AUDIO_JOB_REVIEW_REQUIRED' })
    expect((await snapshot()).jobs).toEqual([])
    expect(fixture.calls).toHaveLength(0)
  })

  it('uses the saved dictionary for actual supplier text and shares exact fingerprints with single-line generation', async () => {
    await writeFile(join(fixture.root, 'adv/audio/pronunciation.json'), JSON.stringify({ schemaVersion: 1, revision: 1, replacements: { 世界: 'ADV.JS' }, locales: {} }))
    const initial = await runVoiceLedger({ root: fixture.root, config: fixture.config })
    const generated = await runVoiceGenerateTake({ root: fixture.root, config: fixture.config, lineId: editorJobLineIds[0]!, locale: 'zh-CN', speakerId: 'hero', displayText: '你好，世界。', expectedRevision: initial.revision })
    expect(fixture.calls).toHaveLength(1)
    expect(fixture.calls[0]!.text).toBe('你好，ADV.JS。')
    const take = generated.ledger.lines[editorJobLineIds[0]!]!.locales['zh-CN']!.takes[0]!
    expect(take).toMatchObject({ spokenText: '你好，ADV.JS。', pronunciationRevision: expect.stringMatching(/^[a-f0-9]{64}$/u) })
    const reviewed = await plan([editorJobLineIds[0]!], { allowUnknownCost: false })
    expect(reviewed.plan.summary).toMatchObject({ cacheHits: 1, newGenerations: 0, characters: 0 })
    expect(reviewed.plan.tasks[0]!.inputFingerprint).toBe(take.inputFingerprint)
    await enqueue(reviewed)
    await request('/command', { jobId: reviewed.plan.id, action: 'run' })
    await vi.waitFor(async () => expect((await snapshot()).jobs[0]!.tasks[0]!.status).toBe('committed'))
    expect(fixture.calls).toHaveLength(1)
    expect((await runVoiceLedger({ root: fixture.root, config: fixture.config })).ledger.lines[editorJobLineIds[0]!]!.locales['zh-CN']!.selectedTake).toBeNull()
  })

  it('rejects preset and pronunciation changes after review, and blocks changed inputs after enqueue without calling a provider', async () => {
    let reviewed = await plan([editorJobLineIds[0]!])
    await writeFile(join(fixture.root, 'preset.json'), JSON.stringify({ model: 'fixture-model', voiceId: 'system:fixture', changed: true }))
    expect(await (await request('/enqueue', { planId: reviewed.plan.id, planHash: reviewed.planHash })).json()).toEqual({ error: 'ADV_AUDIO_JOB_REVIEW_STALE' })
    reviewed = await plan([editorJobLineIds[0]!])
    await writeFile(join(fixture.root, 'adv/audio/pronunciation.json'), JSON.stringify({ schemaVersion: 1, revision: 1, replacements: { 世界: '世间' }, locales: {} }))
    expect(await (await request('/enqueue', { planId: reviewed.plan.id, planHash: reviewed.planHash })).json()).toEqual({ error: 'ADV_AUDIO_JOB_REVIEW_STALE' })
    reviewed = await plan([editorJobLineIds[0]!])
    await enqueue(reviewed)
    await writeFile(join(fixture.root, 'adv/audio/pronunciation.json'), JSON.stringify({ schemaVersion: 1, revision: 2, replacements: { 世界: '全世界' }, locales: {} }))
    await request('/command', { jobId: reviewed.plan.id, action: 'run' })
    await vi.waitFor(async () => expect((await snapshot()).jobs[0]!.tasks[0]).toMatchObject({ status: 'failed', errorCode: 'INPUT_INVALID', attempts: 0 }))
    expect(fixture.calls).toHaveLength(0)
  })

  it('executes without blocking HTTP, keeps interrupted outcomes unknown across restart and prevents repeated charges', async () => {
    fixture.setBeforeSynthesis(async request => await new Promise<void>((_resolve, reject) => {
      request.signal!.addEventListener('abort', () => reject(new Error('secret credential in provider failure')), { once: true })
    }))
    const reviewed = await plan([editorJobLineIds[0]!])
    await enqueue(reviewed)
    expect((await request('/command', { jobId: reviewed.plan.id, action: 'run' })).status).toBe(200)
    await vi.waitFor(() => expect(fixture.calls).toHaveLength(1))
    expect((await snapshot()).jobs[0]!.tasks[0]!.status).toBe('running')
    await request('/command', { jobId: reviewed.plan.id, action: 'cancel' })
    await vi.waitFor(async () => expect((await snapshot()).jobs[0]!.tasks[0]!.status).toBe('unknown'))
    await bridge.stop()
    await start()
    await request('/command', { jobId: reviewed.plan.id, action: 'resume' })
    expect(await (await request('/command', { jobId: reviewed.plan.id, action: 'retry' })).json()).toEqual({ error: 'AUDIO_JOB_QUERY_REQUIRED' })
    await request('/command', { jobId: reviewed.plan.id, action: 'run' })
    await vi.waitFor(async () => expect((await snapshot()).jobs[0]!.tasks[0]!.status).toBe('unknown'))
    expect(fixture.calls).toHaveLength(1)
    expect((await snapshot()).jobs[0]!.chargedCharacters).toBeGreaterThan(0)
    expect(await readFile(join(fixture.storeDirectory, 'audio-jobs.json'), 'utf8')).not.toContain('secret credential')
  })

  it('requires actual clone consent and rejects references outside the immutable native media profile before synthesis', async () => {
    const rights = { license: 'test fixture consent', subject: 'Fixture', consentRecord: 'consent.md' }
    const profile = { intent: {}, locales: { 'zh-CN': { providers: { 'fixture-tts': { voiceId: 'system:fixture', model: 'fixture-model', source: 'cloned', rights } } } } }
    await writeFile(join(fixture.root, 'adv/settings/game.json'), JSON.stringify({ characters: [{ id: 'hero', name: 'Hero', voiceProfile: profile }] }))
    const inspect = fixture.provider.inspectPreset
    fixture.provider.inspectPreset = async (input) => {
      const result = await inspect(input)
      result.characters[0]!.referenceAssetId = 'voice-reference'
      result.characters[0]!.generation = { ...result.characters[0]!.generation!, source: 'cloned', referenceAssetId: 'voice-reference', referenceSha256: fixture.sha256 }
      return result
    }
    await writeFile(join(fixture.root, 'adv/assets.json'), JSON.stringify({ schemaVersion: 2, id: 'editor-jobs-assets', defaultProfile: 'local', profiles: { local: { provider: 'project', root: 'public/media' } }, assets: [{ id: 'voice-reference', type: 'audio', kind: 'reference', path: 'reference.wav', sha256: fixture.sha256, bytes: fixture.bytes.length, mimeType: 'audio/wav' }] }))
    await writeFile(join(fixture.root, 'public/media/reference.wav'), fixture.bytes)
    expect(await (await request('/plan', { lineIds: [editorJobLineIds[0]], locale: 'zh-CN', providerId: 'fixture-tts', budget })).json()).toEqual({ error: 'ADV_AUDIO_VOICE_CONSENT_REQUIRED' })
    await writeFile(join(fixture.root, 'consent.md'), 'Author-approved test-only consent')
    const reviewed = await plan([editorJobLineIds[0]!])
    await rm(join(fixture.root, 'public/media/reference.wav'))
    await writeFile(join(fixture.root, 'private-reference.wav'), fixture.bytes)
    await symlink(join(fixture.root, 'private-reference.wav'), join(fixture.root, 'public/media/reference.wav'))
    expect(await (await request('/enqueue', { planId: reviewed.plan.id, planHash: reviewed.planHash })).json()).toEqual({ error: 'ADV_AUDIO_VOICE_REFERENCE_REQUIRED' })
    expect(fixture.calls).toHaveLength(0)
  })

  it('retains a paid receipt when character intent changes during synthesis and registers it after restoring review without another call', async () => {
    let finish!: () => void
    fixture.setBeforeSynthesis(async () => await new Promise<void>(resolve => finish = resolve))
    const source = await readFile(join(fixture.root, 'adv/settings/game.json'), 'utf8')
    const reviewed = await plan([editorJobLineIds[0]!])
    await enqueue(reviewed)
    await request('/command', { jobId: reviewed.plan.id, action: 'run' })
    await vi.waitFor(() => expect(fixture.calls).toHaveLength(1))
    const changed = JSON.parse(source)
    changed.characters[0].voiceProfile.intent.pitch = 'high'
    await writeFile(join(fixture.root, 'adv/settings/game.json'), JSON.stringify(changed))
    finish()
    await vi.waitFor(async () => expect((await snapshot()).jobs[0]!.tasks[0]).toMatchObject({ status: 'failed', errorCode: 'REGISTRATION_FAILED' }))
    const receipt = JSON.parse(await readFile(join(fixture.storeDirectory, 'audio-jobs.json'), 'utf8'))
    expect(Object.values(receipt.idempotency)).toEqual([expect.objectContaining({ status: 'generated', candidate: expect.objectContaining({ sha256: fixture.sha256 }) })])
    expect((await runVoiceLedger({ root: fixture.root, config: fixture.config })).ledger.lines[editorJobLineIds[0]!]).toBeUndefined()
    await writeFile(join(fixture.root, 'adv/settings/game.json'), source)
    await request('/command', { jobId: reviewed.plan.id, action: 'retry' })
    await request('/command', { jobId: reviewed.plan.id, action: 'run' })
    await vi.waitFor(async () => expect((await snapshot()).jobs[0]!.tasks[0]!.status).toBe('committed'))
    expect(fixture.calls).toHaveLength(1)
    expect((await runVoiceLedger({ root: fixture.root, config: fixture.config })).ledger.lines[editorJobLineIds[0]!]!.locales['zh-CN']!.selectedTake).toBeNull()
  })
})
