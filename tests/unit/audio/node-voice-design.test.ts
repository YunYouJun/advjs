import type { NodeVoiceDesignOptions } from '../../../packages/advjs/node/audio/voice-design'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { VOICE_DESIGN_LIBRARY_PATH } from '@advjs/audio'
import { describe, expect, it, vi } from 'vitest'
import { createNodeVoiceAuthoringService, runVoiceBindTake, runVoiceGenerateTake } from '../../../packages/advjs/node/audio/voice'
import { createNodeVoiceDesignHost } from '../../../packages/advjs/node/audio/voice-design'
import { prepareProjectGame } from '../../../packages/advjs/node/commands/build/project'
import { createEditorVoiceJobsHost } from '../../../packages/advjs/node/editor/audio-jobs'
import * as mutations from '../../../packages/advjs/node/editor/mutations'
import { loadProject } from '../../../packages/advjs/node/project'
import { createFakeAudioBackend } from '../../../packages/audio/src/testing'
import { useAdvAudio } from '../../../packages/client/composables/useAdvAudio'
import { createAdvRuntime } from '../../../packages/core/src/runtime'
import { editorJobLineIds } from '../../fixtures/audio/editor-voice-jobs'
import { createVoiceDesignFixture } from '../../fixtures/audio/voice-design'

async function settled(host: Awaited<ReturnType<typeof createNodeVoiceDesignHost>>, id: string) {
  for (let index = 0; index < 100; index++) {
    const preview = await host.readPreview(id)
    if (!['queued', 'running'].includes(preview.status))
      return preview
    await new Promise(resolve => setTimeout(resolve, 10))
  }
  throw new Error('Fixture preview did not settle')
}
async function fixture(overrides: Pick<NodeVoiceDesignOptions, 'withProviderPermit'> = {}) {
  const source = await createVoiceDesignFixture()
  const options = { root: source.root, config: source.config, stateDirectory: join(source.storeDirectory, 'design'), ...overrides }
  let host = await createNodeVoiceDesignHost(options)
  async function ready() {
    const saved = await host.saveVersion({ expectedRevision: (await host.read()).revision, draft: source.draft })
    const review = await host.planPreview({ voiceId: source.draft.id, locale: 'zh-CN', providerId: source.provider.id, text: '试听这段声音。', expectedRevision: saved.snapshot.revision, budget: { maxCharacters: 100, allowUnknownCost: true } })
    const queued = await host.executePreview({ reviewId: review.id, reviewHash: review.reviewHash })
    const preview = await settled(host, queued.id)
    expect(preview.status).toBe('ready')
    return { saved, review, preview }
  }
  return { ...source, ready, get host() {
    return host
  }, async restart() {
    await host.close()
    host = await createNodeVoiceDesignHost(options)
  }, async close() {
    await host.close()
    await rm(source.directory, { recursive: true, force: true })
  } }
}

