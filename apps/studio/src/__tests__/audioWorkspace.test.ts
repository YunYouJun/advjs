import type { VoiceAuthoringSnapshot } from '@advjs/types'
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'
import AudioAssetForm from '../components/audio/AudioAssetForm.vue'
import AudioMixerPanel from '../components/audio/AudioMixerPanel.vue'
import AudioVoiceReview from '../components/audio/AudioVoiceReview.vue'
import SSelect from '../components/ui/SSelect.vue'
import zh from '../i18n/locales/zh-CN.json'
import { filterStudioAudioAssets, isLedgerAudioAsset, studioVoiceReviewRows } from '../utils/audioWorkspace'

function snapshot(): VoiceAuthoringSnapshot {
  const lineId = 'line_01900400-0000-7000-8000-000000000001'
  function take(suffix: string, spokenText: string) {
    return { id: `take_01900400-0000-7000-8000-00000000000${suffix}`, assetId: `audio_01900400-0000-7000-8000-00000000000${suffix}`, sha256: 'a'.repeat(64), providerId: 'test-native', voiceId: 'voice-reviewed', model: 'fixture-model', voiceProfileRevision: 'b'.repeat(64), inputFingerprint: 'c'.repeat(64), spokenText, createdAt: '2026-10-11T10:00:00.000Z', source: 'system' as const }
  }
  const selected = take('1', '欢迎来到海边。')
  const history = take('2', '早先的文本。')
  const english = take('3', 'Welcome to the seaside.')
  return {
    revision: 'd'.repeat(64),
    ledger: { schemaVersion: 1, lines: { [lineId]: { speakerId: 'hero', displayText: '欢迎来到海边。', locales: { 'zh-CN': { selectedTake: selected.id, takes: [selected, history] }, 'en': { displayText: english.spokenText, selectedTake: null, takes: [english] } } } } },
    catalog: { schemaVersion: 2, id: 'fixture', defaultProfile: 'local', profiles: { local: { provider: 'project', root: 'adv/assets' } }, assets: [selected, history, english].map(take => ({ id: take.assetId, type: 'audio', kind: 'voice', sha256: take.sha256, path: `audio/${take.assetId}.wav` })) },
  }
}

function i18n() {
  return createI18n({ legacy: false, locale: 'zh-CN', messages: { 'zh-CN': zh } })
}

