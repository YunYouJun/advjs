import type { VoiceListeningCandidate } from '@advjs/audio'
import { attestVoiceListeningSession, createVoiceListeningSession, exportVoiceListeningSession } from '@advjs/audio'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, reactive, shallowRef } from 'vue'
import { createI18n } from 'vue-i18n'
import AudioAdvancedListening from '../components/audio/AudioAdvancedListening.vue'
import AudioListeningEnvironment from '../components/audio/AudioListeningEnvironment.vue'
import SSelect from '../components/ui/SSelect.vue'
import { useStudioVoiceListening } from '../composables/useStudioVoiceListening'
import zh from '../i18n/locales/zh-CN.json'

function candidates(): VoiceListeningCandidate[] {
  return Array.from({ length: 8 }, (_, index) => ({ lineId: `line-${Math.floor(index / 2)}`, locale: 'zh-CN', speakerId: 'hero', takeId: `take-${index}`, assetId: `audio-${index}`, sha256: String(index + 1).repeat(64), spokenText: `同文组 ${Math.floor(index / 2)}`, durationSeconds: 10, stale: false, unavailable: false }))
}
const scopes: ReturnType<typeof effectScope>[] = []
function listening() {
  const scope = effectScope()
  scopes.push(scope)
  const state = reactive({ projectId: 'canonical-project', scopeKey: 'alice/project/fs1', contextRevision: 'source-one', active: true })
  const source = shallowRef(candidates())
  const stop = vi.fn()
  const api = scope.run(() => useStudioVoiceListening({ projectId: () => state.projectId, scopeKey: () => state.scopeKey, contextRevision: () => state.contextRevision, candidates: () => source.value, active: () => state.active, stop }))!
  return { state, source, stop, api }
}
beforeEach(() => localStorage.clear())
afterEach(() => scopes.splice(0).forEach(scope => scope.stop()))
function i18n() {
  return createI18n({ legacy: false, locale: 'zh-CN', messages: { 'zh-CN': zh } })
}

describe('studio shared private listening drafts', () => {
  it('restores eight samples in four groups and keeps drafts isolated by account/project', async () => {
    const host = listening()
    const incoming = attestVoiceListeningSession(createVoiceListeningSession({ projectId: 'canonical-project', candidates: candidates(), random: () => 0.5 }), true)
    incoming.samples[0]!.scores.clarity = 'na'
    incoming.samples[0]!.notes = 'Unit-test draft; no actual listener'
    host.api.restore(exportVoiceListeningSession(incoming))
    expect(host.api.session.value?.samples).toHaveLength(8)
    expect(new Set(host.api.session.value!.samples.map(sample => sample.candidate.lineId)).size).toBe(4)
    expect(host.api.session.value?.humanConfirmed).toBe(false)
    expect(host.api.session.value?.samples.every(sample => !sample.plays.length && !sample.endedCount)).toBe(true)
    expect(host.api.summary.value?.eligibleHumanReview).toBe(false)
    await flushPromises()
    expect(localStorage.getItem('advjs-studio-private-listening-v1:alice%2Fproject%2Ffs1')).toContain('Unit-test draft')
    host.state.scopeKey = 'bob/project/fs1'
    await flushPromises()
    expect(host.api.session.value).toBeUndefined()
    expect(localStorage.getItem('advjs-studio-private-listening-v1:bob%2Fproject%2Ffs1')).toBeNull()
  })

  it('preserves folded drafts but ignores inactive playback and discards stored playback trust', async () => {
    const host = listening()
    host.api.start(host.source.value.slice(0, 2).map(candidate => candidate.takeId))
    const sample = host.api.session.value!.samples[0]!
    host.api.review(sample.id, { notes: 'Simulation only', scores: { clarity: 'na' } })
    host.api.playback({ assetId: sample.candidate.assetId, fromSeconds: 0, toSeconds: 10, durationSeconds: 10, rate: 1, ended: true, provenance: 'simulation' })
    expect(host.api.session.value?.samples[0]?.plays).toHaveLength(1)
    host.api.attest(true)
    expect(host.api.session.value?.humanConfirmed).toBe(false)
    host.state.active = false
    host.api.playback({ assetId: sample.candidate.assetId, fromSeconds: 0, toSeconds: 10, durationSeconds: 10, rate: 1, ended: true })
    expect(host.api.session.value?.samples[0]?.endedCount).toBe(1)
    await flushPromises()
    host.state.active = true
    const second = listening()
    expect(second.api.session.value?.samples[0]?.notes).toBe('Simulation only')
    expect(second.api.session.value?.samples.every(sample => !sample.plays.length && !sample.endedCount)).toBe(true)
    expect(second.api.session.value?.humanConfirmed).toBe(false)
    expect(host.stop).toHaveBeenCalled()
  })

  it('refreshes live stale/profile authority, retains grades and blocks unavailable sources', () => {
    const host = listening()
    host.api.start(host.source.value.slice(0, 2).map(candidate => candidate.takeId))
    const sample = host.api.session.value!.samples[0]!
    host.api.review(sample.id, { notes: 'Preserve draft observation' })
    host.source.value = host.source.value.map(candidate => ({ ...candidate, stale: true }))
    expect(host.api.session.value?.samples.every(sample => sample.candidate.stale)).toBe(true)
    expect(host.api.session.value?.samples[0]?.notes).toBe('Preserve draft observation')
    host.state.contextRevision = 'new-profile'
    expect(host.api.session.value?.humanConfirmed).toBe(false)
    host.source.value = host.source.value.map(candidate => ({ ...candidate, unavailable: true }))
    expect(host.api.invalidated.value).toBe(true)
    expect(host.api.summary.value?.canAttest).toBe(false)
    expect(host.api.error.value).toBe('VOICE_LISTENING_RESTORE_MISMATCH')
  })
})

