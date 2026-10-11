import { describe, expect, it, vi } from 'vitest'
import { createBrowserAudioBackend } from '../../../packages/client/audio/browser'

function fakeContext(initialState = 'running') {
  const gains: ReturnType<typeof gainNode>[] = []
  const mediaSources: { connect: ReturnType<typeof vi.fn>, disconnect: ReturnType<typeof vi.fn> }[] = []
  const bufferSources: { buffer: AudioBuffer | null, loop: boolean, connect: ReturnType<typeof vi.fn>, disconnect: ReturnType<typeof vi.fn>, start: ReturnType<typeof vi.fn>, stop: ReturnType<typeof vi.fn>, onended: (() => void) | null }[] = []
  function gainNode() {
    const param = {
      value: 1,
      cancelScheduledValues: vi.fn(),
      setValueAtTime: vi.fn((value: number) => { param.value = value }),
      linearRampToValueAtTime: vi.fn((value: number) => { param.value = value }),
    }
    return { gain: param, connect: vi.fn(), disconnect: vi.fn() }
  }
  const current = {
    state: initialState,
    currentTime: 0,
    destination: {},
    createGain() {
      const node = gainNode()
      gains.push(node)
      return node
    },
    createMediaElementSource: vi.fn(() => {
      const node = { connect: vi.fn(), disconnect: vi.fn() }
      mediaSources.push(node)
      return node
    }),
    createBufferSource() {
      const node = { buffer: null as AudioBuffer | null, loop: false, connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), onended: null as (() => void) | null }
      bufferSources.push(node)
      return node
    },
    decodeAudioData: vi.fn(async () => ({ length: 16, numberOfChannels: 1, duration: 2 } as AudioBuffer)),
    resume: vi.fn(async () => { current.state = 'running' }),
    close: vi.fn(async () => { current.state = 'closed' }),
  }
  return { current, context: current as unknown as AudioContext, gains, mediaSources, bufferSources }
}

class FakeMedia extends EventTarget {
  crossOrigin = ''
  preload = ''
  loop = false
  src = ''
  readyState = 0
  duration = 2
  play = vi.fn(async () => {})
  pause = vi.fn()
  removeAttribute = vi.fn()
  constructor(private automatic = true) { super() }
  load() {
    if (this.automatic) {
      queueMicrotask(() => {
        this.readyState = 2
        this.dispatchEvent(new Event('canplay'))
      })
    }
  }
}

const resource = (assetId: string, duration?: number) => ({ assetId, url: `/${assetId}.wav`, duration })
const request = (bus: 'music' | 'voice' | 'ambience' | 'sfx' | 'ui', signal = new AbortController().signal) => ({ bus, loop: bus === 'music' || bus === 'ambience', gain: 0.5, signal })

