import { DOMWrapper, flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, reactive } from 'vue'
import AEAudioVolume from '../../../editor/core/app/components/panel/audio/AEAudioVolume.vue'
import { mockResizeObserver } from '../../helpers/resize-observer'

let wrapper: ReturnType<typeof mount>
const body = new DOMWrapper(document.body)
beforeEach(() => mockResizeObserver())
afterEach(() => {
  wrapper?.unmount()
  document.body.innerHTML = ''
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
function volume() {
  const state = reactive({ volume: 0.65, muted: false, compact: true, resetKey: 'first' })
  const change = vi.fn((value: number) => {
    state.volume = value
    state.muted = false
  })
  const mute = vi.fn(() => state.muted = !state.muted)
  wrapper = mount(defineComponent({ setup: () => () => h(AEAudioVolume, { ...state, label: '试听', onVolume: change, onMute: mute }) }), { attachTo: document.body })
  return { state, change, mute }
}
async function open() {
  await wrapper.get('[data-testid="player-volume-trigger"]').trigger('click')
  await flushPromises()
  return body.get('[role="dialog"][aria-label="试听音量设置"]')
}

describe('responsive audio volume', () => {
  it('opens without muting and adjusts the same controlled volume with vertical keyboard steps', async () => {
    const { state, change, mute } = volume()
    expect(wrapper.find('[role="slider"]').exists()).toBe(false)
    const panel = await open()
    expect(mute).not.toHaveBeenCalled()
    const slider = panel.get('[role="slider"]')
    expect(slider.attributes('aria-orientation')).toBe('vertical')
    expect(slider.attributes('aria-valuetext')).toBe('65%')
    await slider.trigger('keydown', { key: 'ArrowUp' })
    expect(change).toHaveBeenLastCalledWith(0.66)
    expect(state.volume).toBe(0.66)
    await panel.get('[aria-label="静音试听"]').trigger('click')
    expect(state.muted).toBe(true)
    expect(state.volume).toBe(0.66)
    await panel.get('[aria-label="取消静音试听"]').trigger('click')
    expect(state.muted).toBe(false)
    expect(slider.attributes('aria-valuetext')).toBe('66%')
  })

  it('closes on layout change and moves an owned focus to the replacement mute button without changing volume', async () => {
    const { state, change, mute } = volume()
    const panel = await open()
    ;(panel.get('[role="slider"]').element as HTMLElement).focus()
    state.compact = false
    await flushPromises()
    await vi.waitFor(() => expect(body.find('[role="dialog"]').exists()).toBe(false))
    const button = wrapper.get('[aria-label="静音试听"]').element
    expect(document.activeElement).toBe(button)
    expect(wrapper.get('[role="slider"]').attributes('aria-orientation')).toBe('horizontal')
    expect(state.volume).toBe(0.65)
    expect(change).not.toHaveBeenCalled()
    expect(mute).not.toHaveBeenCalled()
  })

  it('leaves unrelated focus alone when resizing and closes a source-bound popup on replacement', async () => {
    const { state, change } = volume()
    const other = document.createElement('button')
    document.body.append(other)
    other.focus()
    state.compact = false
    await flushPromises()
    expect(document.activeElement).toBe(other)
    state.compact = true
    await flushPromises()
    await open()
    state.resetKey = 'replacement'
    await flushPromises()
    await vi.waitFor(() => expect(body.find('[role="dialog"]').exists()).toBe(false))
    expect(state.volume).toBe(0.65)
    expect(change).not.toHaveBeenCalled()
  })
})
