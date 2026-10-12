import type { VoiceReviewRow } from '@advjs/audio'
import type { VoiceAuthoringSnapshot, VoiceTake } from '@advjs/types'
import { Blob as NodeBlob } from 'node:buffer'
import { createHash, webcrypto } from 'node:crypto'
import { createVoiceListeningSession, exportVoiceListeningSession, recordVoiceListeningPlayback, voiceListeningCandidate } from '@advjs/audio'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, reactive, shallowRef } from 'vue'
import AEVoiceListeningPanel from '../../../editor/core/app/components/panel/audio/listening/AEVoiceListeningPanel.vue'
import { useVoiceListening } from '../../../editor/core/app/composables/useVoiceListening'
import { useVoiceListeningPlayback } from '../../../editor/core/app/composables/useVoiceListeningPlayback'
import { readVoiceListeningDraft, voiceListeningDraftKey, writeVoiceListeningDraft } from '../../../editor/core/app/utils/voice-listening-draft'

const state = vi.hoisted(() => ({ project: {} as any, drafts: {} as { projectId: string } }))
vi.mock('../../../editor/core/app/stores/useProjectStore', () => ({ useProjectStore: () => state.project }))
vi.mock('../../../editor/core/app/stores/useProjectDrafts', () => ({ useProjectDrafts: () => state.drafts }))
const bytes = new Uint8Array([1, 2, 3, 4])
const sha256 = createHash('sha256').update(bytes).digest('hex')
const rows: VoiceReviewRow[] = ['你好。', '再见。'].map((spokenText, line) => ({
  lineId: `line-${line}`,
  locale: 'zh-CN',
  speakerId: 'hero',
  displayText: spokenText,
  spokenText,
  selectedTake: `take-${line}-0`,
  takes: [0, 1].map(index => ({ id: `take-${line}-${index}`, assetId: `audio-${line}-${index}`, sha256, providerId: `private-provider-${index}`, voiceId: `private-voice-${index}`, model: 'private-model', voiceProfileRevision: sha256, inputFingerprint: sha256, spokenText, createdAt: '2026-10-11T08:00:00.000Z', source: 'system', selected: !index, stale: Boolean(index), unavailable: false } satisfies VoiceTake & { selected: boolean, stale: boolean, unavailable: boolean })),
}))
const snapshot: VoiceAuthoringSnapshot = {
  revision: 'revision-one',
  ledger: { schemaVersion: 1, lines: {} },
  catalog: { schemaVersion: 2, id: 'project-assets', defaultProfile: 'local', profiles: { local: { provider: 'project', root: 'public/media' } }, assets: rows.flatMap(row => row.takes.map(take => ({ id: take.assetId, kind: 'voice', type: 'audio', path: `voice/${take.assetId}.wav`, sha256, bytes: bytes.length, mimeType: 'audio/wav', duration: 1 }))) },
}
const field = { props: ['modelValue', 'options', 'disabled', 'label'], emits: ['update:modelValue'], template: '<select :value="modelValue" :disabled="disabled" :aria-label="label" @change="$emit(\'update:modelValue\', $event.target.value)"><option v-for="option in options" :value="typeof option === \'string\' ? option : option.value">{{ typeof option === \'string\' ? option : option.label }}</option></select>' }
const mounted: Array<{ unmount: () => void }> = []
let listening: ReturnType<typeof useVoiceListening>

