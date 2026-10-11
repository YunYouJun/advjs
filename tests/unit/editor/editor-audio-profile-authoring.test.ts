import type { AudioPronunciationDictionary, AudioVoiceProfiles, CharacterVoiceProfile } from '@advjs/types'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import CharacterVoiceProfileEditor from '../../../editor/core/app/components/character/CharacterVoiceProfileEditor.vue'
import AEAudioPronunciationPanel from '../../../editor/core/app/components/panel/audio/AEAudioPronunciationPanel.vue'
import AEAudioVoiceProfilesPanel from '../../../editor/core/app/components/panel/audio/AEAudioVoiceProfilesPanel.vue'
import AGUISelect from '../../../packages/gui/client/components/select/AGUISelect.vue'

const state = vi.hoisted(() => ({ project: {} as { workspace: unknown, project: { files: Record<string, string> } }, service: {} as Record<string, ReturnType<typeof vi.fn>>, registerDraft: vi.fn(), removeDraft: vi.fn() }))
vi.mock('../../../editor/core/app/stores/useAudioStore', () => ({ useAudioStore: () => ({ supportedRoot: true, authoring: () => state.service }) }))
vi.mock('../../../editor/core/app/stores/useProjectStore', () => ({ useProjectStore: () => state.project }))
vi.mock('../../../editor/core/app/stores/useProjectDrafts', () => ({ useProjectDrafts: () => ({ register: state.registerDraft, remove: state.removeDraft }) }))

const field = { props: ['modelValue', 'id'], emits: ['update:modelValue'], template: '<input :id="id" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)">' }
const select = { props: ['modelValue', 'id', 'options'], emits: ['update:modelValue'], template: '<select :id="id" :value="modelValue" @change="$emit(\'update:modelValue\', $event.target.value)"><option v-for="option in options" :value="option">{{ option }}</option></select>' }
const global = { stubs: { AGUIInput: field, AGUISelect: select, AGUIDetails: { template: '<section><slot /></section>' }, AGUIProperty: { template: '<div><slot /></div>' }, AGUIButton: { template: '<button><slot /></button>' } } }
const wrappers: Array<{ unmount: () => void }> = []
const originalScrollIntoView = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView')
beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
  state.project = reactive({ workspace: { writeFiles: vi.fn() }, project: { files: {} } })
  state.service = {
    readPronunciation: vi.fn(async () => ({ dictionary: { schemaVersion: 1, revision: 0, replacements: {}, locales: {} }, revision: 'reviewed-dictionary' })),
    savePronunciation: vi.fn(async (input: { dictionary: AudioPronunciationDictionary }) => {
      const dictionary = { ...input.dictionary, revision: input.dictionary.revision + 1 }
      state.project.project.files['adv/audio/pronunciation.json'] = JSON.stringify(dictionary)
      return { dictionary, revision: 'saved-dictionary' }
    }),
    readVoiceProfiles: vi.fn(async () => ({ profiles: { schemaVersion: 1, revision: 0 }, revision: 'reviewed-profiles' })),
    saveVoiceProfiles: vi.fn(async (input: { profiles: AudioVoiceProfiles }) => {
      const profiles = { ...input.profiles, revision: input.profiles.revision + 1 }
      state.project.project.files['adv/audio/voice-profiles.json'] = JSON.stringify(profiles)
      return { profiles, revision: 'saved-profiles' }
    }),
  }
})
afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount())
  if (originalScrollIntoView)
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', originalScrollIntoView)
  else delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView
  document.body.innerHTML = ''
  vi.clearAllMocks()
})

