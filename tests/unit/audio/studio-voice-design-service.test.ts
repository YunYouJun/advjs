import type { VoiceDesignMutation, VoiceDesignPreview, VoiceDesignPreviewReview, VoiceDesignSnapshot } from '@advjs/types'
import type { HostedVoiceSyncState } from '../../../packages/advjs/shared/hosted-audio'
import { createHash } from 'node:crypto'
import { readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createStudioVoiceService } from '../../../packages/advjs/node/audio/server'
import { createVoiceDesignFixture } from '../../fixtures/audio/voice-design'

describe('authenticated Studio voice design HTTP', () => {
  it('synchronizes finite native authoring bytes, keeps exact sample identity, and rejects untrusted model overrides', async () => {
    const fixture = await createVoiceDesignFixture()
    const service = await createStudioVoiceService({ host: '127.0.0.1', port: 0, stateDirectory: fixture.storeDirectory, allowedOrigins: ['http://localhost:3388'], authenticate: async token => token === 'trusted-session' ? { accountId: 'account-one' } : token === 'other-session' ? { accountId: 'other' } : undefined, projects: [{ accountId: 'account-one', projectId: 'project-one', root: fixture.root, config: fixture.config }] })
    try {
      const base = `${(await service.start()).url}/v1/audio/projects/project-one`
      async function request(path: string, method = 'GET', body?: unknown, token = 'trusted-session') {
        return await fetch(`${base}${path}`, { method, headers: { origin: 'http://localhost:3388', authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'content-type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
      }
      async function ok<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
        const response = await request(path, method, body)
        const result = await response.json()
        expect(response.status, JSON.stringify(result)).toBe(200)
        return result
      }
      expect((await request('/voice-design', 'GET', undefined, 'other-session')).status).toBe(403)
      expect((await request('/voice-design', 'GET', undefined, 'invalid')).status).toBe(401)
      await ok<VoiceDesignSnapshot>('/voice-design')
      const configSource = JSON.parse(await readFile(join(fixture.root, 'adv.config.json'), 'utf8'))
      await writeFile(join(fixture.root, 'adv.config.json'), JSON.stringify({ ...configSource, schemaVersion: 1, entryChapterId: 'intro' }))
      const saved = await ok<VoiceDesignMutation>('/voice-design/save', 'POST', { expectedRevision: (await ok<VoiceDesignSnapshot>('/voice-design')).revision, draft: fixture.draft })
      expect(fixture.calls).toHaveLength(0)
      const input = { voiceId: fixture.draft.id, locale: 'zh-CN', providerId: fixture.provider.id, text: '真实 HTTP 试听', expectedRevision: saved.snapshot.revision, budget: { maxCharacters: 100, allowUnknownCost: true } }
      const review = await ok<VoiceDesignPreviewReview>('/voice-design/plan', 'POST', input)
      const preview = await ok<VoiceDesignPreview>('/voice-design/execute', 'POST', { reviewId: review.id, reviewHash: review.reviewHash })
      for (let count = 0; count < 100; count++) {
        const current = await ok<VoiceDesignPreview>(`/voice-design/previews/${preview.id}`)
        if (current.status === 'ready')
          break
        await new Promise(resolve => setTimeout(resolve, 10))
      }
      const media = await request(`/voice-design/previews/${preview.id}/media`)
      expect(media.status).toBe(200)
      expect(createHash('sha256').update(new Uint8Array(await media.arrayBuffer())).digest('hex')).toBe(fixture.sha256)
      expect((await request(`/voice-design/previews/${preview.id}/media`, 'GET', undefined, 'other-session')).status).toBe(403)
      const registered = await ok<VoiceDesignMutation>('/voice-design/register', 'POST', { previewId: preview.id, expectedRevision: saved.snapshot.revision })
      expect(registered.media!.candidate).not.toHaveProperty('path')
      expect(registered.snapshot.library.voices[0]!.design!.samples[0]!.assetId).toBe(registered.media!.asset.id)
      const selected = await ok<VoiceDesignMutation>('/voice-design/select', 'POST', { voiceId: fixture.draft.id, locale: 'zh-CN', providerId: fixture.provider.id, assetId: registered.media!.asset.id, expectedRevision: registered.snapshot.revision })
      await ok<VoiceDesignMutation>('/voice-design/apply', 'POST', { voiceId: fixture.draft.id, locale: 'zh-CN', providerId: fixture.provider.id, expectedRevision: selected.snapshot.revision, replaceBinding: true })
      const libraryPath = 'authoring/voices/library.json'
      const presetPath = saved.changes.find(change => change.path !== libraryPath)!.path
      const paths = ['adv.config.json', 'adv/settings/game.json', 'adv/chapters/intro.adv.md', 'adv/assets.json', 'adv/audio/voice-profiles.json', libraryPath, presetPath]
      const files = Object.fromEntries(await Promise.all(paths.map(async path => [path, await readFile(join(fixture.root, path), 'utf8')])))
      // The client sends exact source bytes. The service may merge paid history
      // and format canonical catalog data, so it returns exact local CAS patches.
      files['adv/assets.json'] = JSON.stringify(JSON.parse(files['adv/assets.json']!))
      const sync = await ok<HostedVoiceSyncState>('/sync')
      const synced = await ok<HostedVoiceSyncState>('/sync', 'POST', { expectedRevision: sync.revision, files })
      expect(synced.changes!.find(change => change.path === 'adv/assets.json')!.expected).toBe(files['adv/assets.json'])
      const repeated = await ok<VoiceDesignPreviewReview>('/voice-design/plan', 'POST', { ...input, expectedRevision: (await ok<VoiceDesignSnapshot>('/voice-design')).revision })
      expect((await ok<VoiceDesignPreview>('/voice-design/execute', 'POST', { reviewId: repeated.id, reviewHash: repeated.reviewHash })).id).toBe(preview.id)
      expect(fixture.calls).toHaveLength(1)
      const before = await ok<HostedVoiceSyncState>('/sync')
      const badLibrary = JSON.parse(files[libraryPath]!)
      const newVoice = structuredClone(badLibrary.voices[0])
      newVoice.id = 'malicious-new-version'
      newVoice.design.samples = []
      newVoice.design.selectedSamples = {}
      delete newVoice.selectedSample
      const badPath = `authoring/voices/designs/${newVoice.id}/1/zh-CN/fixture-tts.json`
      const badPreset = JSON.stringify({ ...JSON.parse(files[presetPath]!), model: '/private/operator/weights' })
      const badHash = createHash('sha256').update(badPreset).digest('hex')
      newVoice.implementations['fixture-tts'] = { preset: `design-${newVoice.id}-zh-CN`, character: 'hero', presetPath: badPath, presetSha256: badHash, localePresets: { 'zh-CN': { preset: `design-${newVoice.id}-zh-CN`, presetPath: badPath, presetSha256: badHash } } }
      badLibrary.voices.push(newVoice)
      const rejected = await request('/sync', 'POST', { expectedRevision: before.revision, files: { ...files, [libraryPath]: JSON.stringify(badLibrary), [badPath]: badPreset } })
      expect(await rejected.json()).toMatchObject({ error: { code: 'VOICE_DESIGN_PRESET_UNTRUSTED' } })
      expect((await ok<HostedVoiceSyncState>('/sync')).revision).toBe(before.revision)
      const attack = structuredClone(files)
      const game = JSON.parse(attack['adv/settings/game.json']!)
      game.authorConsent = { consentRecord: 'preset.json' }
      attack['adv/settings/game.json'] = JSON.stringify(game)
      attack['preset.json'] = JSON.stringify({ model: '/private/browser-selected-model', voiceId: 'system:soft' })
      const templateAttack = await request('/sync', 'POST', { expectedRevision: before.revision, files: attack })
      expect(await templateAttack.json()).toMatchObject({ error: { code: 'VOICE_DESIGN_TEMPLATE_IMMUTABLE' } })
      expect(JSON.parse(await readFile(join(fixture.root, 'preset.json'), 'utf8')).model).toBe('fixture-model')
      expect((await ok<HostedVoiceSyncState>('/sync')).revision).toBe(before.revision)
      expect(fixture.calls).toHaveLength(1)
      expect(JSON.stringify(await ok('/voice-design'))).not.toContain(fixture.root)
      // Host template upgrades apply to new versions; they never rewrite or
      // invalidate previously approved immutable presets and sample history.
      await writeFile(join(fixture.root, 'preset.json'), JSON.stringify({ model: 'fixture-model-v2', voiceId: 'system:fixture', revision: 'a'.repeat(40) }))
      const upgradedSync = await ok<HostedVoiceSyncState>('/sync')
      await ok('/sync', 'POST', { expectedRevision: upgradedSync.revision, files })
      const old = await ok<VoiceDesignSnapshot>('/voice-design')
      expect(old.library.voices[0]!.design!.samples[0]!.model).toBe('fixture-model')
      expect(await readFile(join(fixture.root, presetPath), 'utf8')).toBe(files[presetPath])
      const newVersion = await ok<VoiceDesignMutation>('/voice-design/save', 'POST', { expectedRevision: old.revision, draft: { ...fixture.draft, id: 'hero-soft-v2', version: '2', supersedes: { id: fixture.draft.id, version: '1' } } })
      const newestPreset = newVersion.changes.find(change => change.path !== libraryPath)!
      expect(JSON.parse(newestPreset.content!).model).toBe('fixture-model-v2')
      const currentSync = await ok<HostedVoiceSyncState>('/sync')
      const rewrittenHistorical = await request('/sync', 'POST', { expectedRevision: currentSync.revision, files: { ...files, [presetPath]: `${files[presetPath]} ` } })
      expect(await rewrittenHistorical.json()).toMatchObject({ error: { code: 'VOICE_DESIGN_PRESET_UNTRUSTED' } })
      expect((await ok<VoiceDesignSnapshot>('/voice-design')).library.voices).toHaveLength(2)
    }
    finally {
      await service.stop()
      await rm(fixture.directory, { recursive: true, force: true })
    }
  })
})
