import type { RuntimeNode } from '@advjs/types'
import type { AdvContext } from '../../../packages/client/types'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { effectScope, nextTick, shallowRef } from 'vue'
import PrintWords from '../../../packages/client/components/animation/PrintWords.vue'
import AdvDialogBox from '../../../packages/client/components/internals/dialog/AdvDialogBox.vue'
import { useAdvAuto } from '../../../packages/client/composables/useAdvAuto'

const current = shallowRef<RuntimeNode>()
const next = vi.fn().mockResolvedValue(undefined)
const adv = {
  store: { get current() { return current.value }, state: { status: 'playing' } },
  runtime: { next },
  config: shallowRef({ showCharacterAvatar: false, cdn: { enable: false } }),
  gameConfig: shallowRef({ characters: [] }),
  $auto: undefined as unknown as ReturnType<typeof useAdvAuto>,
}
const settings = { storage: { speech: false, text: { curSpeed: 'normal', curFontSize: 'normal', curDisplayMode: 'type' } } }
vi.mock('@advjs/client', () => ({
  speak: vi.fn(),
  useAdvContext: () => ({ $adv: adv }),
  useSettingsStore: () => settings,
}))

let scope: ReturnType<typeof effectScope>
let wrapper: ReturnType<typeof mount>
beforeEach(() => {
  vi.useFakeTimers()
  next.mockClear()
  localStorage.clear()
  current.value = { id: 'line', kind: 'text', data: { text: '重来' } }
  scope = effectScope()
  adv.$auto = scope.run(() => useAdvAuto(adv as unknown as AdvContext))!
})
afterEach(() => {
  wrapper?.unmount()
  scope.stop()
  vi.useRealTimers()
})

it.each(['line', 'another-line'])('restarts identical text after restoring node %s and completes playback again', async (id) => {
  wrapper = mount(AdvDialogBox, { props: { node: current.value! }, global: { components: { PrintWords } } })
  const original = wrapper.getComponent(PrintWords)
  expect(original.props('mode')).toBe('type')
  await wrapper.trigger('click')
  expect(original.emitted('end')).toHaveLength(1)
  adv.$auto.toggle()
  await vi.advanceTimersByTimeAsync(500)

  // Runtime restoration synchronizes a fresh node object, even at the same cursor.
  current.value = { id, kind: 'text', data: { text: '重来' } }
  await wrapper.setProps({ node: current.value })
  await nextTick()
  const restored = wrapper.getComponent(PrintWords)
  expect(restored.vm === original.vm).toBe(false)
  expect(restored.props('printed')).toBe(false)
  expect(restored.emitted('end')).toBeUndefined()
  await vi.advanceTimersByTimeAsync(99)
  expect(restored.emitted('end')).toBeUndefined()
  await vi.advanceTimersByTimeAsync(1)
  expect(restored.emitted('end')).toHaveLength(1)
  await vi.advanceTimersByTimeAsync(1999)
  expect(next).not.toHaveBeenCalled()
  await vi.advanceTimersByTimeAsync(1)
  expect(next).toHaveBeenCalledOnce()
})
