import type { AudioMixerConfig, RuntimeAudioState } from '@advjs/types'
import { describe, expect, it, vi } from 'vitest'
import { createAudioEngine } from '../../../packages/audio/src/engine'
import { parseAudioMixerConfig, parseRuntimeAudioState } from '../../../packages/audio/src/schema'
import { createFakeAudioBackend } from '../../../packages/audio/src/testing'

function target(bgm: string | null, ambience: RuntimeAudioState['ambience'] = {}): RuntimeAudioState {
  return { bgm: bgm ? { assetId: bgm } : null, ambience }
}

function setup(options: Parameters<typeof createFakeAudioBackend>[0] = {}, mixer?: AudioMixerConfig) {
  const backend = createFakeAudioBackend(options)
  const engine = createAudioEngine({ backend, mixer, resolveAsset: assetId => ({ assetId, url: `/audio/${assetId}.wav` }) })
  return { backend, engine }
}

describe('shared AudioEngine', () => {
  it('keeps one music target, four independent ambience slots and updates gain without replay', async () => {
    const { engine, backend } = setup()
    await engine.syncState(target('music', { bed: { assetId: 'forest' }, weather: { assetId: 'rain' }, crowd: { assetId: 'birds' }, detail: { assetId: 'insects' } }))
    expect(backend.playbacks).toHaveLength(5)
    expect(engine.inspect().tracks).toHaveLength(5)
    await engine.syncState({ ...engine.inspect().state, bgm: { assetId: 'music', gain: 0 } })
    expect(backend.playbacks).toHaveLength(5)
    expect(backend.playbacks[0]!.gain).toBe(0)
    await engine.syncState(target('music', { bed: { assetId: 'room' }, weather: { assetId: 'rain' } }))
    expect(engine.inspect().tracks.map(track => track.assetId).sort()).toEqual(['music', 'rain', 'room'])
    expect(backend.playbacks.filter(source => !source.stopped)).toHaveLength(3)
    engine.dispose()
  })

  it('drops stale loads in A → B → A and a stop cannot be undone by old fade completion', async () => {
    const { engine, backend } = setup({ deferLoads: true, deferFades: true })
    const a = engine.syncState({ bgm: { assetId: 'a', fadeOutMs: 100 }, ambience: {} })
    await vi.waitFor(() => expect(backend.loads).toHaveLength(1))
    const b = engine.syncState({ bgm: { assetId: 'b', fadeOutMs: 100 }, ambience: {} })
    await vi.waitFor(() => expect(backend.loads).toHaveLength(2))
    const bSource = backend.loads[1]!.complete()
    await b
    const lastA = engine.syncState({ bgm: { assetId: 'a', gain: 0, fadeOutMs: 100 }, ambience: {} })
    await vi.waitFor(() => expect(backend.loads).toHaveLength(3))
    const aSource = backend.loads[2]!.complete()
    await lastA
    const staleA = backend.loads[0]!.complete()
    await a
    expect(staleA.stopped).toBe(true)
    expect(aSource.gain).toBe(0)
    expect(engine.inspect().state.bgm?.assetId).toBe('a')
    await engine.syncState(target(null))
    bSource.fades[0]!.complete()
    expect(aSource.fades).toHaveLength(0)
    await vi.waitFor(() => expect(aSource.stopped).toBe(true))
    await vi.waitFor(() => expect(bSource.stopped).toBe(true))
    expect(engine.inspect().tracks).toHaveLength(0)
    expect(engine.inspect().state.bgm).toBeNull()
    engine.dispose()
  })

  it('supports explicit clear fades and disposes retiring sources during disposal', async () => {
    const { engine, backend } = setup({ deferFades: true })
    await engine.syncState(target('music', { weather: { assetId: 'rain' } }))
    await engine.syncState(target('music'), { fadeOutMs: 700, slot: 'weather' })
    expect(backend.playbacks[1]!.fades[0]?.durationMs).toBe(700)
    expect(backend.playbacks[0]!.stopped).toBe(false)
    engine.dispose()
    expect(backend.playbacks.every(playback => playback.stopped)).toBe(true)
  })

  it('preserves previous retirements while active targets change or stop', async () => {
    const { engine, backend } = setup({ deferFades: true })
    await engine.syncState(target('a'))
    await engine.syncState({ bgm: { assetId: 'b', fadeInMs: 900, fadeOutMs: 650, loop: false }, ambience: {} })
    expect(backend.playbacks[0]!.fades.map(fade => [fade.gain, fade.durationMs])).toEqual([[0, 650]])
    expect(backend.playbacks[1]!.loop).toBe(false)
    expect(backend.playbacks[1]!.fades.map(fade => [fade.gain, fade.durationMs])).toEqual([[1, 900]])
    await engine.syncState({ bgm: { assetId: 'c', fadeOutMs: 250 }, ambience: {} })
    expect(backend.playbacks[0]!.fades).toHaveLength(1)
    expect(backend.playbacks[1]!.fades.at(-1)?.durationMs).toBe(250)
    await engine.syncState(target(null), { fadeOutMs: 100 })
    expect(backend.playbacks[0]!.fades).toHaveLength(1)
    expect(backend.playbacks[1]!.fades).toHaveLength(2)
    expect(backend.playbacks[2]!.fades.at(-1)?.durationMs).toBe(100)
    backend.playbacks[0]!.fades[0]!.complete()
    await vi.waitFor(() => expect(backend.playbacks[0]!.stopped).toBe(true))
    expect(engine.inspect().tracks).toHaveLength(0)
    engine.dispose()
    expect(backend.playbacks.every(playback => playback.stopped)).toBe(true)
  })

  it('changes bus volume/mute without resetting either side of a crossfade envelope', async () => {
    const { engine, backend } = setup({ deferFades: true })
    await engine.syncState(target('a'))
    await engine.syncState({ bgm: { assetId: 'b', fadeInMs: 900, fadeOutMs: 650 }, ambience: {} })
    const envelopes = backend.playbacks.map(source => source.fades.map(fade => [fade.gain, fade.durationMs]))
    engine.setUserSettings({ buses: { music: { gain: 0.8 } } })
    expect(backend.busGains.music).toBe(0.8)
    engine.setUserSettings({ buses: { music: { gain: 0.8, muted: true } } })
    expect(backend.busGains.music).toBe(0)
    engine.setUserSettings({ buses: { music: { gain: 0.8, muted: false } } })
    expect(backend.busGains.music).toBe(0.8)
    expect(backend.playbacks.map(source => source.fades.map(fade => [fade.gain, fade.durationMs]))).toEqual(envelopes)
    engine.dispose()
  })

  it('resumes only the current target after pause and a replacement during retirement', async () => {
    const { engine, backend } = setup({ deferFades: true })
    await engine.syncState(target('a'))
    await engine.syncState({ bgm: { assetId: 'b', fadeOutMs: 650 }, ambience: {} })
    engine.pause()
    expect(backend.playbacks.map(source => source.paused)).toEqual([true, true])
    await engine.syncState(target('c'))
    await engine.resume()
    expect(backend.playbacks[0]!.playing).toBe(false)
    expect(backend.playbacks[1]!.playing).toBe(false)
    expect(backend.playbacks[2]!.playing).toBe(true)
    engine.dispose()
  })

  it('applies the latest gain when a same-asset request changes during loading', async () => {
    const { engine, backend } = setup({ deferLoads: true })
    const loading = engine.syncState(target('a'))
    await vi.waitFor(() => expect(backend.loads).toHaveLength(1))
    await engine.syncState({ bgm: { assetId: 'a', gain: 0.2 }, ambience: {} })
    const source = backend.loads[0]!.complete()
    await loading
    expect(source.gain).toBe(0.2)
    expect(backend.playbacks).toHaveLength(1)
    engine.dispose()
  })

  it('queues only current targets until a gesture unlocks audio', async () => {
    const { engine, backend } = setup({ locked: true }, { schemaVersion: 1, ui: { confirm: 'click' } })
    await engine.syncState(target('old'))
    await engine.playVoice({ assetId: 'old-line', lineId: 'old' })
    await engine.playSfx({ assetId: 'door' })
    await engine.playUi('confirm')
    await engine.syncState(target('new'), { reason: 'history' })
    await engine.playVoice({ assetId: 'new-line', lineId: 'new' })
    expect(backend.loads).toHaveLength(0)
    expect(engine.inspect().tracks.map(track => track.assetId).sort()).toEqual(['click', 'new', 'new-line'])
    expect(await engine.unlock()).toBe(true)
    expect(backend.playbacks.map(playback => playback.asset.assetId).sort()).toEqual(['click', 'new', 'new-line'])
    expect(engine.inspect().tracks.every(track => track.status === 'playing')).toBe(true)
    engine.dispose()
  })

  it('handles refused unlock without losing queued target state', async () => {
    const { engine } = setup({ locked: true, refuseUnlock: true })
    await engine.syncState(target('music'))
    expect(await engine.unlock()).toBe(false)
    expect(engine.inspect().tracks[0]?.status).toBe('queued')
    engine.dispose()
  })

  it('ignores unmapped UI cues, including prototype property names', async () => {
    const { engine, backend } = setup({}, { schemaVersion: 1, ui: { confirm: 'click' } })
    await engine.playUi('missing')
    await engine.playUi('toString')
    expect(backend.playbacks).toHaveLength(0)
    await engine.playUi('confirm')
    expect(backend.playbacks[0]?.asset.assetId).toBe('click')
    engine.dispose()
  })

  it('voice ducks music/ambience, releases naturally and ignores ended-after-stop', async () => {
    const { engine, backend } = setup({}, { schemaVersion: 1, ducking: { gain: 0.25, attackMs: 80, releaseMs: 200 } })
    const ended = vi.fn()
    engine.onVoiceEnded(ended)
    await engine.playVoice({ assetId: 'a', lineId: 'line-a', locale: 'zh-CN' })
    const a = backend.playbacks[0]!
    expect(backend.busGains).toEqual({ master: 1, music: 0.25, ambience: 0.25, voice: 1, sfx: 1, ui: 1 })
    expect(backend.busChanges.some(change => change.bus === 'music' && change.rampMs === 80)).toBe(true)
    await engine.playVoice({ assetId: 'b', lineId: 'line-b', locale: 'zh-CN' })
    a.end(true)
    expect(engine.inspect().voice?.assetId).toBe('b')
    expect(ended).not.toHaveBeenCalled()
    backend.playbacks[1]!.end()
    expect(engine.inspect().voice).toBeUndefined()
    expect(engine.inspect().ducking).toBe(false)
    expect(ended).toHaveBeenCalledExactlyOnceWith({ assetId: 'b', lineId: 'line-b', locale: 'zh-CN' })
    expect(backend.busChanges.some(change => change.bus === 'music' && change.rampMs === 200)).toBe(true)
    engine.stopVoice()
    engine.stopVoice()
    engine.dispose()
  })

  it('separates device settings, master mute and solo from runtime snapshots', async () => {
    const { engine, backend } = setup({}, { schemaVersion: 1, buses: { music: { gain: 0.4 } } })
    await engine.syncState(target('music'))
    const state = engine.inspect().state
    engine.setUserSettings({ buses: { music: { gain: 0.7 }, voice: { solo: true } } })
    expect(backend.busGains.music).toBe(0)
    expect(backend.busGains.voice).toBe(1)
    engine.setUserSettings({ buses: { master: { muted: true }, music: { gain: 0.7 } } })
    expect(engine.inspect().buses.music.effectiveGain).toBe(0)
    expect(engine.inspect().state).toEqual(state)
    engine.setUserSettings({})
    expect(backend.busGains.music).toBe(0.4)
    engine.dispose()
  })

  it('pauses story buses while UI continues, and restore drops voice/SFX', async () => {
    const { engine, backend } = setup()
    await engine.syncState(target('music'))
    await engine.playVoice({ assetId: 'voice' })
    await engine.playSfx({ assetId: 'sfx' })
    await engine.playUi({ assetId: 'ui' })
    engine.pause()
    expect(backend.playbacks.map(source => source.paused)).toEqual([true, true, true, false])
    expect(engine.inspect().ducking).toBe(false)
    await engine.resume()
    expect(engine.inspect().ducking).toBe(true)
    await engine.syncState(target('music'), { reason: 'restore' })
    expect(engine.inspect().tracks.map(track => track.assetId).sort()).toEqual(['music', 'ui'])
    expect(backend.playbacks[1]!.stopped).toBe(true)
    expect(backend.playbacks[2]!.stopped).toBe(true)
    engine.dispose()
  })

  it('limits SFX groups/globally with stable priority and age victims', async () => {
    const { engine, backend } = setup({}, { schemaVersion: 1, sfx: { maxVoices: 3, groups: { step: 1 } } })
    await engine.playSfx({ assetId: 'step-a', group: 'step', priority: 10 })
    await engine.playSfx({ assetId: 'step-low', group: 'step', priority: 1 })
    expect(backend.playbacks).toHaveLength(1)
    await engine.playSfx({ assetId: 'step-b', group: 'step', priority: 10 })
    expect(backend.playbacks[0]!.stopped).toBe(true)
    await engine.playSfx({ assetId: 'old', priority: 1 })
    await engine.playSfx({ assetId: 'young', priority: 1 })
    await engine.playSfx({ assetId: 'incoming', priority: 2 })
    expect(engine.inspect().tracks.map(track => track.assetId).sort()).toEqual(['incoming', 'step-b', 'young'])
    backend.playbacks.at(-1)!.end()
    expect(engine.inspect().tracks).toHaveLength(2)
    engine.dispose()
  })

  it('contains load errors, retries explicitly and rejects bad resolved identities', async () => {
    const { engine, backend } = setup({ deferLoads: true })
    const failed = engine.syncState(target('music'))
    await vi.waitFor(() => expect(backend.loads).toHaveLength(1))
    backend.loads[0]!.fail()
    await expect(failed).resolves.toBeUndefined()
    expect(engine.inspect().tracks[0]?.status).toBe('error')
    expect(engine.inspect().errors).toEqual([{ assetId: 'music', message: 'Audio asset failed to load or play' }])
    const retry = engine.syncState(target('music'))
    await vi.waitFor(() => expect(backend.loads).toHaveLength(2))
    backend.loads[1]!.complete()
    await retry
    engine.dispose()
    const invalid = createAudioEngine({ backend: createFakeAudioBackend(), resolveAsset: () => ({ assetId: 'wrong', url: 'secret' }) })
    await invalid.playVoice({ assetId: 'right' })
    expect(invalid.inspect().errors[0]?.message).not.toContain('secret')
    expect(invalid.inspect().voice).toBeUndefined()
    invalid.dispose()
  })

  it('disposes pending loads and cannot revive when they finish', async () => {
    const { engine, backend } = setup({ deferLoads: true })
    const loading = engine.playVoice({ assetId: 'voice' })
    await vi.waitFor(() => expect(backend.loads).toHaveLength(1))
    engine.dispose()
    expect(backend.loads[0]!.signal.aborted).toBe(true)
    const source = backend.loads[0]!.complete()
    await loading
    expect(source.stopped).toBe(true)
    expect(engine.inspect().tracks).toHaveLength(0)
    expect(await engine.unlock()).toBe(false)
    await engine.playSfx({ assetId: 'later' })
    expect(backend.loads).toHaveLength(1)
  })

  it('does not replay a naturally ended nonloop persistent track on identical reconciliation', async () => {
    const { engine, backend } = setup()
    const state = { bgm: { assetId: 'intro', loop: false }, ambience: {} }
    await engine.syncState(state)
    backend.playbacks[0]!.end()
    await engine.syncState(state)
    expect(backend.playbacks).toHaveLength(1)
    expect(engine.inspect().tracks[0]?.status).toBe('ended')
    engine.dispose()
  })
})

