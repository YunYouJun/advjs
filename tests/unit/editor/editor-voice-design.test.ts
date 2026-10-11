import type { VoiceDesignMutation, VoiceDesignPort, VoiceDesignPreview, VoiceDesignSnapshot } from '@advjs/types'
import { createHash, webcrypto } from 'node:crypto'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, reactive, ref } from 'vue'
import AEVoiceDesignCandidates from '../../../editor/core/app/components/panel/audio/AEVoiceDesignCandidates.vue'
import { useVoiceDesign } from '../../../editor/core/app/composables/useVoiceDesign'

const context = vi.hoisted(() => ({ project: {} as { workspace?: { voiceDesign?: VoiceDesignPort }, project?: { files: Record<string, string> }, refreshProject: ReturnType<typeof vi.fn> }, drafts: { register: vi.fn(), remove: vi.fn() } }))
vi.mock('../../../editor/core/app/stores/useProjectStore', () => ({ useProjectStore: () => context.project }))
vi.mock('../../../editor/core/app/stores/useAudioStore', () => ({ useAudioStore: () => ({ supportedRoot: true }) }))
vi.mock('../../../editor/core/app/stores/useProjectDrafts', () => ({ useProjectDrafts: () => context.drafts }))

const sampleBytes = new Uint8Array([1, 2, 3, 4])
const sha256 = createHash('sha256').update(sampleBytes).digest('hex')
function initial(): VoiceDesignSnapshot {
  return {
    configured: true,
    revision: 'reviewed-native-snapshot',
    library: { schemaVersion: 1, voices: [{ id: 'hero-voice', version: '1', characterId: 'hero', label: 'Hero voice', implementations: {}, design: { schemaVersion: 1, intent: { speakingStyle: 'Calm' }, locales: { 'zh-CN': { providers: { 'fixture-tts': { preset: 'reviewed', source: 'system', providerVoiceId: 'coral' } } } }, samples: [], selectedSamples: {} } }] },
    providers: [{ id: 'fixture-tts', backend: 'local', sources: ['system'], builtInVoices: [{ id: 'coral', label: 'Coral' }], presets: [{ id: 'reviewed', model: 'fixture-model', sources: ['system'] }] }],
    speakers: [{ id: 'hero', name: 'Hero', profile: { intent: { speakingStyle: 'Calm' } } }, { id: 'narrator', name: '旁白' }],
    referenceAssets: [],
    previews: [],
  }
}
const candidate = { id: 'preview-candidate', characterId: 'hero', text: '试听', sha256, bytes: 4, mimeType: 'audio/wav', durationSeconds: 1, sampleRate: 24000, provider: 'fixture-tts', model: 'fixture-model', providerVoiceId: 'coral' }
const ready: VoiceDesignPreview = { id: 'preview-one', voiceId: 'hero-voice', locale: 'zh-CN', providerId: 'fixture-tts', status: 'ready', candidate }
const wrappers: Array<{ unmount: () => void }> = []
let state: VoiceDesignSnapshot
let port: VoiceDesignPort
let studio: ReturnType<typeof useVoiceDesign>
let changeIndex = 0
const visible = ref(true)

