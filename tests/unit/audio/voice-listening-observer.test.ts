import type { VoiceListeningPlaybackEvent } from '../../../packages/audio/src/voice-listening'
import type { VoiceListeningObservedMedia } from '../../../packages/audio/src/voice-listening-player'
import { describe, expect, it, vi } from 'vitest'
import { voiceListeningCoverage } from '../../../packages/audio/src/voice-listening'
import { createVoiceListeningPlaybackObserver } from '../../../packages/audio/src/voice-listening-player'

class FakeMedia extends EventTarget implements VoiceListeningObservedMedia {
  src = 'blob:verified-unit-source'
  get currentSrc() { return this.src }
  currentTime = 0
  duration = 10
  playbackRate = 1
  paused = false
  seeking = false
}
function fixture() {
  const media = new FakeMedia()
  const observations: VoiceListeningPlaybackEvent[] = []
  const invalid = vi.fn()
  let wallTime = 0
  const observer = createVoiceListeningPlaybackObserver({ media: () => media, source: () => 'blob:verified-unit-source', now: () => wallTime, onPlayback: event => observations.push(event), onInvalid: invalid })
  const types = ['loadedmetadata', 'play', 'playing', 'timeupdate', 'pause', 'waiting', 'seeking', 'seeked', 'ratechange', 'ended']
  for (const type of types)
    media.addEventListener(type, event => observer.observe(event))
  return { media, observations, invalid, observer, advance(milliseconds: number) {
    wallTime += milliseconds
  }, dispatch(type: string) {
    media.dispatchEvent(new Event(type))
  } }
}