describe('browser audio backend', () => {
  it('keeps WebKit Opus inside the mixer via metadata-verified short decode, while AAC still streams', async () => {
    const { context, current, bufferSources } = fakeContext()
    const fetcher = vi.fn(async () => new Response(new ArrayBuffer(16)))
    const media: FakeMedia[] = []
    const backend = createBrowserAudioBackend({
      context,
      fetch: fetcher,
      userAgent: 'AppleWebKit/605.1.15 Version/26.6 Safari/605.1.15',
      createMediaElement() {
        const element = new FakeMedia()
        media.push(element)
        return element as unknown as HTMLAudioElement
      },
    })
    const opus = await backend.createPlayback({ assetId: 'opus', url: '/voice.webm', duration: 2, mime: 'audio/webm' }, request('music'))
    await opus.play()
    expect(fetcher).toHaveBeenCalledOnce()
    expect(bufferSources[0]!.loop).toBe(true)
    expect(media[0]!.preload).toBe('metadata')
    expect(media[0]!.removeAttribute).toHaveBeenCalledWith('src')
    expect(current.createMediaElementSource).not.toHaveBeenCalled()
    const aac = await backend.createPlayback({ assetId: 'aac', url: '/long.m4a', duration: 120, mime: 'audio/mp4' }, request('music'))
    await aac.play()
    expect(current.createMediaElementSource).toHaveBeenCalledOnce()
    expect(fetcher).toHaveBeenCalledOnce()
    backend.dispose()
  })

  it('rejects unknown/long Opus streams and dishonest short duration metadata before allocating decoded buffers', async () => {
    const { context, current } = fakeContext()
    const fetcher = vi.fn()
    const media = new FakeMedia()
    media.duration = 120
    const backend = createBrowserAudioBackend({
      context,
      fetch: fetcher,
      userAgent: 'AppleWebKit/605.1.15 Version/26.6 Safari/605.1.15',
      createMediaElement: () => media as unknown as HTMLAudioElement,
    })
    for (const duration of [undefined, Number.NaN, 0, -1, 20, 120]) {
      await expect(backend.createPlayback({ assetId: 'opus', url: '/long.webm', duration }, request('music'))).rejects.toThrow('ADV_AUDIO_STREAM_CODEC_UNSUPPORTED')
      await expect(backend.createPlayback({ assetId: 'opus', url: '/long.webm', duration }, request('voice'))).rejects.toThrow('ADV_AUDIO_STREAM_CODEC_UNSUPPORTED')
      await expect(backend.prefetch!({ assetId: 'opus', url: '/long.webm', duration }, new AbortController().signal)).rejects.toThrow('ADV_AUDIO_STREAM_CODEC_UNSUPPORTED')
    }
    await expect(backend.createPlayback({ assetId: 'opus', url: '/long.webm', duration: 2 }, request('ambience'))).rejects.toThrow('verified media shorter than 20 seconds')
    await expect(backend.createPlayback({ assetId: 'opus', url: '/long.webm', duration: 2 }, request('voice'))).rejects.toThrow('verified media shorter than 20 seconds')
    await expect(backend.prefetch!({ assetId: 'opus', url: '/long.webm', duration: 2 }, new AbortController().signal)).rejects.toThrow('verified media shorter than 20 seconds')
    expect(fetcher).not.toHaveBeenCalled()
    expect(current.decodeAudioData).not.toHaveBeenCalled()
    expect(current.createMediaElementSource).not.toHaveBeenCalled()
    expect(media.removeAttribute).toHaveBeenCalledWith('src')
    backend.dispose()
  })

  it('prefetches without playing, reuses short decoded cache and cancels long media loads', async () => {
    const { context, current } = fakeContext()
    const fetcher = vi.fn(async () => new Response(new ArrayBuffer(16)))
    const media = new FakeMedia(false)
    const backend = createBrowserAudioBackend({ context, fetch: fetcher, createMediaElement: () => media as unknown as HTMLAudioElement })
    await backend.prefetch!(resource('next', 2), new AbortController().signal)
    expect(current.createMediaElementSource).not.toHaveBeenCalled()
    const playback = await backend.createPlayback(resource('next', 2), request('voice'))
    expect(fetcher).toHaveBeenCalledOnce()
    playback.stop()
    const controller = new AbortController()
    const long = backend.prefetch!(resource('long', 30), controller.signal)
    controller.abort()
    await expect(long).rejects.toThrow('cancelled')
    expect(media.play).not.toHaveBeenCalled()
    expect(media.removeAttribute).toHaveBeenCalledWith('src')
    backend.dispose()
    expect(current.close).toHaveBeenCalledOnce()
  })
  it('constructs lazily and routes a source through leaf and master gains after gesture unlock', async () => {
    const { current, context, gains, mediaSources } = fakeContext('suspended')
    const createContext = vi.fn(() => context)
    const media = new FakeMedia()
    const backend = createBrowserAudioBackend({ createContext, createMediaElement: () => media as unknown as HTMLAudioElement })
    backend.setBusGain('music', 0.2, 100)
    expect(createContext).not.toHaveBeenCalled()
    expect(backend.isUnlocked()).toBe(false)
    expect(await backend.unlock()).toBe(true)
    expect(current.resume).toHaveBeenCalledOnce()
    expect(gains).toHaveLength(6)
    expect(gains[1]!.gain.value).toBe(0.2)
    const playback = await backend.createPlayback(resource('music'), request('music'))
    expect(media.crossOrigin).toBe('anonymous')
    expect(media.loop).toBe(true)
    expect(mediaSources[0]!.connect).toHaveBeenCalledWith(gains[6])
    expect(gains[6]!.connect).toHaveBeenCalledWith(gains[1])
    expect(gains[1]!.connect).toHaveBeenCalledWith(gains[0])
    await playback.play()
    expect(media.play).toHaveBeenCalledOnce()
    playback.pause()
    await playback.resume()
    expect(media.play).toHaveBeenCalledTimes(2)
    backend.setBusGain('music', 0.1, 120)
    expect(gains[1]!.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.1, 0.12)
    playback.stop()
    playback.stop()
    expect(mediaSources[0]!.disconnect).toHaveBeenCalledOnce()
    backend.dispose()
    expect(current.close).toHaveBeenCalledOnce()
  })

  it('decodes short voice/SFX/UI, reuses bounded cached buffers and resumes at the paused offset', async () => {
    const { context, current, bufferSources } = fakeContext()
    const fetcher = vi.fn(async () => new Response(new ArrayBuffer(16)))
    const backend = createBrowserAudioBackend({ context, fetch: fetcher })
    const playback = await backend.createPlayback(resource('short', 2), request('voice'))
    await playback.play()
    current.currentTime = 0.75
    playback.pause()
    expect(bufferSources[0]!.stop).toHaveBeenCalledOnce()
    expect(bufferSources[0]!.onended).toBeNull()
    await playback.resume()
    expect(bufferSources[1]!.start).toHaveBeenCalledWith(0, 0.75)
    const ended = vi.fn()
    playback.onEnded(ended)
    bufferSources[1]!.onended!()
    expect(ended).toHaveBeenCalledOnce()
    const again = await backend.createPlayback(resource('short'), request('sfx'))
    expect(fetcher).toHaveBeenCalledOnce()
    expect(current.decodeAudioData).toHaveBeenCalledOnce()
    again.stop()
    playback.stop()
    backend.dispose()
  })

  it('streams long voice and ambience instead of decoding them', async () => {
    const { context } = fakeContext()
    const fetcher = vi.fn()
    const media: FakeMedia[] = []
    const backend = createBrowserAudioBackend({
      context,
      fetch: fetcher,
      createMediaElement() {
        const element = new FakeMedia()
        media.push(element)
        return element as unknown as HTMLAudioElement
      },
    })
    await backend.createPlayback(resource('long', 30), request('voice'))
    await backend.createPlayback(resource('rain'), request('ambience'))
    expect(media.map(element => element.loop)).toEqual([false, true])
    expect(fetcher).not.toHaveBeenCalled()
    backend.dispose()
  })

  it('cancels media loads, including disposal, and disconnects failed sources', async () => {
    const { context, mediaSources } = fakeContext()
    const media: FakeMedia[] = []
    const backend = createBrowserAudioBackend({
      context,
      createMediaElement() {
        const element = new FakeMedia(false)
        media.push(element)
        return element as unknown as HTMLAudioElement
      },
    })
    const controller = new AbortController()
    const first = backend.createPlayback(resource('a'), request('music', controller.signal))
    controller.abort()
    await expect(first).rejects.toThrow('cancelled')
    expect(mediaSources[0]!.disconnect).toHaveBeenCalledOnce()
    const failed = backend.createPlayback(resource('b'), request('music'))
    media[1]!.dispatchEvent(new Event('error'))
    await expect(failed).rejects.toThrow('failed to load')
    const disposed = backend.createPlayback(resource('c'), request('music'))
    backend.dispose()
    await expect(disposed).rejects.toThrow('cancelled')
    expect(mediaSources.every(source => source.disconnect.mock.calls.length === 1)).toBe(true)
  })

  it('enforces decoded memory budgets and evicts least recently used immutable assets', async () => {
    const { context } = fakeContext()
    const fetcher = vi.fn(async () => new Response(new ArrayBuffer(16)))
    const backend = createBrowserAudioBackend({ context, fetch: fetcher, maxDecodedBytes: 96 })
    await backend.createPlayback(resource('a'), request('ui'))
    await backend.createPlayback(resource('b'), request('ui'))
    await backend.createPlayback(resource('a'), request('ui'))
    expect(fetcher).toHaveBeenCalledTimes(3)
    backend.dispose()
    const small = createBrowserAudioBackend({ context: fakeContext().context, fetch: fetcher, maxDecodedBytes: 32 })
    await expect(small.createPlayback(resource('large'), request('sfx'))).rejects.toThrow('cache budget')
    small.dispose()
  })

  it('settles superseded fades and releases all timers/sources on stop', async () => {
    vi.useFakeTimers()
    try {
      const { context } = fakeContext()
      const backend = createBrowserAudioBackend({ context, fetch: async () => new Response(new ArrayBuffer(16)) })
      const playback = await backend.createPlayback(resource('click'), request('ui'))
      const first = playback.fadeTo(0.2, 100)
      const second = playback.fadeTo(0, 200)
      await expect(first).resolves.toBeUndefined()
      playback.stop()
      await expect(second).resolves.toBeUndefined()
      expect(vi.getTimerCount()).toBe(0)
      backend.dispose()
    }
    finally {
      vi.useRealTimers()
    }
  })
})
