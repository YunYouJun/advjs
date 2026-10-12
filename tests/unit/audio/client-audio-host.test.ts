import type { AdvGameConfig, RuntimeState } from '@advjs/types'
import type { AdvContext } from '../../../packages/client/types'
import { describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick } from 'vue'
import { createFakeAudioBackend } from '../../../packages/audio/src/testing'
import { useAdvAudio } from '../../../packages/client/composables/useAdvAudio'
import { useAdvAuto } from '../../../packages/client/composables/useAdvAuto'

const lineId = 'line_019b1ca0-0000-7000-8000-000000000001'
const takeId = 'take_019b1ca0-0000-7000-8000-000000000001'
const assetId = 'audio_019b1ca0-0000-7000-8000-000000000001'
const hash = 'a'.repeat(64)
const state: RuntimeState = { status: 'playing', cursor: { chapterId: 'one', nodeId: 'one' }, variables: {}, stage: { background: '', audio: { bgm: { assetId: 'bgm/day' }, ambience: {} }, cg: '', tachies: {} }, choices: [], visited: [] }
const dialogue = { type: 'dialogue.voice', payload: { lineId, speakerId: 'hero', text: '你好' } }

function setup(options: Parameters<typeof createFakeAudioBackend>[0] = {}) {
  const backend = createFakeAudioBackend(options)
  const config = {
    audio: {
      assets: { 'bgm/day': { kind: 'bgm', src: '/day.wav' }, [assetId]: { kind: 'voice', src: '/voice.wav', sha256: hash }, 'sfx/click': { kind: 'sfx', src: '/click.wav' } },
      voiceLedger: { schemaVersion: 1, lines: { [lineId]: { speakerId: 'hero', displayText: '你好', locales: { 'zh-CN': { selectedTake: takeId, takes: [{ id: takeId, assetId, sha256: hash, providerId: 'openai-tts', voiceId: 'coral', model: 'gpt-4o-mini-tts', source: 'system', spokenText: '你好', createdAt: '2026-10-11T00:00:00Z', inputFingerprint: hash, voiceProfileRevision: hash }] } } } } },
    },
  } as unknown as AdvGameConfig
  let skipping = false
  const diagnostic = vi.fn()
  const audio = useAdvAudio({ backend, gameConfig: () => config, isSkipping: () => skipping, onDiagnostic: diagnostic })
  return { backend, config, audio, diagnostic, skip: () => {
    skipping = true
  } }
}