describe('editor character and project voice authoring', () => {
  it('mounts real AGUI and Reka selects for unspecified narrator intent and clearing pitch does not persist the UI sentinel', async () => {
    const update = vi.fn()
    const { AGUISelect: _stub, ...stubs } = global.stubs
    const wrapper = mount(CharacterVoiceProfileEditor, { attachTo: document.body, global: { components: { AGUISelect }, stubs }, props: { 'idPrefix': 'actual-select', 'modelValue': { intent: {} }, 'onUpdate:modelValue': update } })
    wrappers.push(wrapper)
    await flushPromises()
    const selects = wrapper.findAllComponents(AGUISelect)
    expect(selects).toHaveLength(2)
    expect(wrapper.findAll('[role="combobox"]').map(select => select.text())).toEqual(['未指定', '未指定'])
    selects[0]!.vm.$emit('update:modelValue', 'high')
    expect(update).toHaveBeenLastCalledWith({ intent: { pitch: 'high' } })
    await wrapper.setProps({ modelValue: { intent: { pitch: 'high' } } })
    selects[0]!.vm.$emit('update:modelValue', 'unspecified')
    expect(update).toHaveBeenLastCalledWith({ intent: {} })
    await wrapper.get('[role="combobox"][aria-label="音高"]').trigger('keydown', { key: 'ArrowDown' })
    await flushPromises()
    expect(document.body.textContent).toContain('未指定')
    expect(document.querySelector('[role="option"]')).not.toBeNull()
  })

  it('emits immutable provider/model edits while retaining another locale and actor intent', async () => {
    const profile: CharacterVoiceProfile = { intent: { speakingStyle: 'Quiet' }, locales: { 'zh-CN': { providers: { 'openai-tts': { voiceId: 'coral', model: 'gpt-4o-mini-tts', source: 'system' } } }, 'ja-JP': { providers: { 'qwen-tts': { voiceId: 'design:identity', model: 'pinned/model', source: 'designed' } } } } }
    const original = JSON.stringify(profile)
    const update = vi.fn()
    const wrapper = mount(CharacterVoiceProfileEditor, { global, props: { 'modelValue': profile, 'idPrefix': 'test', 'onUpdate:modelValue': update } })
    wrappers.push(wrapper)
    await wrapper.get('#test-voice-id-0').setValue('echo')
    expect(update).toHaveBeenLastCalledWith(expect.objectContaining({ locales: expect.objectContaining({ 'zh-CN': { providers: { 'openai-tts': { voiceId: 'echo', model: 'gpt-4o-mini-tts', source: 'system' } } }, 'ja-JP': profile.locales!['ja-JP'] }) }))
    expect(JSON.stringify(profile)).toBe(original)
    await wrapper.get('[data-testid="character-voice-clear"]').trigger('click')
    expect(update).toHaveBeenLastCalledWith(undefined)
    expect(wrapper.findAll('[data-testid="character-voice-binding"]')).toHaveLength(2)
  })

  it('uses supplied capabilities as author choices and preserves an unavailable existing binding with a diagnostic', () => {
    const wrapper = mount(CharacterVoiceProfileEditor, { global, props: { idPrefix: 'capabilities', modelValue: { intent: {}, locales: { 'zh-CN': { providers: { 'missing-tts': { voiceId: 'retained', source: 'system' } } } } }, providers: [{ id: 'openai-tts', capabilities: { backend: 'cloud', synthesis: true, voiceCreation: false, offline: false, models: [{ id: 'tts-1', modes: ['built-in'], formats: ['audio/wav'], streaming: false }] } }] } })
    wrappers.push(wrapper)
    expect(wrapper.text()).toContain('当前宿主没有此供应商')
    expect(wrapper.get('#capabilities-voice-provider-0').findAll('option').map(option => option.text())).toEqual(['openai-tts', 'missing-tts'])
    expect(wrapper.text()).not.toContain('apiKey')
  })

  it('saves global and exact-locale dictionaries with the reviewed CAS revision and disables invalid replacements', async () => {
    const wrapper = mount(AEAudioPronunciationPanel)
    wrappers.push(wrapper)
    await flushPromises()
    const fields = wrapper.findAll('textarea')
    await fields[0]!.setValue('{"ADV.JS":"冒险引擎"}')
    await fields[1]!.setValue('{"zh-CN":{"replacements":{"ADV.JS":"中文引擎"}}}')
    await wrapper.get('[data-testid="pronunciation-save"]').trigger('click')
    await flushPromises()
    expect(state.service.savePronunciation).toHaveBeenCalledWith({ expectedRevision: 'reviewed-dictionary', dictionary: { schemaVersion: 1, revision: 0, replacements: { 'ADV.JS': '冒险引擎' }, locales: { 'zh-CN': { replacements: { 'ADV.JS': '中文引擎' } } } } })
    expect(wrapper.text()).toContain('版本 1')
    await fields[0]!.setValue('{"x":"<speak>bad</speak>"}')
    expect(wrapper.get('[data-testid="pronunciation-save"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[role="alert"]').text()).toContain('literal NFC prose')
  })

  it('retains dictionary drafts after revision conflicts and ignores a late read after changing project', async () => {
    const wrapper = mount(AEAudioPronunciationPanel)
    wrappers.push(wrapper)
    await flushPromises()
    await wrapper.findAll('textarea')[0]!.setValue('{"hero":"Author draft"}')
    state.service.savePronunciation!.mockRejectedValue(new Error('VOICE_CONFLICT: Reload'))
    await wrapper.get('[data-testid="pronunciation-save"]').trigger('click')
    await flushPromises()
    expect(wrapper.findAll('textarea')[0]!.element.value).toContain('Author draft')
    expect(wrapper.get('[role="alert"]').text()).toContain('VOICE_CONFLICT')
    let resolveLate!: (value: unknown) => void
    state.service.readPronunciation!.mockImplementationOnce(() => new Promise(resolve => resolveLate = resolve))
    await wrapper.findAll('button')[0]!.trigger('click')
    state.project.workspace = { writeFiles: vi.fn() }
    await flushPromises()
    resolveLate({ dictionary: { schemaVersion: 1, revision: 99, replacements: { late: 'Ignored' }, locales: {} }, revision: 'stale' })
    await flushPromises()
    expect(wrapper.text()).not.toContain('版本 99')
  })

  it('saves a narrator profile through its project document, and clearing it removes the optional field', async () => {
    const narrator: CharacterVoiceProfile = { intent: {}, locales: { 'zh-CN': { providers: { 'openai-tts': { voiceId: 'echo', model: 'tts-1', source: 'system' } } } } }
    state.service.readVoiceProfiles!.mockResolvedValue({ profiles: { schemaVersion: 1, revision: 2, narrator }, revision: 'narrator-review' })
    const wrapper = mount(AEAudioVoiceProfilesPanel, { global })
    wrappers.push(wrapper)
    await flushPromises()
    await wrapper.get('[data-testid="character-voice-clear"]').trigger('click')
    await wrapper.get('[data-testid="narrator-profile-save"]').trigger('click')
    await flushPromises()
    expect(state.service.saveVoiceProfiles).toHaveBeenCalledWith({ expectedRevision: 'narrator-review', profiles: { schemaVersion: 1, revision: 2 } })
    expect(JSON.parse(state.project.project.files['adv/audio/voice-profiles.json']!)).toEqual({ schemaVersion: 1, revision: 3 })
    expect(Object.keys(state.project.project.files)).toEqual(['adv/audio/voice-profiles.json'])
  })
})