describe('audio JSON validation', () => {
  it.each([
    { schemaVersion: 2 },
    { schemaVersion: 1, buses: { effects: {} } },
    { schemaVersion: 1, buses: { music: { gain: Number.NaN } } },
    { schemaVersion: 1, ducking: { gain: 2 } },
    { schemaVersion: 1, sfx: { maxVoices: 0 } },
    { schemaVersion: 1, ui: { click: '' } },
    { schemaVersion: 1, apiKey: 'never' },
  ])('rejects invalid or private mixer fields: %j', config => expect(() => parseAudioMixerConfig(config)).toThrow())

  it('rejects URL-style tracks, unbounded ambience slots, and invalid fades', () => {
    expect(() => parseRuntimeAudioState({ bgm: { src: '/music.wav' }, ambience: {} })).toThrow()
    expect(() => parseRuntimeAudioState({ bgm: null, ambience: { extra: { assetId: 'a' } } })).toThrow()
    expect(() => parseRuntimeAudioState({ bgm: { assetId: 'a', fadeInMs: -1 }, ambience: {} })).toThrow()
    expect(() => parseRuntimeAudioState({ bgm: { assetId: 'https://host/music' }, ambience: {} })).toThrow()
    expect(() => parseRuntimeAudioState({ bgm: { assetId: 'audio/../escape' }, ambience: {} })).toThrow()
    expect(parseRuntimeAudioState({ bgm: { assetId: 'bgm/summer-day' }, ambience: {} }).bgm?.assetId).toBe('bgm/summer-day')
  })
})
