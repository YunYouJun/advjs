import type { AdvVoiceCandidate, VoiceAuthoringAdapter } from '@advjs/types'
import type { ProjectFileChange, ProjectWorkspace } from '../../../editor/core/app/workspaces/project'
import { Blob as NodeBlob, File as NodeFile } from 'node:buffer'
import { createHash, webcrypto } from 'node:crypto'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { markRaw, reactive } from 'vue'
import AEAudioMixerPanel from '../../../editor/core/app/components/panel/audio/AEAudioMixerPanel.vue'
import AEProjectAudioPanel from '../../../editor/core/app/components/panel/audio/AEProjectAudioPanel.vue'
import AEVoiceLedgerPanel from '../../../editor/core/app/components/panel/audio/AEVoiceLedgerPanel.vue'
import { useAudioStore } from '../../../editor/core/app/stores/useAudioStore'
import { useProjectAssets } from '../../../editor/core/app/stores/useProjectAssets'
import { compileProject } from '../../../packages/core/src/project'

interface TestProject {
  workspace: ProjectWorkspace
  project: { files: Record<string, string>, compilation: Awaited<ReturnType<typeof compileProject>> }
  resourceRevision: number
  writeProjectFiles: (changes: ProjectFileChange[]) => Promise<void>
}
const testState = vi.hoisted(() => ({ project: undefined as unknown as TestProject }))
vi.mock('../../../editor/core/app/stores/useProjectStore', () => ({ useProjectStore: () => testState.project }))
vi.mock('@advjs/core', () => import('../../../packages/core/src/project'))

const lineId = 'line_019d137e-7abc-7000-8000-000000000001'
const assetIds = [1, 2, 3].map(index => `audio_019d137e-7abc-7000-8000-00000000000${index}`)
const takeIds = [1, 2, 3].map(index => `take_019d137e-7abc-7000-8000-00000000000${index}`)
const ledgerPath = 'adv/audio/voice-ledger.json'
const mediaBytes = new Uint8Array([1, 2, 3, 4])
const digest = createHash('sha256').update(mediaBytes).digest('hex')
const field = {
  props: ['modelValue', 'options', 'disabled', 'label'],
  emits: ['update:modelValue'],
  template: '<select :value="modelValue" :disabled="disabled" :aria-label="label" @change="$emit(\'update:modelValue\', $event.target.value)"><option v-for="option in options" :value="typeof option === \'string\' ? option : option.value">{{ typeof option === \'string\' ? option : option.label }}</option></select>',
}
const global = { stubs: { AGUISelect: field } }
const mounted: Array<{ unmount: () => void }> = []
let workspace: ProjectWorkspace
let write: ReturnType<typeof vi.fn>
let readAsset: ReturnType<typeof vi.fn>
let blobs: Map<string, Blob>

function take(index: number, spokenText: string) {
  return { id: takeIds[index], assetId: assetIds[index], sha256: digest, providerId: 'fixture-tts', voiceId: 'system:fixture', model: 'fixture-model', voiceProfileRevision: digest, inputFingerprint: digest, spokenText, source: 'system', createdAt: '2026-10-11T08:00:00.000Z' }
}

