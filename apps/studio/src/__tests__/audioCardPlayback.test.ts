import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AudioCard from '../components/AudioCard.vue'

vi.mock('../composables/useProjectContent', () => ({ useProjectContent: () => ({ getFs: () => null }) }))
afterEach(() => vi.restoreAllMocks())

describe('audio preview lifecycle', () => {
  it('pauses a cached Ionic page preview when leaving and again before unmount', async () => {
    const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
    const wrapper = mount(AudioCard, {
      props: { audio: { file: 'calm.md', name: 'Calm', src: 'data:audio/wav;base64,UklGRg==' }, active: true },
      global: { mocks: { $t: (key: string) => key } },
    })
    expect(wrapper.find('audio').exists()).toBe(true)
    await wrapper.setProps({ active: false })
    expect(pause).toHaveBeenCalledTimes(1)
    await wrapper.setProps({ active: true })
    expect(pause).toHaveBeenCalledTimes(1)
    wrapper.unmount()
    expect(pause).toHaveBeenCalledTimes(2)
  })
})
