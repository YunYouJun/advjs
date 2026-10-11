import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import PrintWords from '../../../packages/client/components/animation/PrintWords.vue'

const wrappers: ReturnType<typeof mount>[] = []
beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount())
  vi.useRealTimers()
})

function renderWords() {
  const wrapper = mount(PrintWords, { props: { words: '桃园', typeInterval: 50 } })
  wrappers.push(wrapper)
  return wrapper
}

it('notifies playback once when typing finishes naturally', async () => {
  const wrapper = renderWords()
  await vi.advanceTimersByTimeAsync(200)
  expect(wrapper.emitted('end')).toHaveLength(1)
})

it('notifies playback when the player reveals the remaining text', async () => {
  const wrapper = renderWords()
  await wrapper.setProps({ printed: true })
  expect(wrapper.emitted('end')).toHaveLength(1)
  await vi.advanceTimersByTimeAsync(200)
  expect(wrapper.emitted('end')).toHaveLength(1)
})

it('cancels typing on unmount without advancing an obsolete line', async () => {
  const wrapper = renderWords()
  wrapper.unmount()
  await vi.advanceTimersByTimeAsync(200)
  expect(wrapper.emitted('end')).toBeUndefined()
})

it('removes the active interval immediately on unmount', () => {
  const wrapper = renderWords()
  expect(vi.getTimerCount()).toBe(1)
  wrapper.unmount()
  expect(vi.getTimerCount()).toBe(0)
})

it('restarts on replacement text without leaking the previous timer', async () => {
  const wrapper = renderWords()
  await vi.advanceTimersByTimeAsync(50)
  await wrapper.setProps({ words: 'new line' })
  expect(wrapper.emitted('end')).toBeUndefined()
  await vi.advanceTimersByTimeAsync(400)
  expect(wrapper.emitted('end')).toHaveLength(1)
  expect(vi.getTimerCount()).toBe(0)
})

it('completes already revealed and empty lines once without a timer', async () => {
  const revealed = mount(PrintWords, { props: { words: 'hello', printed: true } })
  const empty = mount(PrintWords, { props: { words: '' } })
  wrappers.push(revealed, empty)
  await vi.advanceTimersByTimeAsync(100)
  expect(revealed.emitted('end')).toHaveLength(1)
  expect(empty.emitted('end')).toHaveLength(1)
  expect(vi.getTimerCount()).toBe(0)
})
