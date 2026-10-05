import type { RuntimeNode } from '@advjs/types'
import type { AdvContext } from '../../packages/client/types'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { effectScope, nextTick, shallowRef } from 'vue'
import { useAdvAuto } from '../../packages/client/composables/useAdvAuto'

const scopes: ReturnType<typeof effectScope>[] = []
beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers()
})
afterEach(() => {
  scopes.splice(0).forEach(scope => scope.stop())
  vi.useRealTimers()
})

function createPlayback() {
  const current = shallowRef({ id: 'opening', kind: 'text' } as RuntimeNode)
  const next = vi.fn()
  const scope = effectScope()
  scopes.push(scope)
  const auto = scope.run(() => useAdvAuto({
    store: { get current() { return current.value } },
    runtime: { next },
  } as unknown as AdvContext))!
  return { auto, current, next, scope }
}

it('starts auto-play when enabled after a line has finished', async () => {
  const { auto, next } = createPlayback()
  auto.notifyPrintDone()
  auto.toggle()
  await vi.advanceTimersByTimeAsync(1999)
  expect(next).not.toHaveBeenCalled()
  await vi.advanceTimersByTimeAsync(1)
  expect(next).toHaveBeenCalledOnce()
})

it('waits for the new line to finish before advancing again', async () => {
  const { auto, current, next } = createPlayback()
  auto.toggle()
  await vi.advanceTimersByTimeAsync(3000)
  expect(next).not.toHaveBeenCalled()
  auto.notifyPrintDone()
  await vi.advanceTimersByTimeAsync(2000)
  expect(next).toHaveBeenCalledOnce()
  current.value = { id: 'second', kind: 'dialog' } as RuntimeNode
  await vi.advanceTimersByTimeAsync(3000)
  expect(next).toHaveBeenCalledOnce()
  auto.notifyPrintDone()
  await vi.advanceTimersByTimeAsync(2000)
  expect(next).toHaveBeenCalledTimes(2)
})

it('starts skip immediately and stops at a choice', async () => {
  const { auto, current, next } = createPlayback()
  auto.toggleSkip()
  await vi.advanceTimersByTimeAsync(80)
  expect(next).toHaveBeenCalledOnce()
  current.value = { id: 'second', kind: 'text' } as RuntimeNode
  await vi.advanceTimersByTimeAsync(80)
  expect(next).toHaveBeenCalledTimes(2)
  current.value = { id: 'decision', kind: 'choices' } as RuntimeNode
  await vi.advanceTimersByTimeAsync(2000)
  expect(next).toHaveBeenCalledTimes(2)
  expect(auto.skipEnabled.value).toBe(false)
  expect(auto.enabled.value).toBe(false)
})

it('cancels pending advancement when stopped or disposed', async () => {
  const { auto, next, scope } = createPlayback()
  auto.notifyPrintDone()
  auto.toggle()
  await nextTick()
  auto.toggle()
  await vi.advanceTimersByTimeAsync(2000)
  expect(next).not.toHaveBeenCalled()
  auto.toggleSkip()
  await nextTick()
  scope.stop()
  await vi.advanceTimersByTimeAsync(2000)
  expect(next).not.toHaveBeenCalled()
})

it('switches modes without leaving the old auto timer running', async () => {
  const { auto, next } = createPlayback()
  auto.notifyPrintDone()
  auto.toggle()
  await vi.advanceTimersByTimeAsync(1000)
  auto.toggleSkip()
  await vi.advanceTimersByTimeAsync(1000)
  expect(auto.enabled.value).toBe(false)
  expect(auto.skipEnabled.value).toBe(true)
  expect(next).toHaveBeenCalledOnce()
})