function mutation(): VoiceDesignMutation {
  state = { ...state, revision: `native-revision-${++changeIndex}` }
  return { snapshot: JSON.parse(JSON.stringify(state)), changes: [] }
}
beforeEach(async () => {
  state = initial()
  changeIndex = 0
  visible.value = true
  vi.stubGlobal('crypto', webcrypto)
  vi.stubGlobal('URL', Object.assign(class extends URL {}, { createObjectURL: vi.fn(() => 'blob:verified-preview'), revokeObjectURL: vi.fn() }))
  port = {
    read: vi.fn(async () => JSON.parse(JSON.stringify(state))),
    saveVersion: vi.fn(async ({ draft }) => {
      state.library.voices.push({ id: draft.id, version: draft.version, characterId: draft.characterId, label: draft.label, implementations: {}, design: { schemaVersion: 1, intent: draft.intent, locales: draft.locales, samples: [], selectedSamples: {}, supersedes: draft.supersedes } })
      return mutation()
    }),
    planPreview: vi.fn(async input => ({ ...input, id: 'review-one', reviewHash: 'approved-review', characterCount: [...input.text].length, characterId: 'hero', model: 'fixture-model', providerVoiceId: 'coral', source: 'system', presetSha256: 'a'.repeat(64), expiresAt: new Date(Date.now() + 60_000).toISOString() })),
    executePreview: vi.fn(async () => {
      state.previews = [ready]
      return ready
    }),
    readPreview: vi.fn(async () => ready),
    cancelPreview: vi.fn(async () => ({ ...ready, status: 'cancelled' })),
    readPreviewAudio: vi.fn(async () => new Blob([sampleBytes], { type: 'audio/wav' })),
    registerSample: vi.fn(async () => {
      state.previews = [{ ...ready, status: 'registered', registeredAssetId: 'sample-one' }]
      state.library.voices[0]!.design!.samples.push({ assetId: 'sample-one', sha256, bytes: 4, locale: 'zh-CN', providerId: 'fixture-tts', providerVoiceId: 'coral', model: 'fixture-model', source: 'system', text: '试听', presetSha256: 'a'.repeat(64), createdAt: new Date().toISOString() })
      return mutation()
    }),
    selectSample: vi.fn(async ({ assetId }) => {
      state.library.voices[0]!.design!.selectedSamples = { 'zh-CN': { 'fixture-tts': { assetId, sha256 } } }
      return mutation()
    }),
    applyProfile: vi.fn(async () => mutation()),
  }
  context.project = reactive({ workspace: { voiceDesign: port }, project: { files: {} }, refreshProject: vi.fn(async () => undefined) })
  const wrapper = mount(defineComponent({ setup() {
    studio = useVoiceDesign(() => visible.value)
    return () => h('div')
  } }))
  wrappers.push(wrapper)
  await flushPromises()
})
afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount())
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

