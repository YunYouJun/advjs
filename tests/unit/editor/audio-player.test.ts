import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AEAudioPlayer from '../../../editor/core/app/components/panel/audio/AEAudioPlayer.vue'
import { mockResizeObserver } from '../../helpers/resize-observer'

vi.mock('@vueuse/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@vueuse/core')>()
  const { ref } = await import('vue')
  return { ...actual, useElementSize: () => ({ width: ref(640), height: ref(200) }) }
})

let wrapper: ReturnType<typeof mount>
let play: ReturnType<typeof vi.spyOn>
let pause: ReturnType<typeof vi.spyOn>
function paused(audio: HTMLMediaElement, value: boolean) {
  Object.defineProperty(audio, 'paused', { configurable: true, value })
  audio.dispatchEvent(new Event(value ? 'pause' : 'play'))
}
beforeEach(() => {
  mockResizeObserver()
  play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function () {
    paused(this, false)
    return Promise.resolve()
  })
  pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(function () {
    paused(this, true)
  })
})
afterEach(() => {
  wrapper?.unmount()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
async function player(autoplay = false) {
  wrapper = mount(AEAudioPlayer, { props: { src: '/voice.wav', label: '配音试听', autoplay } })
  await flushPromises()
  const audio = wrapper.get('audio').element as HTMLAudioElement
  Object.defineProperty(audio, 'duration', { configurable: true, value: 60 })
  await wrapper.get('audio').trigger('loadedmetadata')
  return audio
}

describe('shared audio player', () => {
  it('keeps loading separate from explicit playback and follows the actual media clock', async () => {
    const audio = await player()
    expect(play).not.toHaveBeenCalled()
    await wrapper.get('[aria-label="播放配音试听"]').trigger('click')
    await flushPromises()
    expect(play).toHaveBeenCalledOnce()
    expect(wrapper.find('[aria-label="暂停配音试听"]').exists()).toBe(true)
    audio.currentTime = 12.4
    await wrapper.get('audio').trigger('timeupdate')
    expect(wrapper.text()).toContain('0:12')
    expect(wrapper.emitted('timeupdate')?.at(-1)).toEqual([12.4])
    await wrapper.get('[aria-label="暂停配音试听"]').trigger('click')
    expect(audio.paused).toBe(true)
  })
  it('seeks with keyboard Home/End and clamps five-second skips at media boundaries', async () => {
    const audio = await player()
    const seek = wrapper.get('[role="slider"][aria-label="配音试听播放进度（秒）"]')
    await seek.trigger('keydown', { key: 'End' })
    expect(audio.currentTime).toBe(60)
    await wrapper.get('[aria-label="配音试听前进5秒"]').trigger('click')
    expect(audio.currentTime).toBe(60)
    await seek.trigger('keydown', { key: 'Home' })
    await wrapper.get('[aria-label="配音试听后退5秒"]').trigger('click')
    expect(audio.currentTime).toBe(0)
  })
  it('tracks real mute and end events and releases playback on unmount', async () => {
    const audio = await player(true)
    expect(play).toHaveBeenCalledOnce()
    await wrapper.get('[aria-label="静音配音试听"]').trigger('click')
    expect(audio.muted).toBe(true)
    expect(wrapper.get('[aria-label="取消静音配音试听"]').attributes('aria-pressed')).toBe('true')
    await wrapper.get('[aria-label="取消静音配音试听"]').trigger('click')
    const volume = wrapper.get('[role="slider"][aria-label="配音试听音量"]')
    await volume.trigger('keydown', { key: 'Home' })
    expect(audio.volume).toBe(0)
    await volume.trigger('keydown', { key: 'End' })
    expect(audio.volume).toBe(1)
    paused(audio, true)
    audio.currentTime = 60
    await wrapper.get('audio').trigger('ended')
    expect(wrapper.find('[aria-label="播放配音试听"]').exists()).toBe(true)
    const before = pause.mock.calls.length
    wrapper.unmount()
    expect(pause.mock.calls.length).toBeGreaterThan(before)
  })
  it('ignores a stale play rejection after replacing the source', async () => {
    await player()
    let reject!: (error: Error) => void
    play.mockImplementation(() => new Promise<void>((_resolve, no) => reject = no))
    await wrapper.get('[aria-label="播放配音试听"]').trigger('click')
    await wrapper.setProps({ src: '/replacement.wav' })
    reject(new DOMException('Old source stopped', 'AbortError'))
    await flushPromises()
    expect(wrapper.find('[role="status"]').exists()).toBe(false)
    expect(wrapper.get('audio').attributes('src')).toBe('/replacement.wav')
  })
})
