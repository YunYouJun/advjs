import type { AdvAssetEntry, DesignedVoiceProfile, VoiceDesignMutation, VoiceDesignSnapshot } from '@advjs/types'
import { Blob as NodeBlob } from 'node:buffer'
import { createHash } from 'node:crypto'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'
import VoiceDesignCandidates from '../components/audio/VoiceDesignCandidates.vue'
import VoiceDesignForm from '../components/audio/VoiceDesignForm.vue'
import zh from '../i18n/locales/zh-CN.json'
import { createManagedVoiceClient, selectHostedVoiceFiles } from '../utils/managedVoiceClient'
import { applyStudioVoiceDesignMutation, createStudioVoiceDesignPort } from '../utils/voiceDesigner'

afterEach(() => vi.unstubAllGlobals())
function snapshot(): VoiceDesignSnapshot {
  return { configured: true, revision: 'a'.repeat(64), library: { schemaVersion: 1, voices: [] }, providers: [{ id: 'configured-only', backend: 'local', sources: ['system'], builtInVoices: [{ id: 'supplier-soft', label: 'Soft' }], presets: [{ id: 'trusted', model: 'model', sources: ['system'] }] }], speakers: [{ id: 'narrator', name: 'Project narrator' }], referenceAssets: [], previews: [] }
}
const i18n = () => createI18n({ legacy: false, locale: 'zh-CN', messages: { 'zh-CN': zh } })
describe('studio finite voice designer', () => {
  it('imports a verified sample with normalized native optional fields and preserves later metadata on replay', async () => {
    vi.stubGlobal('Blob', NodeBlob)
    const bytes = new Uint8Array([1, 2, 3])
    const sha256 = createHash('sha256').update(bytes).digest('hex')
    const asset: AdvAssetEntry = { id: 'audio_019d137e-7abc-7000-8000-000000000001', type: 'audio', kind: 'voice', path: 'voice/samples/original.wav', sha256, bytes: bytes.length, state: 'candidate', title: 'Original', mimeType: 'audio/wav', duration: 1, characterId: 'narrator' }
    const voice: DesignedVoiceProfile = { id: 'sampled', version: '1', characterId: 'narrator', label: 'Sampled', implementations: {}, design: { schemaVersion: 1, intent: {}, locales: { en: { providers: { native: { preset: 'trusted', source: 'system', providerVoiceId: 'soft' } } } }, samples: [], selectedSamples: {} } }
    const libraryBefore = JSON.stringify({ schemaVersion: 1, voices: [voice] })
    const catalogBefore = JSON.stringify({ schemaVersion: 2, id: 'native', defaultProfile: 'local', profiles: { local: { provider: 'project', root: 'public/media' } }, assets: [] })
    const imported = structuredClone(voice)
    imported.design.samples.push({ assetId: asset.id, sha256, bytes: bytes.length, locale: 'en', providerId: 'native', providerVoiceId: 'soft', model: 'model', source: 'system', text: 'Sample', presetSha256: 'a'.repeat(64), createdAt: '2026-10-11T00:00:00Z' })
    const source = snapshot()
    source.library.voices = [imported]
    const catalogAfter = JSON.stringify({ ...JSON.parse(catalogBefore), assets: [asset] })
    const mutation: VoiceDesignMutation = { snapshot: source, changes: [{ path: 'authoring/voices/library.json', expected: libraryBefore, content: JSON.stringify(source.library) }, { path: 'adv/assets.json', expected: catalogBefore, content: catalogAfter }], media: { asset, candidate: { id: 'candidate', provider: 'native', characterId: 'narrator', text: 'Sample', sha256, bytes: bytes.length, mimeType: 'audio/wav', durationSeconds: 1, sampleRate: 24000 }, mediaUrl: '/finite/media' } }
    const documents = new Map([['adv.config.json', JSON.stringify({ format: 'flow', root: 'adv' })], ['adv/chapters/intro.chapter.json', JSON.stringify({ schemaVersion: 1, id: 'intro', title: 'Intro', nodes: [{ id: 'end', type: 'end' }] })], ['adv/assets.json', catalogBefore], ['authoring/voices/library.json', libraryBefore]])
    const media = new Map<string, Blob>()
    const fs = {
      collectAllFiles: async () => [...documents].map(([path, content]) => ({ path, content })),
      exists: async (path: string) => documents.has(path) || media.has(path),
      readFile: async (path: string) => documents.get(path)!,
      writeFile: async (path: string, content: string) => {
        documents.set(path, content)
      },
      deleteFile: async (path: string) => {
        documents.delete(path)
        media.delete(path)
      },
      readBlob: async (path: string) => media.get(path)!,
      writeBlob: async (path: string, blob: Blob) => {
        media.set(path, blob)
      },
    } as unknown as import('../utils/fs').IFileSystem
    const client = { assertCurrent: () => {}, media: vi.fn(async () => bytes.buffer) } as unknown as ReturnType<typeof createManagedVoiceClient>
    await applyStudioVoiceDesignMutation(fs, client, mutation)
    expect(media.get('public/media/voice/samples/original.wav')?.size).toBe(3)
    documents.set('adv/assets.json', JSON.stringify({ ...JSON.parse(catalogAfter), assets: [{ ...asset, title: 'Reviewed later' }] }))
    await applyStudioVoiceDesignMutation(fs, client, mutation)
    expect(JSON.parse(documents.get('adv/assets.json')!).assets[0].title).toBe('Reviewed later')
    expect(client.media).toHaveBeenCalledOnce()
    media.set('public/media/voice/samples/original.wav', new Blob([new Uint8Array([9, 9, 9])]))
    await expect(applyStudioVoiceDesignMutation(fs, client, mutation)).rejects.toThrow('VOICE_AUDIO_CHANGED')
  })
  it('shows only advertised sources, saves the actual supplier identity and never guesses a provider/model', async () => {
    const source = snapshot()
    const wrapper = mount(VoiceDesignForm, { props: { snapshot: source, speakerId: 'narrator', busy: false }, global: { plugins: [i18n()] } })
    const selects = wrapper.find('fieldset').findAll('select')
    expect(selects[0]!.findAll('option').map(option => option.element.value)).toEqual(['', 'configured-only'])
    await selects[0]!.setValue('configured-only')
    await selects[1]!.setValue('trusted')
    expect(selects[2]!.findAll('option').map(option => option.element.value)).toEqual(['', 'system'])
    await selects[2]!.setValue('system')
    await wrapper.find('fieldset').findAll('select').at(-1)!.setValue('supplier-soft')
    await wrapper.findAll('button').find(button => button.text() === '将此定义加入草稿')!.trigger('click')
    await wrapper.findAll('button').find(button => button.text() === '保存不可变版本')!.trigger('click')
    expect(wrapper.emitted('save')![0]![0]).toMatchObject({ characterId: 'narrator', locales: { 'zh-CN': { providers: { 'configured-only': { preset: 'trusted', source: 'system', providerVoiceId: 'supplier-soft' } } } } })
    expect(source.library.voices).toEqual([])
    wrapper.unmount()
  })
  it('keeps unknown candidates blocked and requires independent registration, sample selection and Profile application', async () => {
    const sample = { assetId: 'audio_019d137e-7abc-7000-8000-000000000001', sha256: 'a'.repeat(64), bytes: 50, locale: 'en', providerId: 'configured-only', providerVoiceId: 'supplier-soft', model: 'model', source: 'system' as const, text: 'Sample', presetSha256: 'b'.repeat(64), createdAt: '2026-10-11T00:00:00Z' }
    const voice: DesignedVoiceProfile = { id: 'narrator-soft', version: '1', characterId: 'narrator', label: 'Soft', implementations: {}, design: { schemaVersion: 1, intent: {}, locales: { en: { providers: { 'configured-only': { preset: 'trusted', source: 'system', providerVoiceId: 'supplier-soft' } } } }, samples: [sample], selectedSamples: {} } }
    const wrapper = mount(VoiceDesignCandidates, { props: { voice, previews: [{ id: 'unknown', voiceId: voice.id, providerId: sample.providerId, locale: 'en', status: 'unknown' }], busy: false }, global: { plugins: [i18n()] } })
    expect(wrapper.emitted()).toEqual({})
    expect(wrapper.text()).toContain('不会自动重试生成')
    expect(wrapper.find('[data-preview-id="unknown"]').findAll('button')).toHaveLength(0)
    const apply = wrapper.findAll('button').find(button => button.text() === '将所选样本应用到 Profile')!
    expect(apply.attributes('disabled')).toBeDefined()
    await wrapper.findAll('button').find(button => button.text() === '选择已审核样本')!.trigger('click')
    expect(wrapper.emitted('select')![0]![0]).toMatchObject({ voiceId: voice.id, assetId: sample.assetId, replaceSelected: false })
    expect(wrapper.emitted('apply')).toBeUndefined()
    wrapper.unmount()
  })
  it('downloads only authenticated preview media and verifies bytes before creating an unbound audition Blob', async () => {
    const bytes = new Uint8Array([1, 2, 3])
    const sha256 = createHash('sha256').update(bytes).digest('hex')
    const preview = { id: 'preview', voiceId: 'voice', providerId: 'configured-only', locale: 'en', status: 'ready', mediaUrl: '/v1/audio/projects/project/voice-design/previews/preview/media', candidate: { id: 'candidate', characterId: 'narrator', text: 'Sample', provider: 'configured-only', mimeType: 'audio/wav', bytes: 3, sha256, durationSeconds: 1, sampleRate: 24000 } }
    const fetch = vi.fn(async (url: string | URL | Request) => String(url).endsWith('/media') ? new Response(bytes) : new Response(JSON.stringify(preview)))
    const client = createManagedVoiceClient({ accountId: 'account', projectId: 'project', baseUrl: 'http://127.0.0.1:3389', getAccessToken: async () => 'token', assertCurrent: () => {}, fetch })
    const port = createStudioVoiceDesignPort(client)
    expect((await port.readPreviewAudio('preview')).size).toBe(3)
    expect(fetch.mock.calls.map(([url]) => String(url))).toEqual(['http://127.0.0.1:3389/v1/audio/projects/project/voice-design/previews/preview', 'http://127.0.0.1:3389/v1/audio/projects/project/voice-design/previews/preview/media'])
    preview.candidate.sha256 = 'f'.repeat(64)
    await expect(port.readPreviewAudio('preview')).rejects.toThrow('VOICE_AUDIO_CHANGED')
    expect(fetch.mock.calls.some(([url]) => String(url).includes('/register'))).toBe(false)
  })
  it('syncs unapplied design versions, selected samples, preset proofs and referenced consent without exporting executable/private records', () => {
    const voice: DesignedVoiceProfile = { id: 'cloned-v1', version: '1', characterId: 'narrator', label: 'Authorized', implementations: {}, design: { schemaVersion: 1, intent: {}, locales: { en: { providers: { native: { preset: 'trusted', source: 'cloned', reference: { assetId: 'reference/voice', sha256: 'a'.repeat(64), mode: 'embedding-only' }, rights: { license: 'Permission', subject: 'Speaker', consentRecord: 'rights/voice.json' } } } } }, samples: [], selectedSamples: {} } }
    const files = { 'adv.config.json': '{}', 'adv/assets.json': '{}', 'authoring/voices/library.json': JSON.stringify({ schemaVersion: 1, voices: [voice] }), 'authoring/voices/designs/cloned-v1/1/en/native.json': '{}', 'rights/voice.json': '{}', 'authoring/voices/designs/code.ts': 'code', 'private/voice-design.json': 'private' }
    const selected = selectHostedVoiceFiles(files, { profiles: {}, lines: [], chapters: [], unidentifiedLines: 0 }, { ledger: { schemaVersion: 1, lines: {} }, catalog: {} as never, revision: '' })
    expect(Object.keys(selected).sort()).toEqual(['adv.config.json', 'adv/assets.json', 'authoring/voices/designs/cloned-v1/1/en/native.json', 'authoring/voices/library.json', 'rights/voice.json'])
  })
})
