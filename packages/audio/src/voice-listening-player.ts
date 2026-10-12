import type { VoiceListeningCandidate, VoiceListeningPlaybackEvent } from './voice-listening'
import { validateVoiceListeningCandidate, voiceListeningCandidateKey } from './voice-listening'

export interface VoiceListeningMedia {
  src: string
  currentSrc: string
  currentTime: number
  duration: number
  playbackRate: number
  paused: boolean
  seeking: boolean
  play: () => Promise<void>
  pause: () => void
  load: () => void
  removeAttribute?: (name: string) => void
  addEventListener: (type: string, listener: EventListener) => void
  removeEventListener: (type: string, listener: EventListener) => void
}

export type VoiceListeningObservedMedia = Pick<VoiceListeningMedia, 'src' | 'currentSrc' | 'currentTime' | 'duration' | 'playbackRate' | 'paused' | 'seeking'>

export interface VoiceListeningPlaybackObserverOptions {
  media: () => VoiceListeningObservedMedia | null | undefined
  /** An already byte-verified native object URL. The observer owns no URLs. */
  source: () => string
  onPlayback: (event: VoiceListeningPlaybackEvent) => void
  onInvalid?: (code: string) => void
  now?: () => number
}

/** Shared timing rules; UI hosts keep their DOM, verified reads and URL lifetime. */
export function createVoiceListeningPlaybackObserver(options: VoiceListeningPlaybackObserverOptions) {
  const now = options.now ?? (() => performance.now())
  let boundMedia: VoiceListeningObservedMedia | undefined
  let boundSource = ''
  let invalid = false
  let continuous = false
  let played = false
  let trustedPhase = false
  let previousTime = 0
  let previousWallTime = now()
  let measuredDuration: number | undefined
  let pendingStart: { position: number, wall: number, trusted: boolean } | undefined

  function reset() {
    boundMedia = undefined
    boundSource = ''
    invalid = false
    continuous = false
    played = false
    trustedPhase = false
    previousTime = 0
    previousWallTime = now()
    measuredDuration = undefined
    pendingStart = undefined
  }
  function fail(code: string) {
    if (!invalid) {
      invalid = true
      continuous = false
      played = false
      pendingStart = undefined
      options.onInvalid?.(code)
    }
    return false
  }
  function observe(event: Event): boolean {
    if (invalid)
      return false
    const media = options.media()
    const source = options.source()
    if (!media || !source)
      return false
    const target: unknown = event.target
    // Late events from a former element never alter the new element's phase.
    if (target !== null && target !== undefined && target !== media)
      return false
    if (!source.startsWith('blob:') || media.src !== source || (media.currentSrc && media.currentSrc !== source))
      return fail('VOICE_LISTENING_MEDIA_REPLACED')
    if (boundMedia && (boundMedia !== media || boundSource !== source))
      return fail('VOICE_LISTENING_MEDIA_REPLACED')
    boundMedia = media
    boundSource = source
    const currentTime = media.currentTime
    if (!Number.isFinite(currentTime) || currentTime < 0)
      return fail('VOICE_LISTENING_PLAYBACK_INVALID')
    const duration = Number.isFinite(media.duration) && media.duration > 0 && media.duration <= 3600 ? media.duration : undefined
    if (duration !== undefined) {
      if (measuredDuration !== undefined && Math.abs(measuredDuration - duration) > 0.15)
        return fail('VOICE_LISTENING_MEDIA_REPLACED')
      measuredDuration = duration
    }
    const trusted = typeof HTMLMediaElement === 'function' && media instanceof HTMLMediaElement && event instanceof Event && target === media && event.isTrusted && media.currentSrc === source
    const wall = now()
    const emit = (fromSeconds: number, toSeconds: number, ended = false, metadata = false) => {
      if (duration === undefined)
        return
      options.onPlayback({ fromSeconds, toSeconds, rate: 1, ended, durationSeconds: duration, provenance: trusted && (metadata || trustedPhase) ? 'browser-observed' : 'simulation' })
    }
    if (event.type === 'loadedmetadata') {
      if (duration === undefined)
        return fail('VOICE_LISTENING_DURATION_REQUIRED')
      emit(0, 0, false, true)
    }
    if (event.type === 'play') {
      continuous = false
      pendingStart = !media.paused && !media.seeking && media.playbackRate === 1
        ? { position: currentTime, wall, trusted }
        : undefined
    }
    if (['timeupdate', 'pause', 'waiting', 'ended'].includes(event.type)) {
      const delta = currentTime - previousTime
      const elapsed = Math.max(0, (wall - previousWallTime) / 1000)
      const ending = event.type === 'ended'
      const atEnd = duration !== undefined && currentTime >= duration - 0.15 && currentTime <= duration + 0.15
      // At the terminal timeupdate the browser may already report paused=true.
      // The armed playing phase, seek/rate guards and wall time prove progress;
      // pause/waiting events disarm it after recording their final interval.
      const validInterval = continuous && !media.seeking && media.playbackRate === 1 && delta >= 0 && delta <= elapsed + 0.35
      if (validInterval)
        emit(previousTime, currentTime, ending && atEnd)
      // A browser can send final timeupdate, then pause, and only then ended.
      // The terminal event adds no interval, but still proves completion.
      else if (ending && played && !media.seeking && media.playbackRate === 1 && atEnd)
        emit(currentTime, currentTime, true)
    }
    if (event.type === 'playing') {
      continuous = !media.paused && !media.seeking && media.playbackRate === 1
      played = continuous
      trustedPhase = trusted
      // The callback can arrive after audible playback has already advanced.
      // Only a matching play -> playing phase can prove that initial interval.
      if (continuous && pendingStart) {
        const delta = currentTime - pendingStart.position
        const elapsed = Math.max(0, (wall - pendingStart.wall) / 1000)
        trustedPhase &&= pendingStart.trusted
        if (delta >= 0 && delta <= elapsed + 0.35)
          emit(pendingStart.position, currentTime)
      }
      pendingStart = undefined
    }
    else if (event.type === 'seeked') {
      continuous = played && !media.paused && !media.seeking && media.playbackRate === 1
      trustedPhase &&= trusted
    }
    else if (['pause', 'waiting', 'ended', 'seeking', 'ratechange'].includes(event.type)) {
      continuous = false
      if (event.type === 'seeking')
        trustedPhase &&= trusted
      if (event.type === 'ratechange') {
        played = false
        trustedPhase = false
      }
      if (event.type === 'ended')
        played = false
    }
    previousTime = currentTime
    previousWallTime = wall
    if (['pause', 'seeking', 'seeked', 'ratechange', 'ended', 'error'].includes(event.type))
      pendingStart = undefined
    return true
  }
  return { reset, observe }
}