describe('trusted native voice design host', () => {
  it('uses the explicitly applied character voice for dialogue and plays only its adopted take in an ordinary exported game', async () => {
    const source = await fixture()
    try {
      expect((await source.host.read()).providers[0]).toMatchObject({ id: 'fixture-tts', sources: ['system', 'designed', 'cloned'] })
      await expect(readFile(join(source.root, VOICE_DESIGN_LIBRARY_PATH))).rejects.toMatchObject({ code: 'ENOENT' })
      const { preview, saved } = await source.ready()
      expect(preview.candidate).not.toHaveProperty('path')
      expect((await source.host.readPreviewAudio(preview.id)).bytes).toEqual(source.bytes)
      const registered = await source.host.registerSample({ previewId: preview.id, expectedRevision: saved.snapshot.revision })
      const assetId = registered.media!.asset.id
      expect(registered.snapshot.library.voices[0]!.design!.selectedSamples).toEqual({})
      expect(registered.snapshot.library.voices[0]!.selectedSample).toBeUndefined()
      const selected = await source.host.selectSample({ voiceId: source.draft.id, locale: 'zh-CN', providerId: source.provider.id, assetId, expectedRevision: registered.snapshot.revision })
      await expect(source.host.applyProfile({ voiceId: source.draft.id, locale: 'zh-CN', providerId: source.provider.id, expectedRevision: selected.snapshot.revision })).rejects.toThrow('REPLACE_REQUIRED')
      const applied = await source.host.applyProfile({ voiceId: source.draft.id, locale: 'zh-CN', providerId: source.provider.id, expectedRevision: selected.snapshot.revision, replaceBinding: true })
      const game = JSON.parse(await readFile(join(source.root, 'adv/settings/game.json'), 'utf8'))
      expect(game).not.toHaveProperty('voiceProfile')
      expect(game.characters[0].voiceProfile.locales['zh-CN'].providers['fixture-tts']).toMatchObject({ projectVoiceId: source.draft.id, voiceId: 'system:soft' })
      expect(applied.profile).toEqual(game.characters[0].voiceProfile)
      const jobs = await createEditorVoiceJobsHost({ projectRoot: source.root, config: source.config, storeDirectory: join(source.storeDirectory, 'jobs') })
      try {
        const prepared = await jobs.prepare({ lineId: editorJobLineIds[0]!, locale: 'zh-CN', providerId: source.provider.id })
        expect(prepared).toMatchObject({ voiceId: 'system:soft', parameters: { projectVoiceId: source.draft.id, projectVoiceVersion: '1' } })
        expect((await jobs.read()).jobs).toEqual([])
      }
      finally { await jobs.close() }
      expect(source.calls).toHaveLength(1)
      expect(await readFile(join(source.root, 'adv/audio/voice-ledger.json'), 'utf8').catch(() => null)).toBeNull()
      const authoring = await createNodeVoiceAuthoringService({ root: source.root, config: source.config })
      const generated = await runVoiceGenerateTake({ root: source.root, config: source.config, lineId: editorJobLineIds[0]!, locale: 'zh-CN', expectedRevision: (await authoring.read()).revision })
      const take = generated.ledger.lines[editorJobLineIds[0]!]!.locales['zh-CN']!.takes[0]!
      expect(take.parameters).toMatchObject({ projectVoiceId: source.draft.id, projectVoiceVersion: '1' })
      expect(take.voiceId).toBe('system:soft')
      expect(generated.ledger.lines[editorJobLineIds[0]!]!.locales['zh-CN']!.selectedTake).toBeNull()
      expect(source.calls).toHaveLength(2)

      // A reviewed character sample and a generated dialogue are distinct:
      // neither enters the player until the dialogue is explicitly adopted.
      const unselected = await prepareProjectGame(await loadProject({ root: source.root }))
      expect(Object.keys(unselected.game.audio!.assets)).toEqual([])
      expect(unselected.resources.size).toBe(0)
      expect(unselected.game.audio!.voiceLedger!.lines).toEqual({})

      await runVoiceBindTake({ root: source.root, config: source.config, lineId: editorJobLineIds[0]!, locale: 'zh-CN', takeId: take.id, expectedRevision: generated.revision })
      const loaded = await loadProject({ root: source.root })
      const exported = await prepareProjectGame(loaded)
      const binding = exported.game.audio!.voiceLedger!.lines[editorJobLineIds[0]!]!.locales['zh-CN']!
      expect(binding.selectedTake).toBe(take.id)
      expect(binding.takes).toEqual([take])
      expect(Object.keys(exported.game.audio!.assets)).toEqual([take.assetId])
      expect(exported.game.audio!.assets[take.assetId]!.sha256).toBe(take.sha256)
      expect(exported.game.audio!.assets[assetId]).toBeUndefined()
      expect([...exported.resources.values()]).toEqual([source.bytes])
      for (const privateField of ['voiceProfile', 'selectedSamples', 'presetPath', 'speakingStyle'])
        expect(JSON.stringify(exported.game)).not.toContain(`"${privateField}"`)

      const runtime = createAdvRuntime({ program: loaded.result.project.program! })
      const first = await runtime.start()
      expect(first.effects).toContainEqual({ type: 'dialogue.voice', payload: { lineId: editorJobLineIds[0], speakerId: 'hero', text: '你好，世界。' } })
      const backend = createFakeAudioBackend()
      const audio = useAdvAudio({ backend, gameConfig: () => exported.game })
      try {
        audio.setLocale('zh-CN')
        await audio.applyEffects(first.effects, first.state)
        expect(backend.loads.map(load => load.asset.assetId)).toEqual([take.assetId])
        expect(backend.loads[0]!.asset.url).toBe(exported.game.audio!.assets[take.assetId]!.src)
        expect(audio.voicePlaying.value).toBe(true)
        expect(backend.playbacks).toHaveLength(1)
        expect(backend.playbacks[0]!.bus).toBe('voice')

        const next = await runtime.next()
        await audio.applyEffects(next.effects, next.state)
        expect(audio.voicePlaying.value).toBe(false)
        expect(backend.playbacks[0]!.stopped).toBe(true)
        // A missing exact-language take never falls back to the Chinese one.
        audio.setLocale('ja-JP')
        await audio.applyEffects(first.effects, first.state)
        expect(backend.playbacks).toHaveLength(1)
        expect(audio.voicePlaying.value).toBe(false)
      }
      finally { audio.dispose() }
      expect(source.calls).toHaveLength(2)
    }
    finally { await source.close() }
  })

  it('blocks unknown execution across fresh reviews and restarts instead of dispatching the same fingerprint again', async () => {
    const source = await fixture()
    try {
      source.setBeforeSynthesis(async () => {
        throw new Error('Private provider error')
      })
      const saved = await source.host.saveVersion({ draft: source.draft, expectedRevision: (await source.host.read()).revision })
      const input = { voiceId: source.draft.id, locale: 'zh-CN', providerId: source.provider.id, text: '未知结果', expectedRevision: saved.snapshot.revision, budget: { maxCharacters: 100, allowUnknownCost: true } }
      const first = await source.host.planPreview(input)
      const firstPreview = await source.host.executePreview({ reviewId: first.id, reviewHash: first.reviewHash })
      expect((await settled(source.host, firstPreview.id)).status).toBe('unknown')
      await source.host.cancelPreview(firstPreview.id)
      await source.restart()
      const second = await source.host.planPreview(input)
      const repeated = await source.host.executePreview({ reviewId: second.id, reviewHash: second.reviewHash })
      expect(repeated).toMatchObject({ id: firstPreview.id, status: 'unknown' })
      expect(source.calls).toHaveLength(1)
      expect(JSON.stringify(await source.host.read())).not.toContain('Private provider error')
    }
    finally { await source.close() }
  })

  it('requires a new explicit review to recover a known failure before supplier dispatch', async () => {
    const source = await fixture()
    try {
      const saved = await source.host.saveVersion({ draft: source.draft, expectedRevision: (await source.host.read()).revision })
      const input = { voiceId: source.draft.id, locale: 'zh-CN', providerId: source.provider.id, text: '准备环境之后再试听', expectedRevision: saved.snapshot.revision, budget: { maxCharacters: 100, allowUnknownCost: true } }
      source.provider.doctor = async () => ({ provider: source.provider.id, supported: true, ready: false, checks: [] })
      const first = await source.host.planPreview(input)
      const failed = await source.host.executePreview({ reviewId: first.id, reviewHash: first.reviewHash })
      expect(await settled(source.host, failed.id)).toMatchObject({ status: 'failed', error: 'VOICE_DESIGN_PROVIDER_NOT_READY' })
      expect(source.calls).toHaveLength(0)
      source.provider.doctor = async () => ({ provider: source.provider.id, supported: true, ready: true, checks: [] })
      expect(await source.host.executePreview({ reviewId: first.id, reviewHash: first.reviewHash })).toMatchObject({ id: failed.id, status: 'failed' })
      const reviewed = await source.host.planPreview(input)
      const retried = await source.host.executePreview({ reviewId: reviewed.id, reviewHash: reviewed.reviewHash })
      expect(retried.id).not.toBe(failed.id)
      expect((await settled(source.host, retried.id)).status).toBe('ready')
      expect(source.calls).toHaveLength(1)
    }
    finally { await source.close() }
  })

  it.each(['profile', 'consent'] as const)('rechecks %s changes after a queued preview acquires the provider permit', async (changed) => {
    let release!: () => void
    let acquired!: () => void
    const entered = new Promise<void>(resolve => acquired = resolve)
    const blocked = new Promise<void>(resolve => release = resolve)
    const source = await fixture({ async withProviderPermit(_providerId, _signal, operation) {
      acquired()
      await blocked
      return await operation()
    } })
    try {
      let draft = source.draft
      const consentRecord = 'authoring/rights/queued.json'
      if (changed === 'consent') {
        const catalogPath = join(source.root, 'adv/assets.json')
        const catalog = JSON.parse(await readFile(catalogPath, 'utf8'))
        catalog.assets.push({ id: 'reference/queued', type: 'audio', kind: 'reference', path: 'reference.wav', sha256: source.sha256, bytes: source.bytes.length, mimeType: 'audio/wav', characterId: 'hero' })
        await writeFile(catalogPath, JSON.stringify(catalog))
        await writeFile(join(source.root, 'public/media/reference.wav'), source.bytes)
        await mkdir(join(source.root, 'authoring/rights'), { recursive: true })
        await writeFile(join(source.root, consentRecord), JSON.stringify({ approved: true }))
        draft = { ...draft, locales: { 'zh-CN': { providers: { [source.provider.id]: { preset: 'fixture', source: 'cloned', reference: { assetId: 'reference/queued', sha256: source.sha256, mode: 'embedding-only' }, rights: { license: 'consented-private', subject: 'Hero performer', consentRecord } } } } } }
      }
      const saved = await source.host.saveVersion({ draft, expectedRevision: (await source.host.read()).revision })
      const review = await source.host.planPreview({ voiceId: draft.id, locale: 'zh-CN', providerId: source.provider.id, text: '等待之后再次验证审核输入', expectedRevision: saved.snapshot.revision, budget: { maxCharacters: 100, allowUnknownCost: true } })
      const queued = await source.host.executePreview({ reviewId: review.id, reviewHash: review.reviewHash })
      await entered
      if (changed === 'consent') {
        await rm(join(source.root, consentRecord))
      }
      else {
        const gamePath = join(source.root, 'adv/settings/game.json')
        const game = JSON.parse(await readFile(gamePath, 'utf8'))
        game.characters[0].voiceProfile.intent.speakingStyle = '排队期间修改了声音意图'
        await writeFile(gamePath, JSON.stringify(game))
      }
      release()
      expect(await settled(source.host, queued.id)).toMatchObject({ status: 'failed', error: changed === 'consent' ? 'VOICE_DESIGN_CONSENT_REQUIRED' : 'VOICE_DESIGN_REVIEW_STALE' })
      expect(source.calls).toHaveLength(0)
    }
    finally {
      release()
      await source.close()
    }
  })

  it('recovers the same sample ID when private receipt persistence fails after native commit', async () => {
    const source = await fixture()
    let spy: ReturnType<typeof vi.spyOn> | undefined
    try {
      const { preview, saved } = await source.ready()
      const realWrite = mutations.atomicProjectWrite
      spy = vi.spyOn(mutations, 'atomicProjectWrite').mockImplementation(async (path, content) => {
        if (path.endsWith('voice-design.json') && JSON.parse(content).previews[preview.id]?.preview.status === 'registered')
          throw new Error('Disk unavailable after native commit')
        return await realWrite(path, content)
      })
      await expect(source.host.registerSample({ previewId: preview.id, expectedRevision: saved.snapshot.revision })).rejects.toThrow('Disk unavailable')
      const before = JSON.parse(await readFile(join(source.root, VOICE_DESIGN_LIBRARY_PATH), 'utf8'))
      expect(before.voices[0].design.samples).toHaveLength(1)
      spy.mockRestore()
      const recovered = await source.host.registerSample({ previewId: preview.id, expectedRevision: saved.snapshot.revision })
      expect(recovered.media!.asset.id).toBe(before.voices[0].design.samples[0].assetId)
      expect(recovered.snapshot.library.voices[0]!.design!.samples).toHaveLength(1)
      expect(recovered.changes.find(change => change.path === VOICE_DESIGN_LIBRARY_PATH)!.expected).toBe(saved.changes.at(-1)!.content)
      expect(source.calls).toHaveLength(1)
    }
    finally {
      spy?.mockRestore()
      await source.close()
    }
  })

  it('rejects budget, capability, stale source and changed candidate bytes before registration', async () => {
    const source = await fixture()
    try {
      const { preview, saved } = await source.ready()
      await expect(source.host.planPreview({ voiceId: source.draft.id, locale: 'zh-CN', providerId: source.provider.id, text: '试听', expectedRevision: saved.snapshot.revision, budget: { maxCharacters: 100, allowUnknownCost: false } })).rejects.toThrow('BUDGET_REVIEW_REQUIRED')
      const candidate = source.calls[0]!
      expect(candidate.voiceId).toBe(source.draft.id)
      await writeFile(join(source.root, 'temporary/candidate-1.wav'), 'changed')
      await expect(source.host.registerSample({ previewId: preview.id, expectedRevision: saved.snapshot.revision })).rejects.toThrow('MEDIA_CHANGED')
      expect((await source.host.read()).library.voices[0]!.design!.samples).toEqual([])
      await writeFile(join(source.root, 'adv/settings/game.json'), JSON.stringify({ title: 'changed', characters: [{ id: 'hero', name: 'Hero' }] }))
      await expect(source.host.saveVersion({ expectedRevision: saved.snapshot.revision, draft: { ...source.draft, id: 'hero-v2' } })).rejects.toThrow('CONFLICT')
    }
    finally { await source.close() }
  })

  it('keeps native character author metadata and body while applying a reviewed profile', async () => {
    const source = await fixture()
    try {
      await writeFile(join(source.root, 'adv/settings/game.json'), JSON.stringify({ title: 'Native characters', characters: [] }))
      await mkdir(join(source.root, 'adv/characters'), { recursive: true })
      const path = join(source.root, 'adv/characters/hero.character.md')
      await writeFile(path, '---\nid: hero\nname: Hero\nauthorNote: keep this field\n---\n# Hero\n\n保留角色原稿。\n')
      const { preview, saved } = await source.ready()
      const registered = await source.host.registerSample({ previewId: preview.id, expectedRevision: saved.snapshot.revision })
      const selected = await source.host.selectSample({ voiceId: source.draft.id, locale: 'zh-CN', providerId: source.provider.id, assetId: registered.media!.asset.id, expectedRevision: registered.snapshot.revision })
      const applied = await source.host.applyProfile({ voiceId: source.draft.id, locale: 'zh-CN', providerId: source.provider.id, expectedRevision: selected.snapshot.revision })
      expect(applied.changes[0]!.path).toBe('adv/characters/hero.character.md')
      const updated = await readFile(path, 'utf8')
      expect(updated).toContain('authorNote: keep this field')
      expect(updated).toContain('# Hero\n\n保留角色原稿。')
      expect(applied.snapshot.speakers.find(speaker => speaker.id === 'hero')!.profile?.locales?.['zh-CN']?.providers['fixture-tts']?.projectVoiceId).toBe(source.draft.id)
    }
    finally { await source.close() }
  })

  it('requires actual clone reference bytes and consent before saving or executing a design', async () => {
    const source = await fixture()
    try {
      const reference = { id: 'reference/hero', type: 'audio', kind: 'reference', path: 'reference.wav', sha256: source.sha256, bytes: source.bytes.length, mimeType: 'audio/wav' }
      const catalogPath = join(source.root, 'adv/assets.json')
      const catalog = JSON.parse(await readFile(catalogPath, 'utf8'))
      catalog.assets.push(reference)
      await writeFile(catalogPath, JSON.stringify(catalog))
      await writeFile(join(source.root, 'public/media/reference.wav'), source.bytes)
      const rights = { license: 'consented-private', subject: 'Hero performer', consentRecord: 'authoring/rights/hero.json' }
      const draft = { ...source.draft, id: 'hero-clone-v1', locales: { 'zh-CN': { providers: { 'fixture-tts': { preset: 'fixture', source: 'cloned' as const, reference: { assetId: reference.id, sha256: reference.sha256, mode: 'embedding-only' as const }, rights } } } } }
      const revision = (await source.host.read()).revision
      await expect(source.host.saveVersion({ draft, expectedRevision: revision })).rejects.toThrow('CONSENT_REQUIRED')
      await mkdir(join(source.root, 'authoring/rights'), { recursive: true })
      await writeFile(join(source.root, rights.consentRecord), JSON.stringify({ approved: true }))
      const saved = await source.host.saveVersion({ draft, expectedRevision: revision })
      const plan = { voiceId: draft.id, providerId: source.provider.id, locale: 'zh-CN', text: '授权试听', expectedRevision: saved.snapshot.revision, budget: { maxCharacters: 100, allowUnknownCost: true } }
      const reviewed = await source.host.planPreview(plan)
      await rm(join(source.root, rights.consentRecord))
      const queued = await source.host.executePreview({ reviewId: reviewed.id, reviewHash: reviewed.reviewHash })
      expect(await settled(source.host, queued.id)).toMatchObject({ status: 'failed', error: 'VOICE_DESIGN_CONSENT_REQUIRED' })
      expect(source.calls).toHaveLength(0)
    }
    finally { await source.close() }
  })

  it.each(['other', ''])('rejects an explicitly incompatible reference character %j before synthesis', async (characterId) => {
    const source = await fixture()
    try {
      const reference = { id: 'reference/imported', type: 'audio', kind: 'reference', path: 'reference.wav', sha256: source.sha256, bytes: source.bytes.length, mimeType: 'audio/wav', characterId }
      const catalogPath = join(source.root, 'adv/assets.json')
      const catalog = JSON.parse(await readFile(catalogPath, 'utf8'))
      catalog.assets.push(reference)
      await writeFile(catalogPath, JSON.stringify(catalog))
      await writeFile(join(source.root, 'public/media/reference.wav'), source.bytes)
      const rights = { license: 'consented-private', subject: 'Hero performer', consentRecord: 'authoring/rights/hero.json' }
      await mkdir(join(source.root, 'authoring/rights'), { recursive: true })
      await writeFile(join(source.root, rights.consentRecord), JSON.stringify({ approved: true }))
      const draft = { ...source.draft, id: 'hero-clone-v1', locales: { 'zh-CN': { providers: { 'fixture-tts': { preset: 'fixture', source: 'cloned' as const, reference: { assetId: reference.id, sha256: reference.sha256, mode: 'embedding-only' as const }, rights } } } } }
      await expect(source.host.saveVersion({ draft, expectedRevision: (await source.host.read()).revision })).rejects.toThrow('VOICE_DESIGN_REFERENCE_INVALID')
      expect(source.calls).toHaveLength(0)
    }
    finally { await source.close() }
  })

  it('shares one local provider execution permit across design previews and ordinary dialogue jobs', async () => {
    const source = await fixture()
    const jobs = await createEditorVoiceJobsHost({ projectRoot: source.root, config: source.config, storeDirectory: join(source.storeDirectory, 'jobs') })
    let release!: () => void
    let called!: () => void
    const entered = new Promise<void>(resolve => called = resolve)
    const blocked = new Promise<void>(resolve => release = resolve)
    try {
      source.setBeforeSynthesis(async () => {
        called()
        await blocked
      })
      const saved = await source.host.saveVersion({ draft: source.draft, expectedRevision: (await source.host.read()).revision })
      const plan = await source.host.planPreview({ voiceId: source.draft.id, providerId: source.provider.id, locale: 'zh-CN', text: '音色占用本地主机', expectedRevision: saved.snapshot.revision, budget: { maxCharacters: 100, allowUnknownCost: true } })
      const queued = await source.host.executePreview({ reviewId: plan.id, reviewHash: plan.reviewHash })
      await entered
      const job = await jobs.plan({ lineIds: [editorJobLineIds[0]!], locale: 'zh-CN', providerId: source.provider.id, budget: { maxCharacters: 100, allowUnknownCost: true, concurrency: 1 } })
      await jobs.enqueue({ planId: job.plan.id, planHash: job.planHash })
      await jobs.command({ jobId: job.plan.id, action: 'run' })
      await new Promise(resolve => setTimeout(resolve, 25))
      expect(source.calls).toHaveLength(1)
      release()
      expect((await settled(source.host, queued.id)).status).toBe('ready')
      for (let count = 0; count < 100; count++) {
        if ((await jobs.read()).jobs[0]?.tasks[0]?.status === 'committed')
          break
        await new Promise(resolve => setTimeout(resolve, 10))
      }
      expect((await jobs.read()).jobs[0]!.tasks[0]!.status).toBe('committed')
      expect(source.calls).toHaveLength(2)
    }
    finally {
      release()
      await jobs.close()
      await source.close()
    }
  })
})
