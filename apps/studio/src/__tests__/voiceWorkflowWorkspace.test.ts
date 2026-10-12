import type { VoiceDesignSnapshot } from '@advjs/types'
import type { useVoiceDesigner } from '../composables/useVoiceDesigner'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, shallowRef } from 'vue'
import { createI18n } from 'vue-i18n'
import VoiceDesignForm from '../components/audio/VoiceDesignForm.vue'
import VoiceDesignWorkspace from '../components/audio/VoiceDesignWorkspace.vue'
import zh from '../i18n/locales/zh-CN.json'

let state: ReturnType<typeof useVoiceDesigner>
vi.mock('../composables/useVoiceDesigner', () => ({ useVoiceDesigner: () => state }))
const source = (): VoiceDesignSnapshot => ({ configured: true, revision: 'a'.repeat(64), library: { schemaVersion: 1, voices: [] }, speakers: [{ id: 'hero', name: 'Hero' }, { id: 'other', name: 'Other' }, { id: 'narrator', name: 'Narrator' }], providers: [], referenceAssets: [], previews: [] })
beforeEach(() => {
  state = { session: { client: shallowRef({}) }, snapshot: shallowRef(source()), review: shallowRef(), busy: shallowRef(false), error: shallowRef(''), available: computed(() => true), previewUrl: shallowRef(''), previewId: shallowRef(''), stopAudio: vi.fn(), reload: vi.fn(), refresh: vi.fn(), save: vi.fn(), plan: vi.fn(), execute: vi.fn(), cancel: vi.fn(), audition: vi.fn(), auditionSample: vi.fn(), register: vi.fn(), select: vi.fn(), apply: vi.fn() } as unknown as ReturnType<typeof useVoiceDesigner>
})
function render() {
  return mount(VoiceDesignWorkspace, { props: { active: true, initialSpeakerId: 'hero' }, global: { plugins: [createI18n({ legacy: false, locale: 'zh-CN', messages: { 'zh-CN': zh } })], stubs: { VoiceDesignPreviewRequest: true, VoiceDesignCandidates: true } } })
}
describe('studio contextual voice design workflow', () => {
  it('preserves an unsaved draft for requested and manual speaker changes until explicit discard', async () => {
    const wrapper = render()
    const input = wrapper.get('[data-testid=voice-design-form]').findAll('input')[2]!
    await input.setValue('Unsaved Hero label')
    await wrapper.setProps({ initialSpeakerId: 'other' })
    expect(input.element.value).toBe('Unsaved Hero label')
    expect(wrapper.get<HTMLSelectElement>('.voice-design-fields select').element.value).toBe('hero')
    expect(wrapper.text()).toContain('保存后切换到 other')
    await wrapper.get<HTMLSelectElement>('.voice-design-fields select').setValue('narrator')
    expect(input.element.value).toBe('Unsaved Hero label')
    expect(wrapper.get<HTMLSelectElement>('.voice-design-fields select').element.value).toBe('hero')
    await wrapper.findAll('button').find(button => button.text() === '放弃草稿并切换角色')!.trigger('click')
    expect(wrapper.get<HTMLSelectElement>('.voice-design-fields select').element.value).toBe('narrator')
    expect(wrapper.get('[data-testid=voice-design-form]').findAll('input')[2]!.element.value).toBe('Narrator')
    expect(state.save).not.toHaveBeenCalled()
    wrapper.unmount()
  })
  it('tracks edits after a saved baseline instead of losing a subsequent draft on navigation', async () => {
    const wrapper = render()
    const form = wrapper.getComponent(VoiceDesignForm)
    await form.findAll('input')[2]!.setValue('Saved label')
    ;(form.vm as unknown as { acceptSavedDraft: () => void }).acceptSavedDraft()
    await wrapper.vm.$nextTick()
    await form.findAll('input')[2]!.setValue('Second unsaved edit')
    await wrapper.setProps({ initialSpeakerId: 'other' })
    expect(wrapper.get<HTMLSelectElement>('.voice-design-fields select').element.value).toBe('hero')
    expect(form.findAll('input')[2]!.element.value).toBe('Second unsaved edit')
    wrapper.unmount()
  })
  it('keeps busy context stable and presents legacy samples without claiming profile application', async () => {
    state.snapshot.value!.library.voices.push({ id: 'legacy', version: '1', characterId: 'hero', label: 'Legacy short sample', implementations: {}, selectedSample: { assetId: 'old', sha256: 'b'.repeat(64) } })
    const wrapper = render()
    expect(wrapper.text()).toContain('Legacy short sample')
    expect(wrapper.text()).toContain('请创建并显式应用版本化音色设计后继续')
    expect(wrapper.findAll('button').some(button => button.text() === '生成这个角色的对白')).toBe(false)
    state.busy.value = true
    await wrapper.setProps({ initialSpeakerId: 'other' })
    expect(wrapper.get<HTMLSelectElement>('.voice-design-fields select').element.value).toBe('hero')
    expect(wrapper.get<HTMLSelectElement>('.voice-design-fields select').attributes('disabled')).toBeDefined()
    state.busy.value = false
    await wrapper.vm.$nextTick()
    expect(wrapper.get<HTMLSelectElement>('.voice-design-fields select').element.value).toBe('other')
    wrapper.unmount()
  })
})
