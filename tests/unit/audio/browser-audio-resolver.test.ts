import type { AdvGameAudioAsset, AdvGameConfig, RuntimeState } from '@advjs/types'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createFakeAudioBackend } from '../../../packages/audio/src/testing'
import { isWebKitAudioRoutingAffected, resolveBrowserAudioAsset } from '../../../packages/client/audio/resolver'
import { useAdvAudio } from '../../../packages/client/composables/useAdvAudio'

const safari = 'Mozilla/5.0 AppleWebKit/605.1.15 Version/26.6 Safari/605.1.15'
const variants = { opus: { src: 'blob:opus', mime: 'audio/webm' }, aac: { src: 'blob:aac', mime: 'audio/mp4' } }
const lineId = 'line_019b1ca0-0000-7000-8000-000000000001'
const takeId = 'take_019b1ca0-0000-7000-8000-000000000001'
const assetId = 'audio_019b1ca0-0000-7000-8000-000000000001'
const hash = 'a'.repeat(64)
afterEach(() => vi.restoreAllMocks())

describe('mixer-safe browser audio transport', () => {
  it('identifies WebKit, including iOS alternate browsers, without excluding desktop Chromium', () => {
    expect(isWebKitAudioRoutingAffected(safari)).toBe(true)
    expect(isWebKitAudioRoutingAffected('AppleWebKit/605.1.15 CriOS/130.0 Mobile/15E148')).toBe(true)
    expect(isWebKitAudioRoutingAffected('AppleWebKit/605.1.15 FxiOS/130.0 Mobile/15E148')).toBe(true)
    expect(isWebKitAudioRoutingAffected('AppleWebKit/537.36 Chrome/130.0 Safari/537.36')).toBe(false)
    expect(isWebKitAudioRoutingAffected('Gecko/20100101 Firefox/130.0')).toBe(false)
  })

  it('selects AAC for WebKit streams and Opus for short voices and other browser streams', () => {
    const asset: AdvGameAudioAsset = { kind: 'bgm', src: '/master.wav', duration: 120, variants }
    const webKit = { webKit: true, canPlayType: () => true }
    expect(resolveBrowserAudioAsset('music', asset, 'music', webKit).url).toBe('blob:aac')
    expect(resolveBrowserAudioAsset('music', asset, 'music', { ...webKit, webKit: false }).url).toBe('blob:opus')
    expect(resolveBrowserAudioAsset('voice', { ...asset, kind: 'voice', duration: 2 }, 'voice', webKit).url).toBe('blob:opus')
    expect(resolveBrowserAudioAsset('voice', { ...asset, kind: 'voice', duration: 120 }, 'voice', webKit).url).toBe('blob:aac')
    expect(resolveBrowserAudioAsset('music', asset, 'music', { webKit: true, canPlayType: () => false }).url).toBe('/master.wav')
  })

  it('requires a compatible long stream and permits only bounded short Opus fallback', () => {
    const onlyOpus: AdvGameAudioAsset = { kind: 'bgm', src: 'blob:master', mime: 'audio/webm', duration: 120, variants: { opus: { src: 'blob:opus' } } }
    expect(() => resolveBrowserAudioAsset('music', onlyOpus, 'music', { webKit: true })).toThrow('ADV_AUDIO_STREAM_CODEC_UNSUPPORTED')
    expect(() => resolveBrowserAudioAsset('music', { ...onlyOpus, duration: undefined }, 'music', { webKit: true })).toThrow('ADV_AUDIO_STREAM_CODEC_UNSUPPORTED')
    for (const duration of [undefined, Number.NaN, 0, -1])
      expect(() => resolveBrowserAudioAsset('voice', { ...onlyOpus, kind: 'voice', duration }, 'voice', { webKit: true })).toThrow('ADV_AUDIO_STREAM_CODEC_UNSUPPORTED')
    expect(resolveBrowserAudioAsset('music', { ...onlyOpus, duration: 2 }, 'music', { webKit: true })).toMatchObject({ url: 'blob:master', duration: 2, mime: 'audio/webm' })
  })

  it('uses the same compatibility selection in the real director playback and prefetch without altering reviewed master identity', async () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(safari)
    vi.spyOn(HTMLMediaElement.prototype, 'canPlayType').mockReturnValue('probably')
    const backend = createFakeAudioBackend()
    const prefetch = vi.fn(async () => {})
    backend.prefetch = prefetch
    const config = { audio: {
      assets: { music: { kind: 'bgm', src: '/master.wav', duration: 120, variants }, [assetId]: { kind: 'voice', src: '/voice-master.wav', duration: 2, sha256: hash, variants } },
      voiceLedger: { schemaVersion: 1, lines: { [lineId]: { speakerId: 'hero', displayText: 'Hello', locales: { en: { selectedTake: takeId, takes: [{ id: takeId, assetId, sha256: hash, providerId: 'fake-tts', voiceId: 'supplier-voice', model: 'fixture-model', inputFingerprint: hash, voiceProfileRevision: hash, source: 'system', spokenText: 'Hello', createdAt: '2026-10-11T00:00:00Z' }] } } } } },
      locale: 'en',
    } } as unknown as AdvGameConfig
    const state = { status: 'playing', stage: { audio: { bgm: { assetId: 'music' }, ambience: {} } } } as RuntimeState
    const audio = useAdvAudio({ backend, gameConfig: () => config, voiceLineIds: () => [lineId] })
    await audio.applyEffects([{ type: 'dialogue.voice', payload: { lineId, speakerId: 'hero', text: 'Hello' } }], state)
    expect(backend.playbacks.find(source => source.bus === 'music')?.asset.url).toBe('blob:aac')
    expect(backend.playbacks.find(source => source.bus === 'voice')?.asset.url).toBe('blob:opus')
    expect(prefetch).toHaveBeenCalledWith(expect.objectContaining({ assetId, url: 'blob:opus' }), expect.any(AbortSignal))
    expect(config.audio!.assets[assetId]!.sha256).toBe(hash)
    audio.dispose()
  })

  it('reports unsupported long Opus streams instead of silently bypassing the six mixer buses', async () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(safari)
    const backend = createFakeAudioBackend()
    const diagnostic = vi.fn()
    const config = { audio: { assets: { music: { kind: 'bgm', src: '/long.webm', duration: 120, mime: 'audio/webm' } } } } as unknown as AdvGameConfig
    const audio = useAdvAudio({ backend, gameConfig: () => config, onDiagnostic: diagnostic })
    await audio.applyEffects([], { status: 'playing', stage: { audio: { bgm: { assetId: 'music' }, ambience: {} } } } as RuntimeState)
    expect(backend.loads).toHaveLength(0)
    expect(diagnostic).toHaveBeenCalledWith('ADV_AUDIO_STREAM_CODEC_UNSUPPORTED', expect.any(String))
    expect(audio.inspect().errors).toHaveLength(1)
    audio.dispose()
  })
})