describe('editor shared voice design workflow', () => {
  it('keeps saved design immutable, copies a distinct revision and saves without invoking synthesis or profile adoption', async () => {
    expect(studio.immutable.value).toBe(true)
    expect(studio.canSave.value).toBe(false)
    studio.newVersion(true)
    expect(studio.immutable.value).toBe(false)
    expect(studio.draft.value!.id).not.toBe('hero-voice')
    expect(studio.draft.value!.supersedes).toEqual({ id: 'hero-voice', version: '1' })
    expect(studio.draft.value!.locales).toEqual(initial().library.voices[0]!.design!.locales)
    expect(studio.dirty.value).toBe(true)
    expect(await studio.save()).toBe(true)
    expect(port.saveVersion).toHaveBeenCalledWith(expect.objectContaining({ expectedRevision: 'reviewed-native-snapshot', draft: expect.objectContaining({ supersedes: { id: 'hero-voice', version: '1' } }) }), expect.any(AbortSignal))
    expect(studio.dirty.value).toBe(false)
    expect(studio.immutable.value).toBe(true)
    expect(port.executePreview).not.toHaveBeenCalled()
    expect(port.applyProfile).not.toHaveBeenCalled()
  })

  it('separates budget review, temporary hash-checked audition, sample registration, sample selection and profile application', async () => {
    studio.allowUnknownCost.value = true
    await flushPromises()
    await studio.plan()
    expect(port.executePreview).not.toHaveBeenCalled()
    await studio.execute()
    expect(port.executePreview).not.toHaveBeenCalled()
    studio.budgetReviewed.value = true
    await studio.execute()
    expect(port.executePreview).toHaveBeenCalledTimes(1)
    expect(port.registerSample).not.toHaveBeenCalled()
    await studio.audition(studio.previews.value[0]!)
    expect(studio.source.value).toBe('blob:verified-preview')
    expect(port.selectSample).not.toHaveBeenCalled()
    await studio.register(studio.previews.value[0]!)
    expect(port.registerSample).toHaveBeenCalledWith({ previewId: 'preview-one', expectedRevision: 'reviewed-native-snapshot' }, expect.any(AbortSignal))
    expect(studio.selectedSample.value).toBeUndefined()
    expect(port.applyProfile).not.toHaveBeenCalled()
    await studio.selectSample('sample-one')
    expect(port.selectSample).toHaveBeenCalledWith({ voiceId: 'hero-voice', locale: 'zh-CN', providerId: 'fixture-tts', assetId: 'sample-one', expectedRevision: 'native-revision-1', replaceSelected: false }, expect.any(AbortSignal))
    await studio.applyProfile()
    expect(port.applyProfile).toHaveBeenCalledWith({ voiceId: 'hero-voice', locale: 'zh-CN', providerId: 'fixture-tts', expectedRevision: 'native-revision-2', replaceBinding: false }, expect.any(AbortSignal))
    expect(context.project.refreshProject).toHaveBeenCalledTimes(3)
    expect(context.project.project!.files).toEqual({})
    studio.stopAudio()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:verified-preview')
  })

  it('refuses a corrupt temporary candidate before creating an audition URL or registering anything', async () => {
    vi.mocked(port.readPreviewAudio).mockResolvedValueOnce(new Blob([new Uint8Array([9, 9, 9, 9])], { type: 'audio/wav' }))
    await studio.audition(ready)
    expect(studio.source.value).toBe('')
    expect(URL.createObjectURL).not.toHaveBeenCalled()
    expect(port.registerSample).not.toHaveBeenCalled()
    expect(studio.error.value).toContain('MEDIA_INVALID')
  })

  it('retains the unsaved version and registered project draft after a native revision conflict', async () => {
    studio.newVersion(true)
    const draft = JSON.stringify(studio.draft.value)
    vi.mocked(port.saveVersion).mockRejectedValueOnce(new Error('VOICE_DESIGN_CONFLICT'))
    expect(await studio.save()).toBe(false)
    expect(JSON.stringify(studio.draft.value)).toBe(draft)
    expect(studio.dirty.value).toBe(true)
    expect(context.drafts.register).toHaveBeenLastCalledWith(expect.any(String), expect.objectContaining({ dirty: true }))
    expect(studio.error.value).toContain('草稿保留')
  })

  it('ignores media that arrives after switching workspaces and reloads unknown results without dispatching synthesis', async () => {
    let complete!: (blob: Blob) => void
    vi.mocked(port.readPreviewAudio).mockReturnValueOnce(new Promise((resolve) => {
      complete = resolve
    }))
    const operation = studio.audition(ready)
    context.project.workspace = undefined
    await flushPromises()
    complete(new Blob([sampleBytes], { type: 'audio/wav' }))
    await operation
    expect(URL.createObjectURL).not.toHaveBeenCalled()
    expect(studio.source.value).toBe('')
    state.previews = [{ ...ready, status: 'unknown', candidate: undefined }]
    context.project.workspace = { voiceDesign: port }
    await flushPromises()
    await studio.reload()
    expect(studio.previews.value[0]!.status).toBe('unknown')
    expect(port.executePreview).not.toHaveBeenCalled()
    expect(port.registerSample).not.toHaveBeenCalled()
  })

  it('aborts a pending audition on panel leave without creating an audio URL or losing the design draft', async () => {
    let complete!: (blob: Blob) => void
    vi.mocked(port.readPreviewAudio).mockReturnValueOnce(new Promise((resolve) => {
      complete = resolve
    }))
    studio.newVersion(true)
    const draft = JSON.stringify(studio.draft.value)
    const operation = studio.audition(ready)
    const signal = vi.mocked(port.readPreviewAudio).mock.calls[0]![1]!
    visible.value = false
    await flushPromises()
    expect(signal.aborted).toBe(true)
    complete(new Blob([sampleBytes], { type: 'audio/wav' }))
    await operation
    expect(URL.createObjectURL).not.toHaveBeenCalled()
    expect(JSON.stringify(studio.draft.value)).toBe(draft)
    expect(studio.dirty.value).toBe(true)
  })

  it('preserves an approved review across equivalent project refreshes and invalidates changed host inputs', async () => {
    studio.allowUnknownCost.value = true
    await flushPromises()
    await studio.plan()
    context.project.project!.files = { 'authoring/voices/library.json': 'same server design, newly refreshed local snapshot' }
    await flushPromises()
    expect(studio.review.value?.id).toBe('review-one')
    state = { ...state, revision: 'changed-authoring-inputs' }
    context.project.project!.files = { 'adv/settings/game.json': 'external character change' }
    await flushPromises()
    expect(studio.review.value).toBeUndefined()
    expect(studio.budgetReviewed.value).toBe(false)
    expect(port.executePreview).not.toHaveBeenCalled()
  })

  it('pauses actual audition elements when the media source is cleared or the candidate component unmounts', async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
    const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined)
    const wrapper = mount(AEVoiceDesignCandidates, { props: { previews: [ready], samples: [], source: '', playingPreviewId: 'preview-one', pending: false, replaceSelected: false } })
    wrappers.push(wrapper)
    await wrapper.setProps({ source: 'blob:verified-preview' })
    await flushPromises()
    expect(play).toHaveBeenCalledTimes(1)
    await wrapper.setProps({ source: '' })
    expect(pause).toHaveBeenCalled()
    await wrapper.setProps({ source: 'blob:second-preview' })
    await flushPromises()
    const previous = pause.mock.calls.length
    wrapper.unmount()
    expect(pause.mock.calls.length).toBeGreaterThan(previous)
  })
})
