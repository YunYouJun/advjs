import { createPinia } from 'pinia'
import { afterEach, describe, expect, it } from 'vitest'
import { effectScope, nextTick } from 'vue'
import { useAudioStore } from '../../../packages/client/stores/audio'

const scopes: ReturnType<typeof effectScope>[] = []
function store() {
  const scope = effectScope()
  scopes.push(scope)
  return scope.run(() => useAudioStore(createPinia()))!
}
afterEach(() => {
  scopes.splice(0).forEach(scope => scope.stop())
  localStorage.clear()
})

describe('device audio settings', () => {
  it('persists each bus independently and resets to project defaults', async () => {
    const first = store()
    first.setBus('voice', { gain: 0.8 })
    first.setBus('music', { gain: 0.2, muted: true })
    first.setBus('master', { muted: true })
    first.setBus('master', { muted: false })
    await nextTick()
    const next = store()
    expect(next.settings.buses?.voice?.gain).toBe(0.8)
    expect(next.settings.buses?.music).toEqual({ gain: 0.2, muted: true })
    expect(next.settings.buses?.master?.muted).toBe(false)
    expect(localStorage.getItem('advjs:audio:v1')).not.toContain('stage')
    next.reset()
    await nextTick()
    expect(next.settings).toEqual({})
  })

  it('rejects invalid controls and discards malformed persisted preferences', () => {
    localStorage.setItem('advjs:audio:v1', '{"buses":{"voice":{"gain":3}}}')
    const audio = store()
    expect(audio.settings).toEqual({})
    expect(() => audio.setBus('voice', { gain: Number.NaN })).toThrow()
    expect(audio.settings).toEqual({})
  })
})
