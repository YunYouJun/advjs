import type { AudioBackend, AudioPlayback, AudioResolvedAsset } from '@advjs/audio'
import type { AudioBus } from '@advjs/types'
import { canDecodeStreamFallback, isOpusAudioSource, isWebKitAudioRoutingAffected } from './resolver'

export interface BrowserAudioBackendOptions {
  context?: AudioContext
  createContext?: () => AudioContext
  createMediaElement?: () => HTMLAudioElement
  fetch?: typeof fetch
  maxDecodedBytes?: number
  /** Overrides the browser capability identity for embedded hosts and conformance tests. */
  userAgent?: string
}

/** The only DOM/Web Audio adapter. Neither Runtime nor the shared engine imports it. */
export function createBrowserAudioBackend(options: BrowserAudioBackendOptions = {}): AudioBackend {
  let context = options.context
  let disposed = false
  const graph = new Map<AudioBus, GainNode>()
  const settings = new Map<AudioBus, number>()
  const sources = new Set<AudioPlayback>()
  const pendingLoads = new Set<AbortController>()
  const cache = new Map<string, { buffer: AudioBuffer, bytes: number }>()
  const cacheLimit = options.maxDecodedBytes ?? 64 * 1024 * 1024
  const webKit = isWebKitAudioRoutingAffected(options.userAgent)
  let cacheBytes = 0

  function audioContext() {
    if (disposed)
      throw new Error('Audio backend disposed')
    if (!context)
      context = options.createContext?.() ?? new AudioContext()
    if (!graph.size) {
      const master = context.createGain()
      master.gain.value = settings.get('master') ?? 1
      master.connect(context.destination)
      graph.set('master', master)
      for (const bus of ['music', 'ambience', 'voice', 'sfx', 'ui'] as const) {
        const gain = context.createGain()
        gain.gain.value = settings.get(bus) ?? 1
        gain.connect(master)
        graph.set(bus, gain)
      }
    }
    return context
  }

  function gainValue(param: AudioParam, value: number, rampMs: number) {
    const current = audioContext()
    param.cancelScheduledValues(current.currentTime)
    param.setValueAtTime(param.value, current.currentTime)
    if (rampMs > 0)
      param.linearRampToValueAtTime(value, current.currentTime + rampMs / 1000)
    else
      param.setValueAtTime(value, current.currentTime)
  }

  function playbackGain(bus: Exclude<AudioBus, 'master'>, value: number) {
    const current = audioContext()
    const gain = current.createGain()
    gain.gain.value = value
    gain.connect(graph.get(bus)!)
    return gain
  }

  function commonPlayback(gain: GainNode, implementation: {
    currentTime?: () => number
    play: () => void | Promise<void>
    pause: () => void
    stop: () => void
  }) {
    const listeners = new Set<() => void>()
    let stopped = false
    let pendingFade: { timer: ReturnType<typeof setTimeout>, resolve: () => void } | undefined
    function cancelFade() {
      if (pendingFade) {
        clearTimeout(pendingFade.timer)
        pendingFade.resolve()
        pendingFade = undefined
      }
    }
    const playback: AudioPlayback = {
      currentTime: implementation.currentTime,
      play() {
        if (!stopped)
          return implementation.play()
      },
      resume() {
        if (!stopped)
          return implementation.play()
      },
      pause() {
        if (!stopped)
          implementation.pause()
      },
      stop() {
        if (stopped)
          return
        stopped = true
        cancelFade()
        listeners.clear()
        implementation.stop()
        gain.disconnect()
        sources.delete(playback)
      },
      setGain(value) {
        if (stopped)
          return
        cancelFade()
        gainValue(gain.gain, value, 0)
      },
      fadeTo(value, durationMs) {
        cancelFade()
        if (stopped)
          return Promise.resolve()
        gainValue(gain.gain, value, durationMs)
        if (!durationMs)
          return Promise.resolve()
        return new Promise<void>((resolve) => {
          pendingFade = {
            timer: setTimeout(() => {
              pendingFade = undefined
              resolve()
            }, durationMs),
            resolve,
          }
        })
      },
      onEnded(listener) {
        listeners.add(listener)
        return () => listeners.delete(listener)
      },
    }
    sources.add(playback)
    return {
      playback,
      ended() {
        if (!stopped) {
          for (const listener of [...listeners])
            listener()
        }
      },
    }
  }

  async function createMediaPlayback(asset: AudioResolvedAsset, bus: Exclude<AudioBus, 'master'>, loop: boolean, gainValue: number, signal: AbortSignal) {
    const current = audioContext()
    const media = options.createMediaElement?.() ?? document.createElement('audio')
    media.crossOrigin = 'anonymous'
    media.preload = 'auto'
    media.loop = loop
    const gain = playbackGain(bus, gainValue)
    const source = current.createMediaElementSource(media)
    source.connect(gain)
    const mediaPlayback = commonPlayback(gain, {
      currentTime: () => media.currentTime,
      play: () => media.play(),
      pause: () => media.pause(),
      stop() {
        media.pause()
        media.removeAttribute('src')
        media.load()
        source.disconnect()
        media.removeEventListener('ended', mediaPlayback.ended)
      },
    })
    media.addEventListener('ended', mediaPlayback.ended)
    try {
      await new Promise<void>((resolve, reject) => {
        function cleanup() {
          media.removeEventListener('canplay', ready)
          media.removeEventListener('error', fail)
          signal.removeEventListener('abort', aborted)
        }
        function ready() {
          cleanup()
          resolve()
        }
        function fail() {
          cleanup()
          reject(new Error('Audio media failed to load'))
        }
        function aborted() {
          cleanup()
          reject(new Error('Audio media load cancelled'))
        }
        if (signal.aborted) {
          aborted()
          return
        }
        media.addEventListener('canplay', ready, { once: true })
        media.addEventListener('error', fail, { once: true })
        signal.addEventListener('abort', aborted, { once: true })
        media.src = asset.url
        media.load()
        if (media.readyState >= 2)
          ready()
      })
      return mediaPlayback.playback
    }
    catch (error) {
      mediaPlayback.playback.stop()
      throw error
    }
  }

  async function verifyShortMediaDuration(asset: AudioResolvedAsset, signal: AbortSignal) {
    const media = options.createMediaElement?.() ?? document.createElement('audio')
    media.crossOrigin = 'anonymous'
    media.preload = 'metadata'
    try {
      await new Promise<void>((resolve, reject) => {
        function cleanup() {
          media.removeEventListener('loadedmetadata', ready)
          media.removeEventListener('canplay', ready)
          media.removeEventListener('error', failed)
          signal.removeEventListener('abort', cancelled)
        }
        function ready() {
          cleanup()
          if (!canDecodeStreamFallback({ duration: media.duration }))
            reject(new Error('ADV_AUDIO_STREAM_CODEC_UNSUPPORTED: Opus decode fallback requires verified media shorter than 20 seconds'))
          else
            resolve()
        }
        function failed() {
          cleanup()
          reject(new Error('Audio media metadata failed to load'))
        }
        function cancelled() {
          cleanup()
          reject(new Error('Audio media metadata load cancelled'))
        }
        if (signal.aborted) {
          cancelled()
          return
        }
        media.addEventListener('loadedmetadata', ready, { once: true })
        media.addEventListener('canplay', ready, { once: true })
        media.addEventListener('error', failed, { once: true })
        signal.addEventListener('abort', cancelled, { once: true })
        media.src = asset.url
        media.load()
      })
    }
    finally {
      media.removeAttribute('src')
      media.load()
    }
  }

  async function decode(asset: AudioResolvedAsset, signal: AbortSignal) {
    const key = `${asset.assetId}\0${asset.url}`
    const cached = cache.get(key)
    if (cached) {
      cache.delete(key)
      cache.set(key, cached)
      return cached.buffer
    }
    const response = await (options.fetch ?? globalThis.fetch)(asset.url, { signal })
    if (!response.ok || Number(response.headers.get('content-length')) > cacheLimit)
      throw new Error('Audio buffer response is invalid or too large')
    const bytes = await response.arrayBuffer()
    if (bytes.byteLength > cacheLimit || signal.aborted)
      throw new Error('Audio buffer is too large or cancelled')
    const buffer = await audioContext().decodeAudioData(bytes)
    if (signal.aborted || disposed)
      throw new Error('Audio buffer load cancelled')
    const size = buffer.length * buffer.numberOfChannels * 4
    if (size > cacheLimit)
      throw new Error('Decoded audio exceeds cache budget')
    while (cacheBytes + size > cacheLimit && cache.size) {
      const oldest = cache.entries().next().value!
      cache.delete(oldest[0])
      cacheBytes -= oldest[1].bytes
    }
    // A concurrent request may have inserted the same immutable asset.
    const existing = cache.get(key)
    if (existing)
      cacheBytes -= existing.bytes
    cache.set(key, { buffer, bytes: size })
    cacheBytes += size
    return buffer
  }

  async function createBufferPlayback(asset: AudioResolvedAsset, bus: Exclude<AudioBus, 'master'>, loop: boolean, value: number, signal: AbortSignal) {
    const buffer = await decode(asset, signal)
    const current = audioContext()
    const gain = playbackGain(bus, value)
    let source: AudioBufferSourceNode | undefined
    let offset = 0
    let startedAt = 0
    let completed = false
    function detach() {
      if (source) {
        source.onended = null
        source.stop()
        source.disconnect()
        source = undefined
      }
    }
    const bufferPlayback = commonPlayback(gain, {
      currentTime: () => Math.min(buffer.duration, completed ? buffer.duration : offset + (source ? current.currentTime - startedAt : 0)),
      play() {
        if (source || completed)
          return
        const next = current.createBufferSource()
        next.buffer = buffer
        next.loop = loop
        next.connect(gain)
        next.onended = () => {
          if (source !== next)
            return
          source = undefined
          next.disconnect()
          completed = true
          bufferPlayback.ended()
        }
        source = next
        startedAt = current.currentTime
        next.start(0, Math.min(offset, Math.max(0, buffer.duration - 0.001)))
      },
      pause() {
        if (!source)
          return
        offset += current.currentTime - startedAt
        if (loop && buffer.duration)
          offset %= buffer.duration
        detach()
      },
      stop: detach,
    })
    return bufferPlayback.playback
  }

  return {
    isUnlocked: () => !disposed && context?.state === 'running',
    async unlock() {
      if (disposed)
        return false
      const current = audioContext()
      if (current.state !== 'running')
        await current.resume()
      return current.state === 'running'
    },
    async createPlayback(asset, request) {
      if (disposed || request.signal.aborted)
        throw new Error('Audio load cancelled')
      const controller = new AbortController()
      const abort = () => controller.abort()
      request.signal.addEventListener('abort', abort, { once: true })
      pendingLoads.add(controller)
      try {
        let streamed = request.bus === 'music' || request.bus === 'ambience' || (request.bus === 'voice' && !canDecodeStreamFallback(asset))
        // WebKit's Opus MediaElement path bypasses the mixer GainNodes despite
        // canPlayType claiming support: https://bugs.webkit.org/show_bug.cgi?id=276813.
        // Re-read media duration before a bounded short-cue decode; never decode
        // an unknown/long stream simply to work around a browser compatibility bug.
        if (webKit && isOpusAudioSource(asset)) {
          if (!canDecodeStreamFallback(asset))
            throw new Error('ADV_AUDIO_STREAM_CODEC_UNSUPPORTED: Long Opus streams require a processed AAC variant in WebKit')
          await verifyShortMediaDuration(asset, controller.signal)
          streamed = false
        }
        return await (streamed
          ? createMediaPlayback(asset, request.bus, request.loop, request.gain, controller.signal)
          : createBufferPlayback(asset, request.bus, request.loop, request.gain, controller.signal))
      }
      finally {
        pendingLoads.delete(controller)
        request.signal.removeEventListener('abort', abort)
      }
    },
    setBusGain(bus, value, rampMs) {
      settings.set(bus, value)
      if (context && graph.size)
        gainValue(graph.get(bus)!.gain, value, rampMs)
    },
    async prefetch(asset, signal) {
      if (disposed || signal.aborted || context?.state !== 'running')
        return
      const controller = new AbortController()
      const abort = () => controller.abort()
      signal.addEventListener('abort', abort, { once: true })
      pendingLoads.add(controller)
      try {
        if (canDecodeStreamFallback(asset)) {
          if (webKit && isOpusAudioSource(asset))
            await verifyShortMediaDuration(asset, controller.signal)
          await decode(asset, controller.signal)
          return
        }
        if (webKit && isOpusAudioSource(asset))
          throw new Error('ADV_AUDIO_STREAM_CODEC_UNSUPPORTED: Opus prefetch requires a known short cue or compatible AAC transport')
        // Warm the browser media cache without allocating a decoded long-voice buffer.
        const media = options.createMediaElement?.() ?? document.createElement('audio')
        media.crossOrigin = 'anonymous'
        media.preload = 'auto'
        try {
          await new Promise<void>((resolve, reject) => {
            function cleanup() {
              media.removeEventListener('canplay', ready)
              media.removeEventListener('error', fail)
              controller.signal.removeEventListener('abort', cancelled)
            }
            function ready() {
              cleanup()
              resolve()
            }
            function fail() {
              cleanup()
              reject(new Error('Voice prefetch failed'))
            }
            function cancelled() {
              cleanup()
              reject(new Error('Voice prefetch cancelled'))
            }
            media.addEventListener('canplay', ready, { once: true })
            media.addEventListener('error', fail, { once: true })
            controller.signal.addEventListener('abort', cancelled, { once: true })
            media.src = asset.url
            media.load()
            if (media.readyState >= 2)
              ready()
          })
        }
        finally {
          media.removeAttribute('src')
          media.load()
        }
      }
      finally {
        pendingLoads.delete(controller)
        signal.removeEventListener('abort', abort)
      }
    },
    dispose() {
      if (disposed)
        return
      for (const controller of pendingLoads)
        controller.abort()
      for (const playback of [...sources])
        playback.stop()
      for (const gain of graph.values())
        gain.disconnect()
      graph.clear()
      cache.clear()
      cacheBytes = 0
      disposed = true
      if (context?.state !== 'closed')
        void context?.close().catch(() => {})
    },
  }
}
