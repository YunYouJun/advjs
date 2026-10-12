import type { VoiceListeningCandidate, VoiceListeningPlaybackEvent } from '../../../packages/audio/src/voice-listening'
import { createHash, webcrypto } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { voiceListeningCoverage } from '../../../packages/audio/src/voice-listening'
import { createVoiceListeningPlayer } from '../../../packages/audio/src/voice-listening-player'

beforeEach(() => vi.stubGlobal('crypto', webcrypto))
afterEach(() => vi.unstubAllGlobals())
const bytes = new Uint8Array([1, 2, 3, 4])
const candidate: VoiceListeningCandidate = { lineId: 'line_a', locale: 'zh-CN', speakerId: 'hero', takeId: 'take_a', assetId: 'audio_a', sha256: createHash('sha256').update(bytes).digest('hex'), spokenText: 'Unit simulation.', durationSeconds: 10, stale: false, unavailable: false }
class FakeMedia extends EventTarget {
  src = ''
  get currentSrc() { return this.src }
  currentTime = 0
  duration = 10
  playbackRate = 1
  paused = true
  seeking = false
  play = vi.fn(async () => {
    this.paused = false
    this.dispatchEvent(new Event('playing'))
  })

  pause = vi.fn(() => {
    this.paused = true
    this.dispatchEvent(new Event('pause'))
  })

  load = vi.fn()
}
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<T>((accept, decline) => {
    resolve = accept
    reject = decline
  })
  return { promise, resolve, reject }
}
function fixture(resolve = vi.fn(async () => ({ bytes, mimeType: 'audio/wav' })), firstPlay?: Promise<void>) {
  const media: FakeMedia[] = []
  const releases: ReturnType<typeof vi.fn>[] = []
  const events: VoiceListeningPlaybackEvent[] = []
  let clock = 0
  const player = createVoiceListeningPlayer({
    resolve,
    now: () => clock,
    createMedia: () => {
      const item = new FakeMedia()
      if (!media.length && firstPlay)
        item.play.mockReturnValueOnce(firstPlay)
      media.push(item)
      return item
    },
    createUrl: () => {
      const dispose = vi.fn()
      releases.push(dispose)
      return { url: `blob:unit-${releases.length}`, dispose }
    },
    onPlayback: (_candidate, event) => events.push(event),
  })
  return { player, media, releases, events, resolve, advance(milliseconds: number) {
    clock += milliseconds
  } }
}

describe('single verified author audition (fake media is always simulation)', () => {
  it('rejects changed native bytes before allocating any playback or object URL', async () => {
    const host = fixture(vi.fn(async () => ({ bytes: new Uint8Array([9, 9]), mimeType: 'audio/wav' })))
    expect(await host.player.play(candidate)).toBe(false)
    expect(host.player.inspect()).toMatchObject({ status: 'error', error: 'VOICE_LISTENING_MEDIA_SHA_MISMATCH' })
    expect(host.media).toHaveLength(0)
    expect(host.releases).toHaveLength(0)
  })

  it('aborts a pending old resolver and never starts its late result after a new candidate', async () => {
    const pending = deferred<{ bytes: Uint8Array, mimeType: string }>()
    const aborted = vi.fn()
    const resolve = vi.fn().mockImplementationOnce((_candidate, signal: AbortSignal) => {
      signal.addEventListener('abort', aborted)
      return pending.promise
    }).mockResolvedValue({ bytes, mimeType: 'audio/wav' })
    const host = fixture(resolve)
    const old = host.player.play(candidate)
    const next = { ...candidate, takeId: 'take_b', assetId: 'audio_b' }
    expect(await host.player.play(next)).toBe(true)
    pending.resolve({ bytes, mimeType: 'audio/wav' })
    expect(await old).toBe(false)
    expect(aborted).toHaveBeenCalledOnce()
    expect(host.media).toHaveLength(1)
    expect(host.player.inspect().candidate?.takeId).toBe('take_b')
    host.player.dispose()
    expect(host.releases[0]).toHaveBeenCalledOnce()
  })

  it('stops old sound before a new read and releases each URL once, including a late old play rejection', async () => {
    const host = fixture()
    expect(await host.player.play(candidate)).toBe(true)
    const old = host.media[0]!
    const pending = deferred<void>()
    old.play.mockReturnValueOnce(pending.promise)
    const resuming = host.player.resume()
    const next = host.player.play({ ...candidate, takeId: 'take_b' })
    expect(old.paused).toBe(true)
    expect(old.src).toBe('')
    expect(host.releases[0]).toHaveBeenCalledOnce()
    pending.resolve()
    expect(await resuming).toBe(false)
    expect(await next).toBe(true)
    old.currentTime = 10
    old.dispatchEvent(new Event('ended'))
    expect(host.player.inspect().status).toBe('playing')
    host.player.dispose()
    expect(host.releases.every(release => release.mock.calls.length === 1)).toBe(true)
    expect(await host.player.play(candidate)).toBe(false)
  })

  it('ignores a late initial play rejection without releasing the newer source or double-disposing the old URL', async () => {
    const pending = deferred<void>()
    const host = fixture(undefined, pending.promise)
    const old = host.player.play(candidate)
    await vi.waitFor(() => expect(host.media).toHaveLength(1))
    expect(await host.player.play({ ...candidate, takeId: 'take_b' })).toBe(true)
    pending.reject(new Error('simulated late media rejection'))
    expect(await old).toBe(false)
    expect(host.player.inspect()).toMatchObject({ status: 'playing', candidate: { takeId: 'take_b' } })
    expect(host.releases[0]).toHaveBeenCalledOnce()
    expect(host.releases[1]).not.toHaveBeenCalled()
    host.player.dispose()
    expect(host.releases[1]).toHaveBeenCalledOnce()
  })

  it('segments seeking, enforces 1x and reports actual duration with simulation provenance', async () => {
    const host = fixture()
    await host.player.play({ ...candidate, durationSeconds: 1 })
    const media = host.media[0]!
    media.dispatchEvent(new Event('loadedmetadata'))
    host.advance(1000)
    media.currentTime = 1
    media.dispatchEvent(new Event('timeupdate'))
    media.seeking = true
    media.currentTime = 9
    media.dispatchEvent(new Event('seeking'))
    media.dispatchEvent(new Event('timeupdate'))
    media.seeking = false
    media.dispatchEvent(new Event('seeked'))
    host.advance(1000)
    media.currentTime = 10
    media.dispatchEvent(new Event('ended'))
    expect(voiceListeningCoverage(host.events, 10)).toBe(0.2)
    expect(host.events.every(event => event.durationSeconds === 10 && event.provenance === 'simulation' && event.rate === 1)).toBe(true)
    expect(host.events.at(-1)?.ended).toBe(true)
    media.playbackRate = 2
    media.dispatchEvent(new Event('ratechange'))
    expect(media.playbackRate).toBe(1)
    host.player.dispose()
  })

  it('does not credit a time jump as continuous listening or continue a replaced source', async () => {
    const host = fixture()
    await host.player.play(candidate)
    const media = host.media[0]!
    host.advance(100)
    media.currentTime = 8
    media.dispatchEvent(new Event('timeupdate'))
    expect(host.events).toEqual([])
    media.src = 'blob:unverified-replacement'
    media.dispatchEvent(new Event('playing'))
    expect(host.player.inspect()).toMatchObject({ status: 'error', error: 'VOICE_LISTENING_MEDIA_REPLACED' })
    expect(media.paused).toBe(true)
    expect(host.releases[0]).toHaveBeenCalledOnce()
  })
})
