import type { RuntimeNode } from '@advjs/types'
import type { AdvContext } from '../../../packages/client/types'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { effectScope, nextTick, shallowRef } from 'vue'
import AdvBlack from '../../../packages/client/components/adv/AdvBlack.vue'
import PrintWords from '../../../packages/client/components/animation/PrintWords.vue'
import { useAdvAuto } from '../../../packages/client/composables/useAdvAuto'

const { next, notifyPrintDone } = vi.hoisted(() => ({ next: vi.fn(), notifyPrintDone: vi.fn() }))
vi.mock('@advjs/client', () => ({
  useAdvContext: () => ({ $adv: { runtime: { next }, $auto: { notifyPrintDone } } }),
  useSettingsStore: () => ({ storage: { text: { curFontSize: 'normal' } } }),
}))

let wrapper: ReturnType<typeof mount>
beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
})
afterEach(() => {
  wrapper?.unmount()
  vi.useRealTimers()
})

function node(text: string): RuntimeNode {
  return { id: 'narration', kind: 'narration', data: { text } }
}

function render(text: string) {
  wrapper = mount(AdvBlack, { props: { node: node(text) }, global: { components: { PrintWords } } })
  return wrapper
}

it('waits for all staggered sentences, including empty lines, before notifying once', async () => {
  render('AB\n\nCDE')
  await nextTick()
  // Three visual rows remain present even before their typing begins.
  expect(wrapper.findAll('.print-words')).toHaveLength(3)
  expect(notifyPrintDone).not.toHaveBeenCalled()
  await vi.advanceTimersByTimeAsync(100)
  expect(wrapper.findAllComponents(PrintWords)).toHaveLength(1)
  expect(wrapper.getComponent(PrintWords).emitted('end')).toHaveLength(1)
  expect(notifyPrintDone).not.toHaveBeenCalled()
  await vi.advanceTimersByTimeAsync(50)
  expect(wrapper.findAllComponents(PrintWords)).toHaveLength(2)
  expect(notifyPrintDone).not.toHaveBeenCalled()
  await vi.advanceTimersByTimeAsync(50)
  expect(wrapper.findAllComponents(PrintWords)).toHaveLength(3)
  await vi.advanceTimersByTimeAsync(149)
  expect(notifyPrintDone).not.toHaveBeenCalled()
  await vi.advanceTimersByTimeAsync(1)
  expect(notifyPrintDone).toHaveBeenCalledOnce()
  await vi.advanceTimersByTimeAsync(5000)
  expect(notifyPrintDone).toHaveBeenCalledOnce()
  expect(vi.getTimerCount()).toBe(0)
})

it('manually reveals every pending sentence and only advances on the next click', async () => {
  render('ABCD\n\nEFGH')
  await vi.advanceTimersByTimeAsync(50)
  await wrapper.trigger('click')
  expect(wrapper.findAllComponents(PrintWords)).toHaveLength(3)
  expect(wrapper.findAll('.invisible')).toHaveLength(0)
  expect(notifyPrintDone).toHaveBeenCalledOnce()
  expect(next).not.toHaveBeenCalled()
  expect(vi.getTimerCount()).toBe(0)
  await vi.advanceTimersByTimeAsync(5000)
  expect(notifyPrintDone).toHaveBeenCalledOnce()
  await wrapper.trigger('click')
  expect(next).toHaveBeenCalledOnce()
})

it('can reveal everything before the first sentence starts', async () => {
  render('first\nsecond')
  await wrapper.trigger('click')
  expect(wrapper.findAllComponents(PrintWords)).toHaveLength(2)
  expect(wrapper.findAll('.invisible')).toHaveLength(0)
  expect(notifyPrintDone).toHaveBeenCalledOnce()
  expect(vi.getTimerCount()).toBe(0)
})

it.each(['', '\n\n'])('completes an empty narration %j exactly once', async (text) => {
  render(text)
  await vi.advanceTimersByTimeAsync(100)
  expect(notifyPrintDone).toHaveBeenCalledOnce()
  expect(vi.getTimerCount()).toBe(0)
})

it('cancels both active typing and pending sentence starts on unmount', async () => {
  render('first\nsecond')
  await vi.advanceTimersByTimeAsync(50)
  expect(vi.getTimerCount()).toBeGreaterThan(0)
  wrapper.unmount()
  expect(vi.getTimerCount()).toBe(0)
  await vi.advanceTimersByTimeAsync(5000)
  expect(notifyPrintDone).not.toHaveBeenCalled()
})

it('restarts a restored same-node narration and ignores the old sentence timers', async () => {
  render('AB\nCDEFG')
  await vi.advanceTimersByTimeAsync(175)
  await wrapper.setProps({ node: node('AB\nCDEFG') })
  await vi.advanceTimersByTimeAsync(399)
  expect(notifyPrintDone).not.toHaveBeenCalled()
  await vi.advanceTimersByTimeAsync(1)
  expect(notifyPrintDone).toHaveBeenCalledOnce()
  expect(vi.getTimerCount()).toBe(0)
})

it('starts the auto delay only after the whole narration has finished', async () => {
  const scope = effectScope()
  const auto = scope.run(() => useAdvAuto({
    store: { current: node('AB\n\nCDE'), state: { status: 'playing' } },
    runtime: { next },
    $audio: { voicePlaying: shallowRef(false), stopVoice: vi.fn() },
  } as unknown as AdvContext))!
  next.mockResolvedValue(undefined)
  auto.delay.value = 2000
  notifyPrintDone.mockImplementation(auto.notifyPrintDone)
  try {
    auto.toggle()
    render('AB\n\nCDE')
    await vi.advanceTimersByTimeAsync(2349)
    expect(notifyPrintDone).toHaveBeenCalledOnce()
    expect(next).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(next).toHaveBeenCalledOnce()
  }
  finally {
    scope.stop()
    notifyPrintDone.mockReset()
  }
})
