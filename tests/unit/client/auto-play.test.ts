import type { RuntimeNode } from '@advjs/types'
import type { AdvContext } from '../../../packages/client/types'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { effectScope, nextTick, shallowRef } from 'vue'
import { useAdvAuto } from '../../../packages/client/composables/useAdvAuto'

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
  const next = vi.fn().mockResolvedValue(undefined)
  const state = shallowRef({ status: 'playing' })
  const voicePlaying = shallowRef(false)
  const stopVoice = vi.fn(() => {
    voicePlaying.value = false
  })
  const scope = effectScope()
  scopes.push(scope)
  const auto = scope.run(() => useAdvAuto({
    store: {
      get current() { return current.value },
      get state() { return state.value },
    },
    runtime: { next },
    $audio: { voicePlaying, stopVoice },
  } as unknown as AdvContext))!
  return { auto, current, next, scope, state, voicePlaying, stopVoice }
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

it('cancels an actually scheduled timer on scope disposal', async () => {
  const { auto, next, scope } = createPlayback()
  auto.toggle()
  auto.notifyPrintDone()
  scope.stop()
  await vi.advanceTimersByTimeAsync(2000)
  expect(next).not.toHaveBeenCalled()
})
it('disables skip at a choice after it was already advancing', async () => {
  const { auto, current } = createPlayback()
  auto.toggleSkip()
  auto.notifyPrintDone()
  current.value = { id: 'choice', kind: 'choices' } as RuntimeNode
  await nextTick()
  expect(auto.skipEnabled.value).toBe(false)
})

it.each(['auto', 'skip'] as const)('pauses %s during menus and resumes after closing', async (mode) => {
  const { auto, next } = createPlayback()
  auto.notifyPrintDone()
  if (mode === 'auto')
    auto.toggle()
  else
    auto.toggleSkip()
  auto.paused.value = true
  await vi.advanceTimersByTimeAsync(3000)
  expect(next).not.toHaveBeenCalled()
  auto.paused.value = false
  await vi.advanceTimersByTimeAsync(mode === 'auto' ? 2000 : 80)
  expect(next).toHaveBeenCalledOnce()
})

it.each(['waiting-choice', 'waiting-activity', 'ended', 'error'])('halts at runtime status %s', async (status) => {
  const { auto, next, state } = createPlayback()
  auto.toggleSkip()
  state.value = { status }
  await vi.advanceTimersByTimeAsync(3000)
  expect(next).not.toHaveBeenCalled()
  expect(auto.skipEnabled.value).toBe(false)
})

it('stops both modes and pending timers on player teardown', async () => {
  const { auto, next } = createPlayback()
  auto.toggleSkip()
  expect(vi.getTimerCount()).toBeGreaterThan(0)
  auto.stop()
  await vi.advanceTimersByTimeAsync(3000)
  expect(next).not.toHaveBeenCalled()
  expect(auto.skipEnabled.value).toBe(false)
  expect(auto.enabled.value).toBe(false)
})

it('stops safely when runtime advancement rejects', async () => {
  const { auto, next } = createPlayback()
  const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
  next.mockRejectedValueOnce(new Error('runtime failed'))
  auto.toggleSkip()
  await vi.advanceTimersByTimeAsync(80)
  expect(auto.skipEnabled.value).toBe(false)
  expect(warning).toHaveBeenCalledOnce()
  warning.mockRestore()
})
