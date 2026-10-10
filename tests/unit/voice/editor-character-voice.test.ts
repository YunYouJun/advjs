import type { AdvVoiceLibrarySnapshot } from '@advjs/types'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import CharacterVoicePanel from '../../../editor/core/app/components/character/CharacterVoicePanel.vue'

const initial: AdvVoiceLibrarySnapshot = {
  configured: true,
  revision: 'a'.repeat(64),
  voices: [{ id: 'hero-voice', characterId: 'hero', version: 'v1', label: 'Hero', implementations: { mock: { preset: 'short' } } }],
  samples: [{ assetId: 'first', characterId: 'hero', title: 'First' }, { assetId: 'second', characterId: 'hero', title: 'Second' }],
}
const field = {
  props: ['modelValue', 'options', 'disabled', 'label'],
  emits: ['update:modelValue'],
  template: `<select :value="modelValue" :disabled="disabled" @change="$emit('update:modelValue', $event.target.value)"><option v-for="option in options" :value="typeof option === 'string' ? option : option.value">{{ typeof option === 'string' ? option : option.label }}</option></select>`,
}
const global = { stubs: { AGUISelect: field } }
let workspace: { voiceLibrary: ReturnType<typeof vi.fn>, readVoiceAudio: ReturnType<typeof vi.fn>, selectVoiceSample: ReturnType<typeof vi.fn> }
let project: { workspace: typeof workspace }

