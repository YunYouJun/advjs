import type { VoiceAlignment } from '@advjs/types'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AEVoiceTranscript from '../../../editor/core/app/components/panel/audio/AEVoiceTranscript.vue'
import PrintWords from '../../../packages/client/components/animation/PrintWords.vue'

const alignment: VoiceAlignment = { schemaVersion: 1, text: '你好，世界。', audioSha256: 'a'.repeat(64), durationSeconds: 1.5, engine: 'fixture', model: 'fixture', units: [{ start: 0, end: 1, startTime: 0.1, endTime: 0.3 }, { start: 3, end: 4, startTime: 0.8, endTime: 1 }] }

describe('voice transcript rendering', () => {
  it('moves with the actual media time, clears on pauses between words and handles seeks', async () => {
    const wrapper = mount(AEVoiceTranscript, { props: { text: alignment.text, alignment, time: 0.2 } })
    expect(wrapper.find('[data-voice-active]').text()).toBe('你')
    await wrapper.setProps({ time: 0.85 })
    expect(wrapper.find('[data-voice-active]').text()).toBe('世')
    await wrapper.setProps({ time: 0.6 })
    expect(wrapper.findAll('[data-voice-active]')).toHaveLength(0)
    await wrapper.setProps({ time: 0.2 })
    expect(wrapper.find('[data-voice-active]').text()).toBe('你')
    await wrapper.setProps({ text: '已修改台词' })
    expect(wrapper.findAll('[data-voice-active]')).toHaveLength(0)
    wrapper.unmount()
  })
  it('highlights the existing player text even when typing is disabled, without replacing its content', () => {
    const wrapper = mount(PrintWords, { props: { words: alignment.text, animation: false, highlight: { text: alignment.text, unit: alignment.units[0] } } })
    expect(wrapper.text()).toBe(alignment.text)
    expect(wrapper.find('[data-voice-active]').text()).toBe('你')
    wrapper.unmount()
  })
  it('highlights one character within a glossary button while preserving its interaction', async () => {
    const reference = { identifier: 'world', label: '世界', definition: 'A glossary term', start: 3, end: 5 }
    const wrapper = mount(PrintWords, { props: { words: alignment.text, animation: false, glossary: [reference], highlight: { text: alignment.text, unit: alignment.units[1] } } })
    const button = wrapper.find('button')
    expect(button.text()).toBe('世界')
    expect(button.find('[data-voice-active]').text()).toBe('世')
    await button.trigger('click')
    expect(wrapper.emitted('glossary')).toHaveLength(1)
    wrapper.unmount()
  })
})