function host(readSnapshot: () => VoiceAuthoringSnapshot = () => snapshot, readRows: () => VoiceReviewRow[] = () => rows) {
  const wrapper = mount(defineComponent({
    setup() {
      listening = useVoiceListening({ rows: readRows, snapshot: readSnapshot })
      return {}
    },
    template: '<div />',
  }))
  mounted.push(wrapper)
  return listening
}
beforeEach(() => {
  vi.stubGlobal('crypto', webcrypto)
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:listening'), revokeObjectURL: vi.fn() }))
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  localStorage.clear()
  state.drafts = reactive({ projectId: 'local:/private/project-A' })
  state.project = reactive({ workspace: { kind: 'local', readAsset: vi.fn(async () => new NodeBlob([bytes]) as unknown as Blob), writeFiles: vi.fn() }, resourceRevision: 0, project: { compilation: { project: { id: 'portable-native-id', characters: [{ id: 'hero', voiceProfile: { intent: { speakingStyle: '平静、清晰' } } }] } } } })
})
afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('editor private advanced listening', () => {
  it('creates a multi-group portable document while keeping recovery out of native author files', async () => {
    const listening = host()
    listening.groupId.value = '__all__'
    listening.create()
    expect(listening.session.value?.samples).toHaveLength(4)
    expect(new Set(listening.anonymousSamples.value.map(sample => sample.groupId)).size).toBe(2)
    expect(listening.session.value?.projectId).toBe('portable-native-id')
    expect(listening.session.value?.projectId).not.toContain('/private/')
    listening.updateReview({ scores: { naturalness: 4 }, notes: '手动草稿' })
    const content = readVoiceListeningDraft(localStorage, state.drafts.projectId)!
    expect(JSON.parse(content).samples.some((sample: { notes: string }) => sample.notes === '手动草稿')).toBe(true)
    expect(state.project.workspace.writeFiles).not.toHaveBeenCalled()
    state.drafts.projectId = 'local:/private/project-B'
    await flushPromises()
    expect(listening.session.value).toBeUndefined()
    expect(readVoiceListeningDraft(localStorage, 'local:/private/project-A')).toBe(content)
    expect(readVoiceListeningDraft(localStorage, 'local:/private/project-B')).toBeNull()
  })

  it('restores all groups from another host as a draft and discards imported playback and human claims', async () => {
    const authority = rows.flatMap(row => row.takes.map(take => voiceListeningCandidate(row, take.id, 1)))
    let incoming = createVoiceListeningSession({ projectId: 'portable-native-id', candidates: authority })
    incoming = recordVoiceListeningPlayback(incoming, incoming.samples[0]!.id, { fromSeconds: 0, toSeconds: 1, rate: 1, ended: true, durationSeconds: 1, provenance: 'browser-observed' })
    incoming.humanConfirmed = true
    incoming.provenance = 'human-attested'
    const file = { size: 100, text: async () => exportVoiceListeningSession(incoming) } as File
    const listening = host()
    await listening.restore(file)
    expect(listening.session.value?.samples).toHaveLength(4)
    expect(listening.session.value?.humanConfirmed).toBe(false)
    expect(listening.session.value?.samples.every(sample => sample.plays.length === 0 && sample.endedCount === 0 && sample.observedDurationSeconds === undefined)).toBe(true)
    expect(listening.inspection.value?.canAttest).toBe(false)
    expect(state.project.workspace.writeFiles).not.toHaveBeenCalled()
    await listening.restore({ size: 100, text: async () => exportVoiceListeningSession({ ...incoming, projectId: 'another-project' }) } as File)
    expect(listening.error.value).toContain('PROJECT_MISMATCH')
    expect(listening.session.value?.samples).toHaveLength(4)
  })

  it('renders actual anonymous AGUI fields, hides supplier identity, and blocks premature human attestation', async () => {
    const wrapper = mount(AEVoiceListeningPanel, { props: { rows, snapshot, visible: true }, global: { stubs: { AGUISelect: field } } })
    mounted.push(wrapper)
    expect(wrapper.text()).toContain('private-provider-')
    await wrapper.get('[data-testid="voice-listening-create"]').trigger('click')
    expect(wrapper.text()).not.toContain('private-provider-')
    expect(wrapper.text()).not.toContain('private-model')
    expect(wrapper.text()).not.toContain('audio-0-')
    expect(wrapper.findAll('select[aria-label^="S0"]').length).toBe(6)
    expect(wrapper.text()).toContain('参考一致性请选 NA')
    expect(wrapper.text()).toContain('当前角色目标')
    await wrapper.get('select[aria-label$="自然度"]').setValue('4')
    expect(JSON.parse(localStorage.getItem(voiceListeningDraftKey(state.drafts.projectId))!).samples[0].scores.naturalness).toBe(4)
    await wrapper.findAll('input[type="checkbox"]').at(-1)!.setValue(true)
    expect(wrapper.get('[data-testid="voice-listening-attest"]').attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('不等同标准 MOS')
    expect(state.project.workspace.writeFiles).not.toHaveBeenCalled()
  })

  it('restores a valid multilingual document above 512KiB bytes within the shared character bound', async () => {
    const spokenText = '中文配音听审'.repeat(650)
    const largeRows: VoiceReviewRow[] = Array.from({ length: 16 }, (_, line) => ({
      ...rows[0]!,
      lineId: `long-line-${line}`,
      spokenText,
      displayText: spokenText,
      takes: rows[0]!.takes.map((take, index) => ({ ...take, id: `long-take-${line}-${index}`, assetId: `long-audio-${line}-${index}`, spokenText })),
    }))
    const authority = largeRows.flatMap(row => row.takes.map(take => voiceListeningCandidate(row, take.id, 1)))
    const incoming = createVoiceListeningSession({ projectId: 'portable-native-id', candidates: authority })
    for (const sample of incoming.samples)
      sample.notes = '中文备注'.repeat(900)
    const content = exportVoiceListeningSession(incoming)
    const file = new File([content], 'large-chinese-review.json', { type: 'application/json' })
    expect(file.size).toBeGreaterThan(512 * 1024)
    expect(file.size).toBeLessThan(2 * 1024 * 1024)
    expect(content.length).toBeLessThan(512 * 1024)
    const listening = host(() => snapshot, () => largeRows)
    await listening.restore({ size: file.size, text: async () => content } as File)
    expect(listening.error.value).toBe('')
    expect(listening.session.value?.samples).toHaveLength(32)
    expect(listening.session.value?.samples.every(sample => sample.notes === '中文备注'.repeat(900))).toBe(true)
    expect(listening.session.value?.samples.every(sample => sample.plays.length === 0 && sample.endedCount === 0)).toBe(true)
    expect(state.project.workspace.writeFiles).not.toHaveBeenCalled()
    await listening.restore({ size: 2 * 1024 * 1024 + 1, text: vi.fn() } as unknown as File)
    expect(listening.error.value).toBe('VOICE_LISTENING_DRAFT_TOO_LARGE')
    await listening.restore({ size: 512 * 1024 + 1, text: async () => ' '.repeat(512 * 1024 + 1) } as File)
    expect(listening.error.value).toBe('VOICE_LISTENING_IMPORT_TOO_LARGE')
    expect(listening.session.value?.samples).toHaveLength(32)
  })

  it('bounds private draft input and leaves other project recovery untouched', () => {
    writeVoiceListeningDraft(localStorage, 'project-A', '{"draft":true}')
    expect(() => writeVoiceListeningDraft(localStorage, 'project-B', 'x'.repeat(512 * 1024 + 1))).toThrow('TOO_LARGE')
    expect(readVoiceListeningDraft(localStorage, 'project-A')).toBe('{"draft":true}')
    expect(readVoiceListeningDraft(localStorage, 'project-B')).toBeNull()
  })

  it('invalidates prior playback and human claims when dictionary or profile changes even if candidates were already stale', async () => {
    const current = shallowRef(snapshot)
    const listening = host(() => current.value)
    listening.create()
    const sampleId = listening.session.value!.samples[0]!.id
    listening.updateReview({ scores: { naturalness: 4 } })
    listening.record(sampleId, { fromSeconds: 0, toSeconds: 1, rate: 1, durationSeconds: 1, ended: true, provenance: 'browser-observed' })
    listening.session.value = { ...listening.session.value!, humanConfirmed: true, provenance: 'human-attested' }
    current.value = { ...snapshot, revision: 'dictionary-changed' }
    await flushPromises()
    expect(listening.session.value!.humanConfirmed).toBe(false)
    expect(listening.session.value!.samples[0]!.plays).toEqual([])
    expect(listening.session.value!.samples[0]!.scores.naturalness).toBe(4)
    listening.record(sampleId, { fromSeconds: 0, toSeconds: 1, rate: 1, durationSeconds: 1, ended: true, provenance: 'browser-observed' })
    state.project.project.compilation.project.characters[0].voiceProfile.intent.speakingStyle = '更快的当前目标'
    await flushPromises()
    expect(listening.session.value!.samples[0]!.plays).toEqual([])
    expect(listening.session.value!.humanConfirmed).toBe(false)
    expect(listening.targetIntent.value).toContain('更快的当前目标')
    expect(state.project.workspace.writeFiles).not.toHaveBeenCalled()
  })

  it('ignores an imported file that finishes after unmount instead of writing into the retired private scope', async () => {
    const listening = host()
    const incoming = createVoiceListeningSession({ projectId: 'portable-native-id', candidates: rows[0]!.takes.map(take => voiceListeningCandidate(rows[0]!, take.id, 1)) })
    let complete!: (content: string) => void
    const pending = listening.restore({ size: 100, text: () => new Promise<string>(done => complete = done) } as File)
    mounted.pop()!.unmount()
    complete(exportVoiceListeningSession(incoming))
    await pending
    expect(listening.session.value).toBeUndefined()
    expect(readVoiceListeningDraft(localStorage, state.drafts.projectId)).toBeNull()
    expect(state.project.workspace.writeFiles).not.toHaveBeenCalled()
  })
})

describe('editor verified listening playback lifecycle', () => {
  it('revokes previous URLs when candidates change and ignores late reads after hiding', async () => {
    const visible = shallowRef(true)
    const player = shallowRef<HTMLAudioElement | null>(document.createElement('audio'))
    let playback!: ReturnType<typeof useVoiceListeningPlayback>
    const wrapper = mount(defineComponent({
      setup() {
        playback = useVoiceListeningPlayback({ catalog: () => snapshot.catalog, visible: () => visible.value, player, observe: vi.fn() })
        return {}
      },
      template: '<div />',
    }))
    mounted.push(wrapper)
    await playback.load('S01', voiceListeningCandidate(rows[0]!, rows[0]!.takes[0]!.id))
    expect(playback.source.value).toBe('blob:listening')
    let complete!: (blob: Blob) => void
    state.project.workspace.readAsset.mockImplementationOnce(() => new Promise<Blob>(done => complete = done))
    const late = playback.load('S02', voiceListeningCandidate(rows[0]!, rows[0]!.takes[1]!.id))
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:listening')
    visible.value = false
    await flushPromises()
    complete(new NodeBlob([bytes]) as unknown as Blob)
    await late
    expect(playback.source.value).toBe('')
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
    expect(player.value!.pause).toHaveBeenCalled()
  })

  it('rejects tampered bytes and credits neither a seek jump nor an untrusted event as human listening', async () => {
    const player = shallowRef<HTMLAudioElement | null>(document.createElement('audio'))
    Object.defineProperties(player.value, { duration: { value: 10, configurable: true }, paused: { value: false, configurable: true } })
    const observations = vi.fn()
    let playback!: ReturnType<typeof useVoiceListeningPlayback>
    const wrapper = mount(defineComponent({
      setup() {
        playback = useVoiceListeningPlayback({ catalog: () => snapshot.catalog, visible: () => true, player: computed(() => player.value), observe: observations })
        return {}
      },
      template: '<div />',
    }))
    mounted.push(wrapper)
    state.project.workspace.readAsset.mockResolvedValueOnce(new NodeBlob(['tampered']) as unknown as Blob)
    await playback.load('S01', voiceListeningCandidate(rows[0]!, rows[0]!.takes[0]!.id))
    expect(playback.error.value).toContain('HASH_MISMATCH')
    expect(URL.createObjectURL).not.toHaveBeenCalled()
    await playback.load('S01', voiceListeningCandidate(rows[0]!, rows[0]!.takes[0]!.id))
    player.value!.src = playback.source.value
    playback.observe(new Event('loadedmetadata'))
    expect(observations).toHaveBeenLastCalledWith('S01', expect.objectContaining({ provenance: 'simulation', durationSeconds: 10 }))
    playback.observe(new Event('playing'))
    player.value!.currentTime = 9
    playback.observe(new Event('timeupdate'))
    expect(observations).toHaveBeenCalledTimes(1)
  })
})
