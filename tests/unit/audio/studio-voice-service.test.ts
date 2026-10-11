import type { StudioAudioPublicationPort, StudioVoiceServiceOptions } from '../../../packages/advjs/node/audio/server'
import type { HostedVoiceJobsSnapshot, HostedVoicePreparedInput, HostedVoiceReceipts, HostedVoiceReviewedPlan, HostedVoiceSyncState } from '../../../packages/advjs/shared/hosted-audio'
import { createHash } from 'node:crypto'
import { cp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createStudioVoiceService } from '../../../packages/advjs/node/audio/server'
import { createNodeVoiceAuthoringService } from '../../../packages/advjs/node/audio/voice'
import { createEditorVoiceJobsFixture, editorJobLineIds } from '../../fixtures/audio/editor-voice-jobs'

const accountId = 'cloudbase-user-1'
const projectId = 'registered-project'
const prefix = `/v1/audio/projects/${projectId}`
const sourcePaths = ['adv.config.json', 'adv/settings/game.json', 'adv/chapters/intro.adv.md', 'adv/assets.json', 'adv/audio/voice-profiles.json']
const budget = { maxCharacters: 1000, allowUnknownCost: true, concurrency: 3 }

async function fixture() {
  const source = await createEditorVoiceJobsFixture()
  source.provider.doctor = async () => ({ provider: source.provider.id, ready: true, supported: true, checks: [] })
  const options: StudioVoiceServiceOptions = { host: '127.0.0.1', port: 0, stateDirectory: source.storeDirectory, allowedOrigins: ['http://localhost:3388'], authenticate: async (token: string) => token === 'session-one' ? { accountId } : token === 'session-other' ? { accountId: 'other-user' } : undefined, projects: [{ accountId, projectId, root: source.root, config: source.config }] }
  let service = await createStudioVoiceService(options)
  let url = (await service.start()).url
  async function request(path: string, method = 'GET', body?: unknown, token = 'session-one', origin = 'http://localhost:3388') {
    return await fetch(`${url}${path}`, { method, headers: { authorization: `Bearer ${token}`, origin, ...(body === undefined ? {} : { 'content-type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
  }
  async function success<T>(path: string, method = 'GET', body?: unknown) {
    const response = await request(path, method, body)
    const result = await response.json()
    expect(response.status, JSON.stringify(result)).toBe(200)
    return result as T
  }
  async function files() {
    return Object.fromEntries(await Promise.all(sourcePaths.map(async path => [path, await readFile(join(source.root, path), 'utf8')]))) as Record<string, string>
  }
  async function completed(jobId: string) {
    for (let i = 0; i < 100; i++) {
      const state = await success<HostedVoiceJobsSnapshot>(`${prefix}/jobs`)
      const job = state.jobs.find(job => job.id === jobId)!
      if (job.tasks.every(task => ['committed', 'unknown', 'failed', 'blocked', 'cancelled'].includes(task.status)))
        return job
      await new Promise(resolve => setTimeout(resolve, 10))
    }
    throw new Error('Fixture job did not settle')
  }
  return { ...source, options, request, success, files, completed, get url() {
    return url
  }, async restart() {
    await service.stop()
    service = await createStudioVoiceService(options)
    url = (await service.start()).url
  }, async close() {
    await service.stop()
    await rm(source.directory, { recursive: true, force: true })
  } }
}

describe('studio authenticated voice service', () => {
  it('authorizes publication before creating storage and safely reports SDK errors without transport credentials', async () => {
    const host = await fixture()
    let factories = 0
    let storageCalls = 0
    try {
      host.options.publication = async () => {
        factories++
        return {
          prepare: async () => {
            storageCalls++
            throw Object.assign(new Error('SDK request included private-host/authoring SecretKey=test-only-secret Token=test-only-token'), { statusCode: 403, code: 'AccessDenied' })
          },
          publish: async () => {
            storageCalls++
            throw new Error('AUDIO_RELEASE_STORAGE_UNAVAILABLE')
          },
          current: async () => null,
        }
      }
      expect((await host.request(`${prefix}/releases/prepare`, 'POST', {}, 'bad-session')).status).toBe(401)
      expect((await host.request(`${prefix}/releases/prepare`, 'POST', {}, 'session-other')).status).toBe(403)
      host.options.authorizeProject = async () => false
      expect((await host.request(`${prefix}/releases/publish`, 'POST', { planId: 'reviewed', expectedManifestRevision: null })).status).toBe(403)
      expect(factories).toBe(0)
      expect(storageCalls).toBe(0)
      host.options.authorizeProject = async () => true
      const failed = await host.request(`${prefix}/releases/prepare`, 'POST', {})
      const body = await failed.text()
      expect(body).not.toMatch(/SecretKey|test-only-secret|Token|test-only-token|private-host|authoring/u)
      expect(JSON.parse(body)).toEqual({ error: { code: 'ADV_AUDIO_JOBS_FAILED' } })
      expect(factories).toBe(1)
      expect(storageCalls).toBe(1)
    }
    finally { await host.close() }
  })

  it('accepts configured cloud credentials without pretending read-only diagnosis confirms network readiness', async () => {
    const host = await fixture()
    try {
      host.provider.capabilities.backend = 'cloud'
      host.provider.doctor = async () => ({ provider: host.provider.id, ready: false, supported: true, checks: [{ id: 'credentials', status: 'pass', message: 'Configured' }, { id: 'connectivity', status: 'warn', message: 'Not probed' }] })
      const prepared = await host.success<HostedVoicePreparedInput>(`${prefix}/prepare`, 'POST', { lineId: editorJobLineIds[0], locale: 'zh-CN', providerId: host.provider.id })
      expect(prepared.providerId).toBe(host.provider.id)
      expect(host.calls).toHaveLength(0)
      await writeFile(join(host.root, 'alternate.json'), JSON.stringify({ model: 'fixture-model', voiceId: 'system:fixture' }))
      const voice = host.config.authoring!.voice!
      const other = { ...host.provider, id: 'other-tts' }
      voice.providers!.push(other)
      voice.presets.alternate = 'alternate.json'
      voice.presetProviders = { fixture: other.id, alternate: host.provider.id }
      expect((await host.success<HostedVoicePreparedInput>(`${prefix}/prepare`, 'POST', { lineId: editorJobLineIds[0], locale: 'zh-CN', providerId: host.provider.id })).parameters?.preset).toBe('alternate')
      host.provider.doctor = async () => ({ provider: host.provider.id, ready: false, supported: true, checks: [{ id: 'credentials', status: 'fail', message: 'Missing' }] })
      const rejected = await host.request(`${prefix}/prepare`, 'POST', { lineId: editorJobLineIds[0], locale: 'zh-CN', providerId: host.provider.id })
      expect(rejected.status).toBe(503)
      expect(host.calls).toHaveLength(0)
    }
    finally { await host.close() }
  })

  it('executes the existing provider registry through real HTTP, survives restart and serves verified immutable receipts', async () => {
    const host = await fixture()
    try {
      const state = await host.success<HostedVoiceJobsSnapshot>(`${prefix}/jobs`)
      expect(state).toMatchObject({ accountId, projectId, configured: true, providerConcurrency: { 'fixture-tts': 1 } })
      const prepared = await host.success<HostedVoicePreparedInput>(`${prefix}/prepare`, 'POST', { lineId: editorJobLineIds[0], locale: 'zh-CN', providerId: host.provider.id })
      expect(JSON.stringify(prepared)).not.toContain(host.root)
      expect(prepared).not.toHaveProperty('displayText')
      expect(host.calls).toHaveLength(0)
      const review = await host.success<HostedVoiceReviewedPlan>(`${prefix}/plan`, 'POST', { lineIds: editorJobLineIds, locale: 'zh-CN', providerId: host.provider.id, budget })
      expect(review.plan.accountId).toBe(accountId)
      expect(review.plan.tasks[0]!.inputFingerprint).toBe(prepared.inputFingerprint)
      await host.success(`${prefix}/enqueue`, 'POST', { planId: review.plan.id, planHash: review.planHash })
      await host.success(`${prefix}/command`, 'POST', { jobId: review.plan.id, action: 'run' })
      expect((await host.completed(review.plan.id)).tasks.map(task => task.status)).toEqual(['committed', 'committed'])
      expect(host.calls).toHaveLength(2)
      await host.restart()
      const restored = await host.success<HostedVoiceReceipts>(`${prefix}/jobs/${review.plan.id}/receipts`)
      expect(restored.receipts).toHaveLength(2)
      expect(restored.receipts[0]!.asset.id).toBe(restored.receipts[0]!.take.assetId)
      expect(restored.receipts[0]!.candidate).not.toHaveProperty('path')
      expect(JSON.stringify(restored)).not.toContain(host.root)
      const response = await host.request(restored.receipts[0]!.mediaUrl)
      const downloaded = new Uint8Array(await response.arrayBuffer())
      expect(response.status).toBe(200)
      expect(createHash('sha256').update(downloaded).digest('hex')).toBe(restored.receipts[0]!.take.sha256)
      const duplicate = await host.success<HostedVoiceJobsSnapshot['jobs'][number]>(`${prefix}/enqueue`, 'POST', { planId: review.plan.id, planHash: review.planHash })
      expect(duplicate.id).toBe(review.plan.id)
      await host.success(`${prefix}/command`, 'POST', { jobId: review.plan.id, action: 'run' })
      expect(host.calls).toHaveLength(2)
      const native = await (await createNodeVoiceAuthoringService({ root: host.root, config: host.config })).read()
      expect(native.ledger.lines[editorJobLineIds[0]!]!.locales['zh-CN']!.selectedTake).toBeNull()
    }
    finally { await host.close() }
  })

  it('authenticates each request, rejects cross-account scope, executable sync, traversal and unreviewed authority', async () => {
    const host = await fixture()
    try {
      expect((await host.request(`${prefix}/jobs`, 'GET', undefined, 'bad-session')).status).toBe(401)
      expect((await host.request(`${prefix}/jobs`, 'GET', undefined, 'session-other')).status).toBe(403)
      expect((await host.request(`${prefix}/jobs`, 'GET', undefined, 'session-one', 'https://evil.example')).status).toBe(403)
      expect((await host.request(`${prefix}/plan`, 'POST', { accountId: 'other-user', lineIds: editorJobLineIds, locale: 'zh-CN', providerId: host.provider.id, budget })).status).toBe(400)
      expect((await host.request(`${prefix}/plan`, 'POST', { lineIds: editorJobLineIds, locale: 'zh-CN', providerId: host.provider.id, budget: { ...budget, allowUnknownCost: false } })).status).toBe(400)
      expect((await host.request(`${prefix}/enqueue`, 'POST', { planId: 'fake', planHash: 'fake' })).status).toBe(400)
      const sync = await host.success<HostedVoiceSyncState>(`${prefix}/sync`)
      const files = await host.files()
      for (const path of ['adv.config.ts', '../outside.json', 'adv/../escape.md', 'adv/chapters/code.js']) {
        expect((await host.request(`${prefix}/sync`, 'POST', { expectedRevision: sync.revision, files: { ...files, [path]: 'export default {}' } })).status).toBe(400)
      }
      expect((await host.request(`${prefix}/sync`, 'POST', { expectedRevision: sync.revision, files: { ...files, 'adv/settings/game.json': JSON.stringify({ apiKey: 'must-never-be-uploaded' }) } })).status).toBe(400)
      expect(host.calls).toHaveLength(0)
      await expect(createStudioVoiceService({ ...host.options, projects: [...host.options.projects, { ...host.options.projects[0]!, accountId: 'other-user', projectId: 'other-project' }] })).rejects.toThrow('ROOT_ISOLATION_REQUIRED')
    }
    finally { await host.close() }
  })

  it('syncs the current native authoring inputs with CAS while retaining service-generated take history', async () => {
    const host = await fixture()
    try {
      const files = await host.files()
      const before = await host.success<HostedVoiceSyncState>(`${prefix}/sync`)
      files['adv/chapters/intro.adv.md'] = files['adv/chapters/intro.adv.md']!.replace('你好，世界。', '改写后的对白。')
      files['adv/audio/pronunciation.json'] = JSON.stringify({ schemaVersion: 1, revision: 1, replacements: { 改写: '改稿' }, locales: {} })
      const after = await host.success<HostedVoiceSyncState>(`${prefix}/sync`, 'POST', { expectedRevision: before.revision, files })
      expect(after.revision).not.toBe(before.revision)
      expect((await host.request(`${prefix}/sync`, 'POST', { expectedRevision: before.revision, files })).status).toBe(409)
      const review = await host.success<HostedVoiceReviewedPlan>(`${prefix}/plan`, 'POST', { lineIds: [editorJobLineIds[0]], locale: 'zh-CN', providerId: host.provider.id, budget })
      await host.success(`${prefix}/enqueue`, 'POST', { planId: review.plan.id, planHash: review.planHash })
      await host.success(`${prefix}/command`, 'POST', { jobId: review.plan.id, action: 'run' })
      expect((await host.completed(review.plan.id)).tasks[0]!.status).toBe('committed')
      expect(host.calls[0]!.text).toBe('改稿后的对白。')
      const receipts = await host.success<HostedVoiceReceipts>(`${prefix}/jobs/${review.plan.id}/receipts`)
      const current = await host.success<HostedVoiceSyncState>(`${prefix}/sync`)
      // An author snapshot can omit the newly generated history. It cannot erase it.
      await host.success(`${prefix}/sync`, 'POST', { expectedRevision: current.revision, files })
      const native = await (await createNodeVoiceAuthoringService({ root: host.root, config: host.config })).read()
      expect(native.ledger.lines[editorJobLineIds[0]!]!.locales['zh-CN']!.takes[0]!.id).toBe(receipts.receipts[0]!.take.id)
      const still = await host.success<HostedVoiceReceipts>(`${prefix}/jobs/${review.plan.id}/receipts`)
      expect(still.receipts[0]!.take.id).toBe(receipts.receipts[0]!.take.id)
      // A generated locale's displayText is an old source snapshot, not a
      // translation override for the project's explicitly declared source locale.
      files['adv/chapters/intro.adv.md'] = files['adv/chapters/intro.adv.md']!.replace('改写后的对白。', '再次改写的对白。')
      const latest = await host.success<HostedVoiceSyncState>(`${prefix}/sync`)
      await host.success(`${prefix}/sync`, 'POST', { expectedRevision: latest.revision, files })
      const changed = await host.success<HostedVoiceReviewedPlan>(`${prefix}/plan`, 'POST', { lineIds: [editorJobLineIds[0]], locale: 'zh-CN', providerId: host.provider.id, budget })
      expect(changed.plan.tasks[0]!.inputFingerprint).not.toBe(review.plan.tasks[0]!.inputFingerprint)
      await host.success(`${prefix}/enqueue`, 'POST', { planId: changed.plan.id, planHash: changed.planHash })
      await host.success(`${prefix}/command`, 'POST', { jobId: changed.plan.id, action: 'run' })
      expect((await host.completed(changed.plan.id)).tasks[0]!.status).toBe('committed')
      expect(host.calls[1]!.text).toBe('再次改稿的对白。')
    }
    finally { await host.close() }
  })

  it('blocks an unsupported local execution host and retains unknown supplier outcomes without a second call', async () => {
    const host = await fixture()
    try {
      host.provider.doctor = async () => ({ provider: host.provider.id, supported: false, ready: false, checks: [] })
      const unsupported = await host.request(`${prefix}/prepare`, 'POST', { lineId: editorJobLineIds[0], locale: 'zh-CN', providerId: host.provider.id })
      expect(unsupported.status).toBe(503)
      expect(await unsupported.json()).toEqual({ error: { code: 'ADV_AUDIO_PROVIDER_HOST_UNSUPPORTED' } })
      expect(host.calls).toHaveLength(0)
      host.provider.doctor = async () => ({ provider: host.provider.id, supported: true, ready: true, checks: [] })
      host.setBeforeSynthesis(async () => {
        throw new Error('supplier error with secret must not escape')
      })
      const review = await host.success<HostedVoiceReviewedPlan>(`${prefix}/plan`, 'POST', { lineIds: [editorJobLineIds[0]], locale: 'zh-CN', providerId: host.provider.id, budget })
      await host.success(`${prefix}/enqueue`, 'POST', { planId: review.plan.id, planHash: review.planHash })
      await host.success(`${prefix}/command`, 'POST', { jobId: review.plan.id, action: 'run' })
      expect((await host.completed(review.plan.id)).tasks[0]!.status).toBe('unknown')
      await host.restart()
      await host.success(`${prefix}/command`, 'POST', { jobId: review.plan.id, action: 'run' })
      expect((await host.completed(review.plan.id)).tasks[0]!.status).toBe('unknown')
      expect((await host.request(`${prefix}/command`, 'POST', { jobId: review.plan.id, action: 'retry' })).status).toBe(400)
      expect(host.calls).toHaveLength(1)
      expect(JSON.stringify(await host.success(`${prefix}/jobs`))).not.toContain('supplier error')
    }
    finally { await host.close() }
  })

  it('copies only registered checksum-bound media and refuses symlink escapes or immutable-byte changes', async () => {
    const host = await fixture()
    try {
      const state = await host.success<HostedVoiceSyncState>(`${prefix}/sync`)
      const files = await host.files()
      const manifest = JSON.parse(files['adv/assets.json']!)
      const assetId = 'audio_019d137e-7abc-7000-8000-000000000010'
      manifest.assets.push({ id: assetId, type: 'audio', kind: 'reference', path: 'reference/actor.wav', characterId: 'hero', sha256: host.sha256, bytes: host.bytes.length, mimeType: 'audio/wav' })
      files['adv/assets.json'] = JSON.stringify(manifest)
      const next = await host.success<HostedVoiceSyncState>(`${prefix}/sync`, 'POST', { expectedRevision: state.revision, files })
      expect(next.missingMedia).toHaveLength(1)
      const uploaded = await fetch(`${host.url}${prefix}/media/${assetId}`, { method: 'PUT', headers: { 'authorization': 'Bearer session-one', 'origin': 'http://localhost:3388', 'content-type': 'audio/wav', 'x-advjs-sha256': host.sha256 }, body: host.bytes })
      expect(uploaded.status).toBe(200)
      expect((await host.success<HostedVoiceSyncState>(`${prefix}/sync`)).missingMedia).toEqual([])
      const file = join(host.root, 'public/media/reference/actor.wav')
      await writeFile(file, 'corrupted bytes')
      expect((await host.request(`${prefix}/sync`)).status).toBe(409)
      await rm(file)
      await symlink(join(host.directory, 'application-data'), join(host.root, 'public/media/reference/escape'))
      manifest.assets.push({ id: 'audio_019d137e-7abc-7000-8000-000000000011', type: 'audio', kind: 'reference', path: 'reference/escape/leak.wav', characterId: 'hero', sha256: host.sha256, bytes: host.bytes.length, mimeType: 'audio/wav' })
      files['adv/assets.json'] = JSON.stringify(manifest)
      const latest = await host.success<HostedVoiceSyncState>(`${prefix}/sync`)
      expect((await host.request(`${prefix}/sync`, 'POST', { expectedRevision: latest.revision, files })).status).not.toBe(200)
      expect(await readFile(join(host.root, 'adv/assets.json'), 'utf8')).not.toContain('leak.wav')
    }
    finally { await host.close() }
  })
  it('imports the original IDs locally, explicitly selects them and syncs the canonical selection to publication', async () => {
    const host = await fixture()
    try {
      const localRoot = join(host.directory, 'local-studio-project')
      await cp(host.root, localRoot, { recursive: true })
      const review = await host.success<HostedVoiceReviewedPlan>(`${prefix}/plan`, 'POST', { lineIds: [editorJobLineIds[0]], locale: 'zh-CN', providerId: host.provider.id, budget })
      await host.success(`${prefix}/enqueue`, 'POST', { planId: review.plan.id, planHash: review.planHash })
      await host.success(`${prefix}/command`, 'POST', { jobId: review.plan.id, action: 'run' })
      await host.completed(review.plan.id)
      const { receipts } = await host.success<HostedVoiceReceipts>(`${prefix}/jobs/${review.plan.id}/receipts`)
      const receipt = receipts[0]!
      const response = await host.request(receipt.mediaUrl)
      const candidatePath = 'temporary/downloaded.wav'
      await mkdir(join(localRoot, 'temporary'), { recursive: true })
      await writeFile(join(localRoot, candidatePath), new Uint8Array(await response.arrayBuffer()))
      const local = await createNodeVoiceAuthoringService({ root: localRoot, config: host.config })
      const snapshot = await local.read()
      const imported = await local.importTake!({ ...receipt, candidate: { ...receipt.candidate, path: candidatePath, characterId: receipt.speakerId, text: receipt.take.spokenText }, displayText: '你好，世界。', providerVoiceId: receipt.take.voiceId, voiceProfileRevision: receipt.take.voiceProfileRevision, source: receipt.take.source, parameters: receipt.take.parameters, expectedRevision: snapshot.revision })
      expect(imported.ledger.lines[receipt.lineId]!.locales[receipt.locale]!.takes[0]!.id).toBe(receipt.take.id)
      expect(imported.catalog.assets[0]!.id).toBe(receipt.asset.id)
      expect(imported.ledger.lines[receipt.lineId]!.locales[receipt.locale]!.selectedTake).toBeNull()
      const selected = await local.select({ lineId: receipt.lineId, locale: receipt.locale, takeId: receipt.take.id, expectedRevision: imported.revision })
      expect(selected.ledger.lines[receipt.lineId]!.locales[receipt.locale]!.selectedTake).toBe(receipt.take.id)
      const files = Object.fromEntries(await Promise.all([...sourcePaths, 'adv/audio/voice-ledger.json'].map(async path => [path, await readFile(join(localRoot, path), 'utf8')])))
      const revision = await host.success<HostedVoiceSyncState>(`${prefix}/sync`)
      await host.success(`${prefix}/sync`, 'POST', { expectedRevision: revision.revision, files })
      const canonical = await (await createNodeVoiceAuthoringService({ root: host.root, config: host.config })).read()
      expect(canonical.ledger.lines[receipt.lineId]!.locales[receipt.locale]!.selectedTake).toBe(receipt.take.id)
      expect(canonical.ledger.lines[receipt.lineId]!.locales[receipt.locale]!.takes).toHaveLength(1)
      let factories = 0
      let closed = 0
      const queued = { id: '019d137e-7abc-7000-8000-000000000009', status: 'queued' }
      const port: StudioAudioPublicationPort = {
        prepare: async () => ({ selectedTake: (await (await createNodeVoiceAuthoringService({ root: host.root, config: host.config })).read()).ledger.lines[receipt.lineId]!.locales[receipt.locale]!.selectedTake }),
        publish: async () => { throw new Error('AUDIO_RELEASE_MANIFEST_CONFLICT') },
        current: async () => null,
        close: async () => { closed++ },
      }
      host.options.publication = async (context) => {
        factories++
        expect(context).toEqual({ accountId, projectId, root: host.root })
        return port
      }
      expect(await host.success(`${prefix}/releases/prepare`, 'POST', {})).toEqual({ selectedTake: receipt.take.id })
      expect(await host.success(`${prefix}/releases/current`)).toBeNull()
      expect(factories).toBe(1)
      const failed = await host.request(`${prefix}/releases/publish`, 'POST', { planId: 'reviewed', expectedManifestRevision: null })
      expect(await failed.json()).toEqual({ error: { code: 'AUDIO_RELEASE_MANIFEST_CONFLICT' } })
      port.beginPrepare = async () => queued
      port.prepare = async () => {
        throw new Error('Blocking preparation must not run from HTTP')
      }
      port.preparations = async () => [queued]
      port.preparation = async (id) => {
        expect(id).toBe(queued.id)
        return queued
      }
      expect(await host.success(`${prefix}/releases/prepare`, 'POST', {})).toEqual(queued)
      expect(await host.success(`${prefix}/releases/preparations`)).toEqual([queued])
      expect(await host.success(`${prefix}/releases/preparations/${queued.id}`)).toEqual(queued)
      await host.restart()
      expect(closed).toBe(1)
      expect(host.calls).toHaveLength(1)
    }
    finally { await host.close() }
  })
})