describe('studio native audio review', () => {
  it('requires an author to classify unknown legacy audio before saving and preserves known classifications', async () => {
    const wrapper = mount(AudioAssetForm, { props: { asset: { id: 'legacy/cue', type: 'audio', kind: 'audio', path: 'cue.wav' }, busy: false }, global: { plugins: [i18n()] } })
    const select = wrapper.findComponent(SSelect)
    expect(select.props('modelValue')).toBeUndefined()
    expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBeDefined()
    await wrapper.find('form').trigger('submit')
    expect(wrapper.emitted('save')).toBeUndefined()
    select.vm.$emit('update:modelValue', 'reference')
    await wrapper.vm.$nextTick()
    await wrapper.find('form').trigger('submit')
    expect(wrapper.emitted('save')![0]![0]).toMatchObject({ kind: 'reference' })
    await wrapper.setProps({ asset: { id: 'bgm/day', type: 'audio', kind: 'bgm', path: 'day.wav' } })
    expect(select.props('modelValue')).toBe('bgm')
    await wrapper.find('form').trigger('submit')
    expect(wrapper.emitted('save')![1]![0]).toMatchObject({ kind: 'bgm' })
    await wrapper.setProps({ asset: undefined })
    expect(select.props('modelValue')).toBeUndefined()
    await wrapper.find('form').trigger('submit')
    expect(wrapper.emitted('save')).toHaveLength(2)
    wrapper.unmount()
  })

  it('exposes selected and unselected history across locales without rewriting the ledger', async () => {
    const source = snapshot()
    const original = JSON.stringify(source)
    const rows = await studioVoiceReviewRows(source)
    expect(rows.map(row => row.locale)).toEqual(['zh-CN', 'en'])
    expect(rows[0]!.takes.map(take => [take.selected, take.stale, take.unavailable])).toEqual([[true, false, false], [false, true, false]])
    expect(rows[1]!.selectedTake).toBeNull()
    expect(isLedgerAudioAsset(source, rows[0]!.takes[1]!.assetId)).toBe(true)
    expect(JSON.stringify(source)).toBe(original)
    source.catalog.assets[1]!.sha256 = 'f'.repeat(64)
    expect((await studioVoiceReviewRows(source))[0]!.takes[1]!.unavailable).toBe(true)
  })

  it('requires an explicit bind/replace/clear action and filters by locale', async () => {
    const source = snapshot()
    const wrapper = mount(AudioVoiceReview, { props: { snapshot: source, busy: false, verifyRetained: async () => true }, global: { plugins: [i18n()] } })
    await flushPromises()
    expect(wrapper.emitted('select')).toBeUndefined()
    const replace = wrapper.findAll('button').find(button => button.text() === '替换已选配音')!
    await replace.trigger('click')
    expect(wrapper.emitted('select')).toBeUndefined()
    await wrapper.find('.voice-review__confirmation input').setValue(true)
    await wrapper.findAll('button').find(button => button.text() === '确认采用')!.trigger('click')
    expect(wrapper.emitted('select')![0]).toEqual([Object.keys(source.ledger.lines)[0], 'zh-CN', Object.values(source.ledger.lines)[0]!.locales['zh-CN']!.takes[1]!.id, true])
    const clear = wrapper.findAll('button').find(button => button.text() === '清除正式选择')!
    await clear.trigger('click')
    expect(wrapper.emitted('select')![1]).toEqual([Object.keys(source.ledger.lines)[0], 'zh-CN', null, true])
    wrapper.findAllComponents(SSelect)[0]!.vm.$emit('update:modelValue', 'en')
    await wrapper.vm.$nextTick()
    expect(wrapper.findAll('.voice-review__line')).toHaveLength(1)
    expect(wrapper.text()).toContain('Welcome to the seaside.')
    await wrapper.findAll('button').find(button => button.text() === '绑定此 take')!.trigger('click')
    await wrapper.find('.voice-review__confirmation input').setValue(true)
    await wrapper.findAll('button').find(button => button.text() === '确认采用')!.trigger('click')
    expect(wrapper.emitted('select')![2]![3]).toBe(false)
    wrapper.unmount()
  })

  it('keeps non-audio resources outside six-purpose search', () => {
    const source = snapshot()
    source.catalog.assets.push({ id: 'bgm/calm', title: '平静海岸', type: 'audio', kind: 'bgm', labels: ['coast'] }, { id: 'image/coast', type: 'image', kind: 'background', title: '海岸' })
    expect(filterStudioAudioAssets(source.catalog.assets, 'bgm', 'COAST').map(asset => asset.id)).toEqual(['bgm/calm'])
    expect(filterStudioAudioAssets(source.catalog.assets, 'all', '海岸').map(asset => asset.id)).toEqual(['bgm/calm'])
  })

  it('compares actual same-text historical audio and explicitly acknowledges a stale selected recording without rewriting it', async () => {
    const source = snapshot()
    const lineId = Object.keys(source.ledger.lines)[0]!
    const line = source.ledger.lines[lineId]!
    line.displayText = '新的剧情对白。'
    line.locales['zh-CN']!.takes.forEach(take => take.spokenText = '相同的历史声音。')
    const original = JSON.stringify(source)
    const wrapper = mount(AudioVoiceReview, { props: { snapshot: source, busy: false, verifyRetained: async () => true }, global: { plugins: [i18n()] } })
    await flushPromises()
    expect(wrapper.find('[data-testid="studio-advanced-listening"]').exists()).toBe(false)
    await wrapper.findAll('button').find(button => button.text() === '听 A')!.trigger('click')
    expect(wrapper.emitted('preview')![0]!.slice(1, 3)).toEqual(['a'.repeat(64), '相同的历史声音。'])
    await wrapper.findAll('button').find(button => button.text() === '复核并沿用')!.trigger('click')
    expect(wrapper.emitted('select')).toBeUndefined()
    await wrapper.find('.voice-review__confirmation input').setValue(true)
    await wrapper.findAll('button').find(button => button.text() === '确认采用')!.trigger('click')
    expect(wrapper.text()).toContain('本次已复核保留绑定')
    expect(wrapper.findAll('.voice-review__warning').some(node => node.text() === '文本已变化')).toBe(true)
    expect(wrapper.emitted('select')).toBeUndefined()
    expect(JSON.stringify(source)).toBe(original)
    await wrapper.setProps({ context: { lines: [{ lineId, speakerId: 'hero', displayText: '再次改写。' }] } })
    await flushPromises()
    expect(wrapper.text()).not.toContain('本次已复核保留绑定')
    wrapper.unmount()
  })

  it('discards an approved adoption after source/profile review context changes', async () => {
    const source = snapshot()
    const wrapper = mount(AudioVoiceReview, { props: { snapshot: source, busy: false, verifyRetained: async () => true }, global: { plugins: [i18n()] } })
    await flushPromises()
    await wrapper.findAll('button').find(button => button.text() === '替换已选配音')!.trigger('click')
    await wrapper.find('.voice-review__confirmation input').setValue(true)
    await wrapper.setProps({ context: { profiles: { hero: { intent: { speakingStyle: '新的声音风格' } } } } })
    await flushPromises()
    expect(wrapper.find('.voice-review__confirmation').exists()).toBe(false)
    expect(wrapper.emitted('select')).toBeUndefined()
    wrapper.unmount()
  })

  it('does not acknowledge a stale selected take when native immutable media verification fails', async () => {
    const source = snapshot()
    Object.values(source.ledger.lines)[0]!.displayText = '已经改写的对白。'
    const verifyRetained = vi.fn(async () => {
      throw new Error('VOICE_AUDIO_CHANGED')
    })
    const wrapper = mount(AudioVoiceReview, { props: { snapshot: source, busy: false, verifyRetained }, global: { plugins: [i18n()] } })
    await flushPromises()
    await wrapper.findAll('button').find(button => button.text() === '复核并沿用')!.trigger('click')
    await wrapper.find('.voice-review__confirmation input').setValue(true)
    await wrapper.findAll('button').find(button => button.text() === '确认采用')!.trigger('click')
    await flushPromises()
    expect(verifyRetained).toHaveBeenCalledOnce()
    expect(wrapper.text()).not.toContain('本次已复核保留绑定')
    expect(wrapper.emitted('select')).toBeUndefined()
    wrapper.unmount()
  })
})