async function setupProject(options: { empty?: boolean, catalog?: boolean } = {}) {
  let owner: TestProject
  const files: Record<string, string> = {
    'adv.config.json': JSON.stringify({ id: 'editor-audio', root: 'adv' }),
    'adv/settings/game.json': JSON.stringify({ title: 'Audio', characters: [{ id: 'hero', name: 'Hero' }] }),
    'adv/chapters/intro.adv.md': `@Hero\n你好。 {#${lineId}}`,
  }
  if (options.catalog !== false) {
    files['adv/assets.json'] = JSON.stringify({ schemaVersion: 2, id: 'editor-audio-assets', defaultProfile: 'local', profiles: { local: { provider: 'project', root: 'public/media' } }, assets: options.empty
      ? []
      : [
          ...assetIds.map((id, index) => ({ id, type: 'audio', kind: 'voice', path: `voice/${index}.wav`, title: `Voice ${index}`, sha256: digest, bytes: mediaBytes.length, mimeType: 'audio/wav' })),
          ...['bgm', 'ambience', 'sfx', 'ui', 'reference'].map(kind => ({ id: `audio-${kind}`, type: 'audio', kind, path: `${kind}.wav`, title: kind, sha256: digest, bytes: mediaBytes.length, mimeType: 'audio/wav' })),
        ] })
  }
  if (!options.empty && options.catalog !== false) {
    files[ledgerPath] = JSON.stringify({ schemaVersion: 1, lines: { [lineId]: { speakerId: 'hero', displayText: '你好。', locales: {
      'zh-CN': { selectedTake: takeIds[0], takes: [take(0, '你好。'), take(1, '历史台词。')] },
      'en': { displayText: 'Hello.', selectedTake: takeIds[2], takes: [take(2, 'Hello.')] },
    } } } })
  }
  blobs = new Map([...assetIds.map((_, index) => [`public/media/voice/${index}.wav`, new NodeBlob([mediaBytes], { type: 'audio/wav' }) as unknown as Blob] as const)])
  for (const kind of ['bgm', 'ambience', 'sfx', 'ui', 'reference'])
    blobs.set(`public/media/${kind}.wav`, new NodeBlob([mediaBytes], { type: 'audio/wav' }) as unknown as Blob)
  write = vi.fn(async (changes: ProjectFileChange[]) => {
    const current = owner.project.files
    for (const change of changes) {
      if ((current[change.path] ?? null) !== change.expected)
        throw new Error('AUDIO_CONFLICT: Project file changed')
    }
    const next = { ...current }
    for (const change of changes) {
      if (change.content === null)
        delete next[change.path]
      else
        next[change.path] = change.content
    }
    owner.project = { files: next, compilation: await compileProject({ files: next }, { allowEmptyAssetManifest: true }) }
    owner.resourceRevision++
  })
  readAsset = vi.fn(async (path: string) => {
    const blob = blobs.get(path)
    if (!blob)
      throw new Error(`Missing media: ${path}`)
    return blob
  })
  workspace = markRaw({
    kind: 'browser',
    async readDocuments() { return { files: owner.project.files, catalog: owner.project.compilation.project.assets } },
    readAsset,
    writeFiles: write,
    async importAsset(path: string, blob: Blob) { blobs.set(path, blob) },
    async removeImportedAsset(path: string) { blobs.delete(path) },
  } as unknown as ProjectWorkspace)
  owner = reactive({ workspace, project: { files, compilation: await compileProject({ files }, { allowEmptyAssetManifest: true }) }, resourceRevision: 0, writeProjectFiles: write })
  testState.project = owner
  vi.stubGlobal('useProjectStore', () => testState.project)
}