describe('shared author DOM playback observer (unit simulation only)', () => {
  it('retains a delayed playing callback prefix only after a matching play phase', () => {
    const host = fixture()
    host.media.duration = 1.52
    host.dispatch('play')
    expect(host.observations).toEqual([])
    host.advance(100)
    host.media.currentTime = 0.1
    host.dispatch('playing')
    host.advance(1420)
    host.media.currentTime = 1.52
    host.dispatch('ended')
    expect(voiceListeningCoverage(host.observations, 1.52)).toBe(1)
    expect(host.observations.every(event => event.provenance === 'simulation')).toBe(true)
  })

  it.each(['seeking', 'ratechange', 'pause'])('does not bridge an initial %s interruption or a playhead jump', (type) => {
    const host = fixture()
    host.dispatch('play')
    host.dispatch(type)
    host.advance(100)
    host.media.currentTime = 8
    host.dispatch('playing')
    expect(voiceListeningCoverage(host.observations, 10)).toBe(0)
    host.observer.reset()
    host.media.currentTime = 0
    host.dispatch('play')
    host.advance(100)
    host.media.currentTime = 8
    host.dispatch('playing')
    expect(voiceListeningCoverage(host.observations, 10)).toBe(0)
  })

  it('retains ended after final timeupdate and pause without adding duplicate coverage', () => {
    const host = fixture()
    host.dispatch('loadedmetadata')
    host.dispatch('playing')
    host.advance(10_000)
    host.media.currentTime = 10
    host.media.paused = true
    host.dispatch('timeupdate')
    host.dispatch('pause')
    host.dispatch('ended')
    host.dispatch('ended')
    expect(voiceListeningCoverage(host.observations, 10)).toBe(1)
    expect(host.observations.filter(event => event.ended)).toEqual([{ fromSeconds: 10, toSeconds: 10, rate: 1, ended: true, durationSeconds: 10, provenance: 'simulation' }])
  })

  it('requires a playing phase and does not infer coverage from play, metadata or unarmed timeupdates', () => {
    const host = fixture()
    host.dispatch('loadedmetadata')
    host.dispatch('play')
    host.advance(10_000)
    host.media.currentTime = 10
    host.dispatch('timeupdate')
    host.dispatch('pause')
    host.dispatch('ended')
    expect(voiceListeningCoverage(host.observations, 10)).toBe(0)
    expect(host.observations.some(event => event.ended)).toBe(false)
  })

  it('segments seeking and rejects rate changes until another valid playing phase', () => {
    const host = fixture()
    host.dispatch('playing')
    host.advance(1000)
    host.media.currentTime = 1
    host.dispatch('timeupdate')
    host.media.seeking = true
    host.media.currentTime = 9
    host.dispatch('seeking')
    host.dispatch('timeupdate')
    host.media.seeking = false
    host.dispatch('seeked')
    host.advance(1000)
    host.media.currentTime = 10
    host.dispatch('timeupdate')
    expect(voiceListeningCoverage(host.observations, 10)).toBe(0.2)
    host.media.playbackRate = 2
    host.dispatch('ratechange')
    host.media.playbackRate = 1
    host.dispatch('ended')
    expect(host.observations.some(event => event.ended)).toBe(false)
  })

  it('rejects a discontinuous time jump while pause and waiting stop further intervals', () => {
    const host = fixture()
    host.dispatch('playing')
    host.advance(100)
    host.media.currentTime = 8
    host.dispatch('timeupdate')
    expect(voiceListeningCoverage(host.observations, 10)).toBe(0)
    host.dispatch('waiting')
    host.advance(2000)
    host.media.currentTime = 10
    host.dispatch('timeupdate')
    expect(voiceListeningCoverage(host.observations, 10)).toBe(0)
  })

  it('ignores late events from an old element without disturbing the current phase', () => {
    const host = fixture()
    const old = new FakeMedia()
    old.addEventListener('timeupdate', event => expect(host.observer.observe(event)).toBe(false))
    host.dispatch('playing')
    host.advance(1000)
    host.media.currentTime = 1
    old.currentTime = 9
    old.dispatchEvent(new Event('timeupdate'))
    host.dispatch('timeupdate')
    expect(voiceListeningCoverage(host.observations, 10)).toBe(0.1)
    expect(host.invalid).not.toHaveBeenCalled()
  })

  it('latches a replaced source until explicit reset and never revives it through a later event', () => {
    const host = fixture()
    host.dispatch('loadedmetadata')
    host.dispatch('playing')
    host.media.src = 'blob:unverified-replacement'
    host.dispatch('timeupdate')
    expect(host.invalid).toHaveBeenCalledOnce()
    expect(host.invalid).toHaveBeenCalledWith('VOICE_LISTENING_MEDIA_REPLACED')
    host.media.src = 'blob:verified-unit-source'
    expect(host.observer.observe(new Event('playing'))).toBe(false)
    host.observer.reset()
    expect(host.observer.observe(new Event('playing'))).toBe(true)
  })

  it('measures actual duration and invalidates changed or missing media metadata', () => {
    const host = fixture()
    host.dispatch('loadedmetadata')
    expect(host.observations[0]!.durationSeconds).toBe(10)
    host.media.duration = 1
    host.dispatch('loadedmetadata')
    expect(host.invalid).toHaveBeenCalledWith('VOICE_LISTENING_MEDIA_REPLACED')
    host.observer.reset()
    host.media.duration = Number.NaN
    host.dispatch('loadedmetadata')
    expect(host.invalid).toHaveBeenLastCalledWith('VOICE_LISTENING_DURATION_REQUIRED')
  })

  it('labels missing targets, fake media and synthetic events on real DOM elements as simulation', () => {
    const host = fixture()
    host.observer.observe(new Event('loadedmetadata'))
    expect(host.observations.at(-1)?.provenance).toBe('simulation')
    const audio = document.createElement('audio')
    audio.src = 'blob:verified-dom-source'
    Object.defineProperties(audio, { duration: { value: 10 }, currentSrc: { value: audio.src }, paused: { value: false } })
    const events: VoiceListeningPlaybackEvent[] = []
    const observer = createVoiceListeningPlaybackObserver({ media: () => audio, source: () => audio.src, onPlayback: event => events.push(event) })
    audio.addEventListener('loadedmetadata', event => observer.observe(event))
    audio.dispatchEvent(new Event('loadedmetadata'))
    observer.observe({ type: 'loadedmetadata', target: audio, isTrusted: true } as unknown as Event)
    expect(events.every(event => event.provenance === 'simulation')).toBe(true)
  })
})