export interface VoiceListeningPlayerOptions {
  /** The host reads registered native bytes. URLs alone are never sufficient. */
  resolve: (candidate: VoiceListeningCandidate, signal: AbortSignal) => Promise<{ bytes: Uint8Array | ArrayBuffer, mimeType: string }>
  /** Only trusted events on an actual HTMLMediaElement count as observed playback. */
  createMedia?: () => VoiceListeningMedia
  createUrl?: (bytes: Uint8Array, mimeType: string) => { url: string, dispose: () => void }
  now?: () => number
  onPlayback?: (candidate: VoiceListeningCandidate, event: VoiceListeningPlaybackEvent) => void
  onChange?: () => void
}

/** One active audition. A new request stops old audio before reading new bytes. */
export function createVoiceListeningPlayer(options: VoiceListeningPlayerOptions) {
  let epoch = 0
  let disposed = false
  let controller: AbortController | undefined
  let media: VoiceListeningMedia | undefined
  let release: (() => void) | undefined
  let removeListeners: (() => void) | undefined
  let candidate: VoiceListeningCandidate | undefined
  let status: 'idle' | 'loading' | 'playing' | 'paused' | 'ended' | 'error' | 'disposed' = 'idle'
  let error = ''
  let position = 0
  let durationSeconds: number | undefined
  const now = options.now ?? (() => performance.now())
  const changed = () => options.onChange?.()

  function clear() {
    controller?.abort()
    controller = undefined
    removeListeners?.()
    removeListeners = undefined
    if (media) {
      media.pause()
      if (media.removeAttribute)
        media.removeAttribute('src')
      else
        media.src = ''
      media.load()
    }
    media = undefined
    release?.()
    release = undefined
    candidate = undefined
    durationSeconds = undefined
    position = 0
  }

  function stop() {
    epoch++
    clear()
    status = disposed ? 'disposed' : 'idle'
    error = ''
    changed()
  }

  async function play(value: VoiceListeningCandidate): Promise<boolean> {
    if (disposed)
      return false
    stop()
    const current = Object.freeze(validateVoiceListeningCandidate(value))
    if (current.unavailable) {
      status = 'error'
      error = 'VOICE_LISTENING_SOURCE_UNAVAILABLE'
      changed()
      return false
    }
    const request = ++epoch
    candidate = current
    controller = new AbortController()
    const signal = controller.signal
    status = 'loading'
    changed()
    let ownedUrl: { url: string, dispose: () => void } | undefined
    try {
      const result = await options.resolve(current, signal)
      if (signal.aborted || epoch !== request || disposed)
        return false
      const bytes = new Uint8Array(result.bytes instanceof ArrayBuffer ? result.bytes.slice(0) : result.bytes)
      if (!bytes.length || bytes.length > 64 * 1024 * 1024 || !/^audio\/[\w.+-]+$/u.test(result.mimeType))
        throw new Error('VOICE_LISTENING_MEDIA_INVALID')
      const actual = Array.from(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('')
      if (signal.aborted || epoch !== request || disposed)
        return false
      if (actual !== current.sha256)
        throw new Error('VOICE_LISTENING_MEDIA_SHA_MISMATCH')
      const acquired = options.createUrl?.(bytes, result.mimeType) ?? (() => {
        const url = URL.createObjectURL(new Blob([bytes], { type: result.mimeType }))
        return { url, dispose: () => URL.revokeObjectURL(url) }
      })()
      let urlDisposed = false
      ownedUrl = { url: acquired.url, dispose: () => {
        if (!urlDisposed) {
          urlDisposed = true
          acquired.dispose()
        }
      } }
      release = ownedUrl.dispose
      const element = options.createMedia?.() ?? new Audio()
      media = element
      const currentSource = () => {
        if (request !== epoch || signal.aborted || disposed || media !== element)
          return false
        return element.src === ownedUrl!.url && (!element.currentSrc || element.currentSrc === ownedUrl!.url)
      }
      const observer = createVoiceListeningPlaybackObserver({
        media: () => request === epoch && !signal.aborted && !disposed && media === element ? element : undefined,
        source: () => ownedUrl!.url,
        now,
        onPlayback: (event) => {
          durationSeconds = event.durationSeconds
          options.onPlayback?.(current, event)
        },
        onInvalid: (code) => {
          if (request === epoch && !signal.aborted && !disposed && media === element) {
            stop()
            status = 'error'
            error = code
            changed()
          }
        },
      })
      const observe: EventListener = (event) => {
        if (!observer.observe(event))
          return
        position = element.currentTime
        if (event.type === 'playing') {
          status = 'playing'
        }
        else if (event.type === 'pause') {
          if (status !== 'ended')
            status = 'paused'
        }
        else if (event.type === 'ended') {
          status = 'ended'
        }
        else if (event.type === 'ratechange') {
          element.playbackRate = 1
        }
        else if (event.type === 'error') {
          error = 'VOICE_LISTENING_MEDIA_PLAYBACK_FAILED'
          status = 'error'
        }
        changed()
      }
      const events = ['loadedmetadata', 'play', 'playing', 'timeupdate', 'pause', 'waiting', 'seeking', 'seeked', 'ratechange', 'ended', 'error']
      for (const type of events)
        element.addEventListener(type, observe)
      removeListeners = () => {
        for (const type of events)
          element.removeEventListener(type, observe)
        observer.reset()
      }
      element.src = ownedUrl.url
      element.playbackRate = 1
      element.load()
      await element.play()
      return currentSource()
    }
    catch (cause) {
      if (request !== epoch || signal.aborted || disposed) {
        ownedUrl?.dispose()
        return false
      }
      clear()
      status = 'error'
      error = cause instanceof Error && ['VOICE_LISTENING_MEDIA_INVALID', 'VOICE_LISTENING_MEDIA_SHA_MISMATCH', 'VOICE_LISTENING_MEDIA_REPLACED'].includes(cause.message) ? cause.message : 'VOICE_LISTENING_MEDIA_PLAYBACK_FAILED'
      changed()
      return false
    }
  }

  return {
    play,
    pause() { media?.pause() },
    async resume() {
      const current = media
      const request = epoch
      if (!current || disposed)
        return false
      try {
        current.playbackRate = 1
        await current.play()
        return current === media && request === epoch && !disposed
      }
      catch { return false }
    },
    async replay() {
      if (!candidate)
        return false
      return await play(candidate)
    },
    stop,
    inspect() { return { status, error, candidate: candidate ? { ...candidate } : undefined, candidateKey: candidate ? voiceListeningCandidateKey(candidate) : undefined, currentTime: position, durationSeconds } },
    dispose() {
      if (!disposed) {
        disposed = true
        stop()
      }
    },
  }
}