beforeEach(async () => {
  setActivePinia(createPinia())
  vi.stubGlobal('crypto', webcrypto)
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:editor-audio'), revokeObjectURL: vi.fn() }))
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  await setupProject()
})
afterEach(() => {
  for (const wrapper of mounted.splice(0))
    wrapper.unmount()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

async function openLedger() {
  const wrapper = mount(AEVoiceLedgerPanel, { global })
  mounted.push(wrapper)
  await vi.waitFor(() => expect(wrapper.get('[aria-label="对白配音账本"]').attributes('aria-busy')).toBe('false'))
  return wrapper
}
function savedLedger() {
  return JSON.parse(testState.project.project.files[ledgerPath]!)
}

describe('editor native audio workspace', () => {
  it('loads the real ledger without fetching media or generating audio, and reviews every locale independently', async () => {
    const wrapper = await openLedger()
    expect(readAsset).not.toHaveBeenCalled()
    expect(write).not.toHaveBeenCalled()
    expect(wrapper.get('[data-testid="voice-synthesize"]').attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('当前宿主未接入 TTS')
    expect(wrapper.get('select[name="takeId"]').element).toHaveProperty('value', takeIds[0])
    await wrapper.get('select[name="locale"]').setValue('en')
    expect(wrapper.get('select[name="takeId"]').element).toHaveProperty('value', takeIds[2])
    expect(wrapper.get('textarea').element).toHaveProperty('value', 'Hello.')
    expect(readAsset).not.toHaveBeenCalled()
  })

  it('requires explicit replacement, verifies actual media and preserves the complete take history', async () => {
    const wrapper = await openLedger()
    await wrapper.get('select[name="takeId"]').setValue(takeIds[1])
    expect(wrapper.text()).toContain('发音词典或声音配置已变化')
    expect(wrapper.get('[data-testid="take-select"]').attributes('disabled')).toBeDefined()
    await wrapper.get('[data-testid="take-replace"] input').setValue(true)
    expect(wrapper.get('[data-testid="take-select"]').attributes('disabled')).toBeDefined()
    await wrapper.get('[data-testid="take-stale-reviewed"] input').setValue(true)
    await wrapper.get('[data-testid="take-select"]').trigger('click')
    await vi.waitFor(() => expect(savedLedger().lines[lineId].locales['zh-CN'].selectedTake).toBe(takeIds[1]))
    expect(readAsset).toHaveBeenCalledWith('public/media/voice/1.wav')
    const locales = savedLedger().lines[lineId].locales
    expect(locales['zh-CN'].selectedTake).toBe(takeIds[1])
    expect(locales['zh-CN'].takes.map((item: { id: string }) => item.id)).toEqual(takeIds.slice(0, 2))
    expect(locales.en.selectedTake).toBe(takeIds[2])
    expect(write.mock.calls[0]![0]).toContainEqual(expect.objectContaining({ path: ledgerPath, expected: expect.any(String) }))
  })

  it('refuses altered take media before selection or a preview URL can be created', async () => {
    const wrapper = await openLedger()
    blobs.set('public/media/voice/1.wav', new NodeBlob(['changed']) as unknown as Blob)
    await wrapper.get('select[name="takeId"]').setValue(takeIds[1])
    await wrapper.get('[data-testid="take-preview"]').trigger('click')
    await vi.waitFor(() => expect(wrapper.get('[role="alert"]').text()).toContain('HASH_MISMATCH'))
    expect(wrapper.get('[role="alert"]').text()).toContain('HASH_MISMATCH')
    expect(URL.createObjectURL).not.toHaveBeenCalled()
    await wrapper.get('[data-testid="take-replace"] input').setValue(true)
    await wrapper.get('[data-testid="take-stale-reviewed"] input').setValue(true)
    await wrapper.get('[data-testid="take-select"]').trigger('click')
    await vi.waitFor(() => expect(wrapper.get('[role="alert"]').text()).toContain('VOICE_AUDIO_CHANGED'))
    expect(wrapper.get('[role="alert"]').text()).toContain('VOICE_AUDIO_CHANGED')
    expect(savedLedger().lines[lineId].locales['zh-CN'].selectedTake).toBe(takeIds[0])
    expect(write).not.toHaveBeenCalled()
  })

  it('rechecks an already selected stale take without changing its identity and invalidates subjective approval when source changes', async () => {
    const path = 'adv/chapters/intro.adv.md'
    const changed = { ...testState.project.project.files, [path]: `@Hero\n现在的台词。 {#${lineId}}` }
    testState.project.project = { files: changed, compilation: await compileProject({ files: changed }, { allowEmptyAssetManifest: true }) }
    const wrapper = await openLedger()
    const original = testState.project.project.files[ledgerPath]
    expect(wrapper.get('[data-testid="take-keep"]').attributes('disabled')).toBeDefined()
    await wrapper.get('[data-testid="take-stale-reviewed"] input').setValue(true)
    await wrapper.get('[data-testid="take-keep"]').trigger('click')
    await vi.waitFor(() => expect(wrapper.text()).toContain('客观 stale 标记和生成记录仍保留'))
    expect(readAsset).toHaveBeenCalledWith('public/media/voice/0.wav')
    expect(write).not.toHaveBeenCalled()
    expect(testState.project.project.files[ledgerPath]).toBe(original)
    const next = { ...changed, [path]: `@Hero\n台词再次变化。 {#${lineId}}` }
    testState.project.project = { files: next, compilation: await compileProject({ files: next }, { allowEmptyAssetManifest: true }) }
    await flushPromises()
    expect(wrapper.text()).not.toContain('客观 stale 标记和生成记录仍保留')
    expect(wrapper.get('[data-testid="take-keep"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="take-stale-reviewed"] input').element).toHaveProperty('checked', false)
    expect(savedLedger().lines[lineId].locales['zh-CN'].selectedTake).toBe(takeIds[0])
  })

  it('loads preview only on an explicit action and releases playback when hidden or decoding fails', async () => {
    const wrapper = await openLedger()
    await wrapper.get('[data-testid="take-preview"]').trigger('click')
    await vi.waitFor(() => expect(wrapper.find('audio').exists()).toBe(true))
    expect(wrapper.get('audio').attributes()).toMatchObject({ src: 'blob:editor-audio', preload: 'none' })
    expect(wrapper.get('audio').attributes('autoplay')).toBeUndefined()
    await wrapper.setProps({ visible: false })
    expect(wrapper.find('audio').exists()).toBe(false)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:editor-audio')
    await wrapper.setProps({ visible: true })
    await wrapper.get('[data-testid="take-preview"]').trigger('click')
    await vi.waitFor(() => expect(wrapper.find('audio').exists()).toBe(true))
    await wrapper.get('audio').trigger('error')
    expect(wrapper.find('audio').exists()).toBe(false)
    expect(wrapper.get('[role="alert"]').text()).toContain('无法播放')
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2)
  })

  it('ignores a late preview after switching projects and clears the host synthesis transport', async () => {
    const transport = vi.fn<NonNullable<VoiceAuthoringAdapter['synthesize']>>()
    useAudioStore().setSynthesisTransport(transport)
    const wrapper = await openLedger()
    let resolve!: (blob: Blob) => void
    readAsset.mockImplementationOnce(() => new Promise<Blob>(done => resolve = done))
    await wrapper.get('[data-testid="take-preview"]').trigger('click')
    testState.project.workspace = markRaw({ ...workspace })
    await flushPromises()
    resolve(new NodeBlob([mediaBytes]) as unknown as Blob)
    await flushPromises()
    expect(wrapper.find('audio').exists()).toBe(false)
    expect(URL.createObjectURL).not.toHaveBeenCalled()
    expect(useAudioStore().canSynthesize).toBe(false)
    expect(transport).not.toHaveBeenCalled()
  })

  it('generates only on command and keeps the unreviewed candidate separate from registration and selection', async () => {
    const candidate: AdvVoiceCandidate = { id: 'candidate', characterId: 'hero', text: '你好。', path: '.advjs/voice/candidate.wav', sha256: digest, bytes: mediaBytes.length, mimeType: 'audio/wav', durationSeconds: 1, sampleRate: 24000, provider: 'fixture-tts', model: 'fixture-model', providerVoiceId: 'system:fixture' }
    const transport = vi.fn<NonNullable<VoiceAuthoringAdapter['synthesize']>>(async input => ({ provider: candidate.provider, preset: 'fixture', manifestPath: '.advjs/voice/manifest.json', manifest: {}, candidates: [{ ...candidate, text: input.text }] }))
    useAudioStore().setSynthesisTransport(transport)
    const wrapper = await openLedger()
    expect(transport).not.toHaveBeenCalled()
    await wrapper.get('[data-testid="voice-synthesize"]').trigger('click')
    await vi.waitFor(() => expect(wrapper.find('[data-testid="voice-register"]').exists()).toBe(true))
    expect(transport).toHaveBeenCalledOnce()
    expect(transport.mock.calls[0]![0]).toMatchObject({ lineId, locale: 'zh-CN', speakerId: 'hero', text: '你好。' })
    expect(wrapper.get('[data-testid="voice-register"]').attributes('disabled')).toBeDefined()
    expect(write).not.toHaveBeenCalled()
    expect(savedLedger().lines[lineId].locales['zh-CN'].selectedTake).toBe(takeIds[0])
    blobs.set(candidate.path, new NodeBlob([mediaBytes], { type: 'audio/wav' }) as unknown as Blob)
    await wrapper.get('select[aria-label="审核生成声音来源"]').setValue('system')
    await wrapper.get('input[id$="-revision"]').setValue(digest)
    await wrapper.get('[data-testid="voice-register"]').trigger('click')
    await vi.waitFor(() => expect(savedLedger().lines[lineId].locales['zh-CN'].takes.length).toBe(3))
    const registered = savedLedger().lines[lineId].locales['zh-CN'].takes[2]
    expect(registered).toMatchObject({ providerId: 'fixture-tts', voiceId: 'system:fixture', model: 'fixture-model', sha256: digest, voiceProfileRevision: digest, source: 'system' })
    expect(savedLedger().lines[lineId].locales['zh-CN'].selectedTake).toBe(takeIds[0])
    const asset = testState.project.project.compilation.project.assets!.assets.find(asset => asset.id === registered.assetId)!
    expect(asset).toMatchObject({ type: 'audio', kind: 'voice', sha256: digest })
    expect(blobs.has(`public/media/${asset.path}`)).toBe(true)
  })

  it('validates six-bus mixer drafts, writes with byte preconditions, and preserves drafts on external changes', async () => {
    const wrapper = mount(AEAudioMixerPanel, { global })
    mounted.push(wrapper)
    const source = wrapper.get('textarea')
    const document = JSON.parse((source.element as HTMLTextAreaElement).value)
    expect(Object.keys(document.buses)).toEqual(['master', 'music', 'ambience', 'voice', 'sfx', 'ui'])
    document.buses.music.gain = 2
    await source.setValue(JSON.stringify(document))
    expect(wrapper.get('[data-testid="mixer-save"]').attributes('disabled')).toBeDefined()
    expect(write).not.toHaveBeenCalled()
    document.buses.music.gain = 0.4
    await source.setValue(JSON.stringify(document))
    await wrapper.get('[data-testid="mixer-save"]').trigger('click')
    await vi.waitFor(() => expect(wrapper.text()).toContain('混音配置已保存'))
    expect(write.mock.calls[0]![0]).toContainEqual(expect.objectContaining({ path: 'adv/audio/mixer.json', expected: null }))
    expect(write.mock.calls[0]![0]).toContainEqual(expect.objectContaining({ path: 'adv/assets.json', expected: expect.any(String) }))
    document.buses.music.gain = 0.6
    const draft = JSON.stringify(document)
    await source.setValue(draft)
    testState.project.project.files['adv/audio/mixer.json'] = JSON.stringify({ schemaVersion: 1, buses: { music: { gain: 0.2 } } })
    await flushPromises()
    expect(source.element).toHaveProperty('value', draft)
    expect(wrapper.text()).toContain('草稿已保留')
    expect(wrapper.get('[data-testid="mixer-save"]').attributes('disabled')).toBeDefined()
  })

  it('classifies all six resource kinds without fetching previews and prevents removing historical voice assets', async () => {
    const wrapper = mount(AEProjectAudioPanel, { global })
    mounted.push(wrapper)
    expect(readAsset).not.toHaveBeenCalled()
    expect(wrapper.findAll('[data-asset-id]').length).toBe(8)
    const filter = wrapper.get('select[aria-label="音频用途筛选"]')
    for (const kind of ['bgm', 'ambience', 'sfx', 'voice', 'ui', 'reference']) {
      await filter.setValue(kind)
      expect(wrapper.findAll('[data-asset-id]').filter(row => row.attributes('style') !== 'display: none;').length).toBe(kind === 'voice' ? 3 : 1)
    }
    const history = testState.project.project.compilation.project.assets!.assets.find(asset => asset.id === assetIds[1])!
    await expect(useProjectAssets().remove(history)).rejects.toThrow('此音频仍被引用')
    expect(write).not.toHaveBeenCalled()
  })

  it('creates an empty native catalog only after the author action and imports blank-MIME audio into its actual profile', async () => {
    await setupProject({ catalog: false, empty: true })
    const wrapper = mount(AEProjectAudioPanel, { global })
    mounted.push(wrapper)
    expect(write).not.toHaveBeenCalled()
    await wrapper.get('[data-testid="audio-initialize"]').trigger('click')
    await vi.waitFor(() => expect(wrapper.find('[data-testid="audio-initialize"]').exists()).toBe(false))
    expect(write.mock.calls[0]![0]).toContainEqual(expect.objectContaining({ path: 'adv/assets.json', expected: null }))
    expect(testState.project.project.compilation.project.assets?.assets).toEqual([])
    const file = new NodeFile([mediaBytes], 'rain.wav') as unknown as File
    const result = await useProjectAssets().importFile(file, 'ambience')
    expect(result.asset.id).toMatch(/^audio_[0-9a-f-]{36}$/u)
    expect(result.asset.mimeType).toBe('audio/wav')
    expect(blobs.has(`adv/assets/${result.asset.path}`)).toBe(true)
    expect(testState.project.project.compilation.project.assets?.assets).toContainEqual(expect.objectContaining({ id: result.asset.id, kind: 'ambience', sha256: digest }))
  })

  it('refuses custom content roots before creating catalogs, writing mixer files or importing bytes', async () => {
    testState.project.project.compilation.project.root = 'story'
    const audio = useAudioStore()
    expect(audio.supportedRoot).toBe(false)
    await expect(audio.initializeCatalog()).rejects.toThrow('ADV_AUDIO_CONTENT_ROOT_UNSUPPORTED')
    await expect(audio.saveMixer('story/audio/mixer.json', '{}', null)).rejects.toThrow('ADV_AUDIO_CONTENT_ROOT_UNSUPPORTED')
    const file = new NodeFile([mediaBytes], 'unsupported.wav') as unknown as File
    const before = blobs.size
    await expect(useProjectAssets().importFile(file, 'bgm')).rejects.toThrow('ADV_AUDIO_CONTENT_ROOT_UNSUPPORTED')
    expect(blobs.size).toBe(before)
    expect(write).not.toHaveBeenCalled()
  })
})