describe('studio lazy advanced listening UI', () => {
  it('supports eight project samples in anonymous score cards with no native IDs', async () => {
    const all = candidates()
    const wrapper = mount(AudioAdvancedListening, { props: { active: true, candidates: all.slice(0, 2), projectCandidates: all, projectId: 'canonical-project', scopeKey: 'ui/project', contextRevision: 'source' }, global: { plugins: [i18n()] } })
    expect(wrapper.findAll('.advanced-listening__setup input[type="checkbox"]')).toHaveLength(2)
    wrapper.findComponent(SSelect).vm.$emit('update:modelValue', 'project')
    await flushPromises()
    const inputs = wrapper.findAll('.advanced-listening__setup input[type="checkbox"]')
    expect(inputs).toHaveLength(8)
    for (const input of inputs)
      await input.setValue(true)
    await wrapper.findAll('button').find(button => button.text() === '创建匿名听审')!.trigger('click')
    expect(wrapper.findAll('.listening-ratings__sample')).toHaveLength(8)
    expect(wrapper.findAll('.listening-ratings__sample').every(card => !/take-|audio-/u.test(card.text()))).toBe(true)
    expect(wrapper.findAllComponents(SSelect)).toHaveLength(49)
    expect(wrapper.findComponent(AudioListeningEnvironment).props('canAttest')).toBe(false)
    expect(wrapper.text()).toContain('参考一致性请选“不适用”')
    expect(wrapper.emitted('preview')).toBeUndefined()
    wrapper.unmount()
  })

  it('ignores a late JSON read after leaving an Ionic cached page', async () => {
    const all = candidates()
    const wrapper = mount(AudioAdvancedListening, { props: { active: true, candidates: all.slice(0, 2), projectCandidates: all, projectId: 'canonical-project', scopeKey: 'late/project', contextRevision: 'source' }, global: { plugins: [i18n()] } })
    let finish!: (json: string) => void
    const file = { size: 100, text: () => new Promise<string>(resolve => finish = resolve) }
    const input = wrapper.find('input[type="file"]')
    Object.defineProperty(input.element, 'files', { value: [file] })
    await input.trigger('change')
    await wrapper.setProps({ active: false })
    finish(exportVoiceListeningSession(createVoiceListeningSession({ projectId: 'canonical-project', candidates: all })))
    await flushPromises()
    expect(wrapper.findAll('.listening-ratings__sample')).toHaveLength(0)
    expect(localStorage.getItem('advjs-studio-private-listening-v1:late%2Fproject')).toBeNull()
    wrapper.unmount()
  })
})