describe('studio project mixer', () => {
  it('validates defaults before emitting and preserves semantic cues and SFX groups', async () => {
    const mixer = { schemaVersion: 1 as const, buses: { music: { gain: 0.7 } }, sfx: { maxVoices: 8, groups: { footsteps: 2 } }, ui: { confirm: 'ui/confirm' } }
    const wrapper = mount(AudioMixerPanel, { props: { mixer, revision: 'one', busy: false }, global: { plugins: [i18n()] } })
    expect(wrapper.findAll('input[type="range"]')).toHaveLength(6)
    await wrapper.find('#mixer-gain-music').setValue('0.42')
    await wrapper.findAll('input[type="number"]')[1]!.setValue('-1')
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('save')).toBeUndefined()
    expect(wrapper.find('[role="alert"]').text()).toContain('attackMs')
    await wrapper.findAll('input[type="number"]')[1]!.setValue('180')
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('save')![0]![0]).toMatchObject({ buses: { music: { gain: 0.42 } }, ducking: { attackMs: 180 }, sfx: mixer.sfx, ui: mixer.ui })
    expect(mixer.buses.music.gain).toBe(0.7)
    await wrapper.setProps({ revision: 'two', mixer: { schemaVersion: 1, buses: { music: { gain: 0.1 } } } })
    expect((wrapper.find('#mixer-gain-music').element as HTMLInputElement).value).toBe('0.1')
    wrapper.unmount()
  })
})