beforeEach(() => {
  workspace = { voiceLibrary: vi.fn(async () => structuredClone(initial)), readVoiceAudio: vi.fn(async () => new Blob(['fixture'], { type: 'audio/wav' })), selectVoiceSample: vi.fn(async () => structuredClone(initial)) }
  project = reactive({ workspace })
  vi.stubGlobal('useProjectStore', () => project)
  vi.stubGlobal('useI18n', () => ({ t: (key: string) => key }))
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:voice'), revokeObjectURL: vi.fn() }))
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {})
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

async function opened() {
  const wrapper = mount(CharacterVoicePanel, { global, props: { character: { id: 'hero', name: 'Hero' } } })
  await wrapper.get('[data-testid="voice-open"]').trigger('click')
  await flushPromises()
  return wrapper
}

describe('character sample review lifecycle', () => {
  it('ignores late list and audio reads after closing repeatedly, without creating leaked URLs', async () => {
    let resolveList!: (result: AdvVoiceLibrarySnapshot) => void
    workspace.voiceLibrary.mockImplementationOnce(() => new Promise(resolve => resolveList = resolve))
    const wrapper = mount(CharacterVoicePanel, { global, props: { character: { id: 'hero', name: 'Hero' } } })
    await wrapper.get('[data-testid="voice-open"]').trigger('click')
    const listSignal = workspace.voiceLibrary.mock.calls[0]![0] as AbortSignal
    await wrapper.get('[data-testid="voice-close"]').trigger('click')
    expect(listSignal.aborted).toBe(true)
    resolveList(initial)
    await flushPromises()
    expect(wrapper.find('select').exists()).toBe(false)
    await wrapper.get('[data-testid="voice-open"]').trigger('click')
    await flushPromises()
    let resolveAudio!: (result: Blob) => void
    workspace.readVoiceAudio.mockImplementationOnce(() => new Promise(resolve => resolveAudio = resolve))
    await wrapper.get('[data-testid="voice-preview"]').trigger('click')
    const audioSignal = workspace.readVoiceAudio.mock.calls[0]![1] as AbortSignal
    await wrapper.get('[data-testid="voice-close"]').trigger('click')
    expect(audioSignal.aborted).toBe(true)
    resolveAudio(new Blob(['late']))
    await flushPromises()
    expect(URL.createObjectURL).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('requires manual playback and releases the audio on candidate, character, workspace, and unmount changes', async () => {
    const wrapper = await opened()
    await wrapper.get('[data-testid="voice-preview"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('audio').attributes('autoplay')).toBeUndefined()
    await wrapper.get('select[name="assetId"]').setValue('second')
    expect(URL.revokeObjectURL).toHaveBeenCalledOnce()
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled()
    await wrapper.get('[data-testid="voice-preview"]').trigger('click')
    await flushPromises()
    await wrapper.setProps({ character: { id: 'other', name: 'Other' } })
    expect(wrapper.find('audio').exists()).toBe(false)
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2)
    await wrapper.setProps({ character: { id: 'hero', name: 'Hero' } })
    await wrapper.get('[data-testid="voice-open"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="voice-preview"]').trigger('click')
    await flushPromises()
    project.workspace = { ...workspace }
    await flushPromises()
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(3)
    wrapper.unmount()
  })

  it('stops and releases a loaded sample when the panel unmounts', async () => {
    const wrapper = await opened()
    await wrapper.get('[data-testid="voice-preview"]').trigger('click')
    await flushPromises()
    wrapper.unmount()
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalledOnce()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:voice')
  })

  it('stops playback on provider changes even when the stable identity is shared, and on version changes', async () => {
    const snapshot = structuredClone(initial)
    snapshot.voices[0]!.implementations.cloud = { preset: 'cloud-short' }
    snapshot.voices.push({ id: 'hero-alternate', characterId: 'hero', version: 'v2', label: 'Alternate', implementations: { mock: { preset: 'short' } } })
    workspace.voiceLibrary.mockResolvedValue(snapshot)
    const wrapper = await opened()
    await wrapper.get('[data-testid="voice-preview"]').trigger('click')
    await flushPromises()
    await wrapper.get('select[name="providerId"]').setValue('cloud')
    expect(wrapper.get('select[name="voiceId"]').element).toHaveProperty('value', 'hero-voice')
    expect(wrapper.find('audio').exists()).toBe(false)
    expect(URL.revokeObjectURL).toHaveBeenCalledOnce()
    await wrapper.get('select[name="providerId"]').setValue('mock')
    await wrapper.get('[data-testid="voice-preview"]').trigger('click')
    await flushPromises()
    await wrapper.get('select[name="voiceId"]').setValue('hero-alternate')
    expect(wrapper.find('audio').exists()).toBe(false)
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2)
    wrapper.unmount()
  })

  it('reports decoder errors and releases the failed media URL', async () => {
    const wrapper = await opened()
    await wrapper.get('[data-testid="voice-preview"]').trigger('click')
    await flushPromises()
    await wrapper.get('audio').trigger('error')
    expect(wrapper.get('[role="alert"]').text()).toBe('characters.voice.playbackError')
    expect(wrapper.find('audio').exists()).toBe(false)
    expect(URL.revokeObjectURL).toHaveBeenCalledOnce()
    wrapper.unmount()
  })

  it('focuses the close control on opening and returns keyboard focus after Escape', async () => {
    const wrapper = mount(CharacterVoicePanel, { global, attachTo: document.body, props: { character: { id: 'hero', name: 'Hero' } } })
    await wrapper.get('[data-testid="voice-open"]').trigger('click')
    await flushPromises()
    expect(document.activeElement).toBe(wrapper.get('[data-testid="voice-close"]').element)
    await wrapper.get('select[name="assetId"]').trigger('keydown', { key: 'Escape' })
    await flushPromises()
    expect(document.activeElement).toBe(wrapper.get('[data-testid="voice-open"]').element)
    expect(workspace.selectVoiceSample).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('sends the complete revision and refuses replacement until explicitly checked, preserving a failed review', async () => {
    const snapshot = structuredClone(initial)
    snapshot.voices[0]!.selectedSample = { assetId: 'first', sha256: 'b'.repeat(64) }
    workspace.voiceLibrary.mockResolvedValue(snapshot)
    workspace.selectVoiceSample.mockRejectedValue(new Error('VOICE_CONFLICT: reload'))
    const wrapper = await opened()
    await wrapper.get('select[name="assetId"]').setValue('second')
    expect(wrapper.get('[data-testid="voice-select"]').attributes('disabled')).toBeDefined()
    await wrapper.get('[name="replaceSelected"] input').setValue(true)
    await wrapper.get('[data-testid="voice-select"]').trigger('click')
    await flushPromises()
    expect(workspace.selectVoiceSample).toHaveBeenCalledWith({ voiceId: 'hero-voice', assetId: 'second', expectedRevision: initial.revision, replaceSelected: true })
    expect(wrapper.get('[role="alert"]').text()).toContain('VOICE_CONFLICT')
    expect(wrapper.get('select[name="assetId"]').element).toHaveProperty('value', 'second')
    expect(snapshot.voices[0]!.selectedSample?.assetId).toBe('first')
    wrapper.unmount()
  })
})