describe('shared client audio director', () => {
  it('prefetches at most three selected voices and aborts them on locale/history changes', async () => {
    const { backend, config, audio: initial } = setup()
    initial.dispose()
    const nextBackend = createFakeAudioBackend()
    const prefetch = vi.fn(async () => {})
    Object.assign(nextBackend, { prefetch })
    const lines = [lineId]
    for (let index = 2; index <= 4; index++) {
      const id = lineId.slice(0, -1) + index
      const nextAssetId = assetId.slice(0, -1) + index
      const nextTakeId = takeId.slice(0, -1) + index
      config.audio!.assets[nextAssetId] = { kind: 'voice', src: `/voice${index}.wav`, sha256: hash }
      const line = JSON.parse(JSON.stringify(config.audio!.voiceLedger!.lines[lineId]))
      line.locales['zh-CN'].takes[0].id = nextTakeId
      line.locales['zh-CN'].takes[0].assetId = nextAssetId
      line.locales['zh-CN'].selectedTake = nextTakeId
      config.audio!.voiceLedger!.lines[id] = line
      lines.push(id)
    }
    const audio = useAdvAudio({ backend: nextBackend, gameConfig: () => config, voiceLineIds: () => lines })
    await audio.applyEffects([dialogue], state)
    expect(prefetch).toHaveBeenCalledTimes(3)
    const signal = (prefetch.mock.calls[0] as unknown as [unknown, AbortSignal])[1]
    expect(signal.aborted).toBe(false)
    audio.setLocale('ja-JP')
    expect(signal.aborted).toBe(true)
    await audio.applyEffects([{ type: 'runtime.restore' }], state)
    expect(prefetch).toHaveBeenCalledTimes(3)
    expect(backend.playbacks).toHaveLength(0)
    audio.dispose()
  })
  it('plays the exact selected line/locale and releases Auto waiting on natural end', async () => {
    const { audio, backend } = setup()
    await audio.applyEffects([dialogue], state)
    expect(audio.voicePlaying.value).toBe(true)
    expect(backend.playbacks.map(source => source.bus).sort()).toEqual(['music', 'voice'])
    backend.playbacks.find(source => source.bus === 'voice')!.end()
    expect(audio.voicePlaying.value).toBe(false)
    audio.dispose()
  })

  it('keeps dialogue loading independent from a stalled persistent track', async () => {
    const { audio, backend } = setup({ deferLoads: true })
    const pending = audio.applyEffects([dialogue], state)
    await vi.waitFor(() => expect(backend.loads).toHaveLength(2))
    expect(audio.voicePlaying.value).toBe(true)
    backend.loads.find(load => load.asset.assetId === assetId)!.complete()
    await vi.waitFor(() => expect(audio.inspect().tracks.find(track => track.bus === 'voice')?.status).toBe('playing'))
    backend.loads.find(load => load.asset.assetId === 'bgm/day')!.complete()
    await pending
    audio.dispose()
  })

  it('history and skip keep persistent targets but never replay voice/SFX', async () => {
    const { audio, backend, skip } = setup()
    await audio.applyEffects([dialogue], state)
    await audio.applyEffects([{ type: 'runtime.restore' }, dialogue, { type: 'audio.sfx', payload: { assetId: 'sfx/click' } }], state)
    expect(audio.voicePlaying.value).toBe(false)
    expect(audio.inspect().tracks.map(track => track.bus)).toEqual(['music'])
    skip()
    await audio.applyEffects([dialogue], state)
    expect(backend.playbacks.filter(source => source.bus === 'voice')).toHaveLength(1)
    audio.dispose()
  })

  it('does not hold the current dialogue behind a stalled SFX load', async () => {
    const { audio, backend } = setup({ deferLoads: true })
    const pending = audio.applyEffects([{ type: 'audio.sfx', payload: { assetId: 'sfx/click' } }, dialogue], state)
    await vi.waitFor(() => expect(backend.loads).toHaveLength(3))
    backend.loads.find(load => load.asset.assetId === assetId)!.complete()
    await vi.waitFor(() => expect(audio.inspect().tracks.find(track => track.bus === 'voice')?.status).toBe('playing'))
    for (const load of backend.loads.filter(load => load.asset.assetId !== assetId))
      load.complete()
    await pending
    audio.dispose()
  })

  it('does not fall back to another locale or load a changed selected hash', async () => {
    const { audio, backend, config, diagnostic } = setup()
    audio.setLocale('ja-JP')
    await audio.applyEffects([dialogue], state)
    expect(backend.playbacks.filter(source => source.bus === 'voice')).toHaveLength(0)
    audio.setLocale('zh-CN')
    config.audio!.assets[assetId]!.sha256 = 'b'.repeat(64)
    await audio.applyEffects([dialogue], state)
    expect(audio.voicePlaying.value).toBe(false)
    expect(diagnostic).toHaveBeenCalledWith('ADV_AUDIO_VOICE_INVALID', expect.any(String))
    audio.dispose()
  })

  it('master mute preserves the device gains and never enters saved stage state', () => {
    const { audio } = setup()
    audio.setUserSettings({ buses: { music: { gain: 0.2 }, voice: { gain: 0.8 } } })
    audio.toggleMute()
    audio.toggleMute()
    expect(audio.inspect().buses.music.gain).toBe(0.2)
    expect(audio.inspect().buses.voice.gain).toBe(0.8)
    expect(state.stage.audio).not.toHaveProperty('buses')
    audio.dispose()
  })

  it('auto waits for both the typewriter and voice, and skip interrupts voice', async () => {
    vi.useFakeTimers()
    const scope = effectScope()
    const { audio, backend } = setup()
    const advance = vi.fn()
    const context = { $audio: audio, runtime: { next: advance }, store: { current: { kind: 'dialog' } } } as unknown as AdvContext
    const auto = scope.run(() => useAdvAuto(context))!
    auto.delay.value = 100
    auto.toggle()
    await audio.applyEffects([dialogue], state)
    auto.notifyPrintDone()
    await vi.advanceTimersByTimeAsync(200)
    expect(advance).not.toHaveBeenCalled()
    backend.playbacks.find(source => source.bus === 'voice')!.end()
    await nextTick()
    await vi.advanceTimersByTimeAsync(100)
    expect(advance).toHaveBeenCalledTimes(1)
    await audio.applyEffects([dialogue], state)
    auto.toggleSkip()
    expect(audio.voicePlaying.value).toBe(false)
    auto.notifyPrintDone()
    scope.stop()
    await vi.advanceTimersByTimeAsync(200)
    expect(advance).toHaveBeenCalledTimes(1)
    audio.dispose()
    vi.useRealTimers()
  })

  it('resets active story audio and keeps the unlocked device and user preferences reusable', async () => {
    const { audio, backend } = setup()
    audio.setUserSettings({ buses: { music: { gain: 0.2 } } })
    await audio.unlock()
    await audio.applyEffects([dialogue, { type: 'audio.sfx', payload: { assetId: 'sfx/click' } }], state)
    expect(audio.inspect().tracks.map(track => track.bus).sort()).toEqual(['music', 'sfx', 'voice'])
    audio.pause()
    await audio.reset()
    expect(audio.voicePlaying.value).toBe(false)
    expect(audio.inspect().tracks).toEqual([])
    expect(backend.playbacks.every(playback => playback.stopped)).toBe(true)
    expect(audio.inspect().buses.music.gain).toBe(0.2)
    expect(audio.inspect().unlocked).toBe(true)
    await audio.applyEffects([dialogue], state)
    expect(audio.inspect().tracks.every(track => track.status === 'playing')).toBe(true)
    audio.dispose()
  })

  it('cancels pending old audio and never revives it after a new session starts', async () => {
    const { audio, backend } = setup({ deferLoads: true })
    const pending = audio.applyEffects([dialogue, { type: 'audio.sfx', payload: { assetId: 'sfx/click' } }], state)
    await vi.waitFor(() => expect(backend.loads).toHaveLength(2))
    await audio.reset()
    for (const load of backend.loads)
      load.complete()
    await pending
    expect(audio.voicePlaying.value).toBe(false)
    expect(audio.inspect().tracks).toEqual([])
    expect(backend.playbacks.every(playback => playback.stopped)).toBe(true)
    audio.dispose()
  })

  it('stops a previous session track even while it is fading out', async () => {
    const { audio, backend } = setup({ deferFades: true })
    await audio.applyEffects([], state)
    const silent = structuredClone(state)
    silent.stage.audio.bgm = null
    await audio.applyEffects([{ type: 'audio.state', payload: { state: silent.stage.audio, fade: { out: 5000 } } }], silent)
    expect(backend.playbacks[0].stopped).toBe(false)
    await audio.reset()
    expect(backend.playbacks[0].stopped).toBe(true)
    audio.dispose()
  })

  it('immediately stops active ambience despite its configured exit fade', async () => {
    const { audio, backend, config } = setup({ deferFades: true })
    config.audio!.assets['ambience/rain'] = { kind: 'ambience', src: '/rain.wav' }
    const rainy = structuredClone(state)
    rainy.stage.audio.ambience.weather = { assetId: 'ambience/rain', fadeOutMs: 5000 }
    await audio.applyEffects([], rainy)
    const rain = backend.playbacks.find(playback => playback.bus === 'ambience')!
    expect(rain.playing).toBe(true)
    await audio.reset()
    expect(rain.stopped).toBe(true)
    expect(backend.playbacks.every(playback => playback.stopped)).toBe(true)
    audio.dispose()
  })
})
