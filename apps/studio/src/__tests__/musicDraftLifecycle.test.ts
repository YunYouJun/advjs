import type { VoiceAuthoringSnapshot } from '@advjs/types'
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { shallowRef } from 'vue'
import { createI18n } from 'vue-i18n'
import AudioWorkspace from '../components/audio/AudioWorkspace.vue'
import zh from '../i18n/locales/zh-CN.json'

const asset = { id: 'audio_019d137e-7abc-7000-8000-00000000e001', type: 'audio' as const, kind: 'bgm', path: 'original.wav', sha256: 'a'.repeat(64), license: 'original', title: 'Original music', music: { schemaVersion: 1 as const, usage: 'theme' as const, source: { type: 'manual' as const }, brief: { summary: 'Original brief' }, rights: { license: 'original' }, review: { status: 'pending' as const } } }
const snapshot: VoiceAuthoringSnapshot = { revision: 'voice', ledger: { schemaVersion: 1, lines: {} }, catalog: { schemaVersion: 2, id: 'native', defaultProfile: 'local', profiles: { local: { provider: 'project' } }, assets: [asset] } }
const state = { snapshot: shallowRef(snapshot), scopeKey: shallowRef('account/project/fs'), revision: shallowRef('draft-A'), reviewContext: shallowRef({}), nativeProjectId: shallowRef('native'), mixer: shallowRef({ schemaVersion: 1 }), loading: shallowRef(false), busy: shallowRef(false), error: shallowRef(''), missingCatalog: shallowRef(false), previewUrl: shallowRef(''), previewAssetId: shallowRef(''), reload: vi.fn(), preview: vi.fn(), stopPreview: vi.fn(), importAsset: vi.fn(), updateAsset: vi.fn(), removeAsset: vi.fn(), reviewMusic: vi.fn(), select: vi.fn(), verifyRetained: vi.fn(), saveMixer: vi.fn(), initialize: vi.fn() }
vi.mock('../composables/useAudioWorkspace', () => ({ useAudioWorkspace: () => state }))
vi.mock('../composables/useManagedVoiceSession', () => ({ useManagedVoiceSession: () => ({ configured: shallowRef(false), client: shallowRef() }) }))

describe('studio music draft lifecycle', () => {
  it('retains both a handoff and an editing draft after same-project refresh, saving with the original revision', async () => {
    const wrapper = mount(AudioWorkspace, { props: { active: true }, global: { plugins: [createI18n({ legacy: false, locale: 'zh-CN', messages: { 'zh-CN': zh } })], stubs: { AudioLocalConnection: true, AudioPublication: true, AudioVoiceReview: true, AudioMixerPanel: true } } })
    const brief = wrapper.get('[data-testid=music-brief]')
    await brief.get('textarea').setValue('Unsaved handoff intent')
    await wrapper.findAll('button').find(button => button.text() === zh.audioWorkspace.editMetadata)!.trigger('click')
    const form = wrapper.get('.audio-asset-form')
    await form.get('textarea').setValue('Unsaved asset edit')
    state.revision.value = 'external-B'
    state.snapshot.value = { ...snapshot, catalog: { ...snapshot.catalog, assets: [{ ...asset, title: 'Externally changed' }] } }
    await wrapper.vm.$nextTick()
    expect(wrapper.get('[data-testid=music-brief]').get<HTMLTextAreaElement>('textarea').element.value).toBe('Unsaved handoff intent')
    expect(wrapper.get('.audio-asset-form').get<HTMLTextAreaElement>('textarea').element.value).toBe('Unsaved asset edit')
    await form.trigger('submit')
    expect(state.updateAsset).toHaveBeenCalledWith(asset.id, expect.objectContaining({ music: expect.objectContaining({ brief: expect.objectContaining({ summary: 'Unsaved asset edit' }) }) }), 'draft-A')
    await flushPromises()
    expect(wrapper.find('.audio-asset-form').exists()).toBe(true)
    state.updateAsset.mockResolvedValueOnce(true)
    await form.trigger('submit')
    await flushPromises()
    expect(wrapper.find('.audio-asset-form').exists()).toBe(false)
    expect(wrapper.get('[data-testid=music-brief]').get<HTMLTextAreaElement>('textarea').element.value).toBe('Unsaved handoff intent')
    state.scopeKey.value = 'different-account/project/fs'
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.audio-asset-form').exists()).toBe(false)
    expect(wrapper.get('[data-testid=music-brief]').get<HTMLTextAreaElement>('textarea').element.value).toBe('')
    wrapper.unmount()
  })
})
