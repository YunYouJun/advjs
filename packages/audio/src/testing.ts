import type { AudioBus } from '@advjs/types'
import type { AudioBackend, AudioPlayback, AudioResolvedAsset } from './contracts'

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (error: Error) => void
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}

export class FakeAudioPlayback implements AudioPlayback {
  readonly endedListeners = new Set<() => void>()
  readonly historicalListeners = new Set<() => void>()
  readonly fades: { gain: number, durationMs: number, complete: () => void }[] = []
  playing = false
  paused = false
  stopped = false
  stopCount = 0
  gain: number

  constructor(readonly asset: AudioResolvedAsset, readonly bus: Exclude<AudioBus, 'master'>, readonly loop: boolean, gain: number, private deferFades = false) {
    this.gain = gain
  }

  play() {
    if (this.stopped)
      throw new Error('Source was stopped')
    this.playing = true
    this.paused = false
  }

  pause() {
    this.playing = false
    this.paused = true
  }

  resume() {
    this.play()
  }

  stop() {
    if (this.stopped)
      return
    this.stopped = true
    this.playing = false
    this.stopCount++
  }

  setGain(gain: number) {
    this.gain = gain
  }

  fadeTo(gain: number, durationMs: number) {
    const finish = deferred<void>()
    const fade = {
      gain,
      durationMs,
      complete: () => {
        this.gain = gain
        finish.resolve(undefined)
      },
    }
    this.fades.push(fade)
    if (!this.deferFades)
      fade.complete()
    return finish.promise
  }

  onEnded(listener: () => void) {
    this.endedListeners.add(listener)
    this.historicalListeners.add(listener)
    return () => this.endedListeners.delete(listener)
  }

  end(stale = false) {
    if (!stale)
      this.playing = false
    for (const listener of stale ? this.historicalListeners : this.endedListeners)
      listener()
  }
}

export interface FakeAudioBackend extends AudioBackend {
  playbacks: FakeAudioPlayback[]
  loads: { asset: AudioResolvedAsset, signal: AbortSignal, complete: () => FakeAudioPlayback, fail: () => void }[]
  busGains: Record<AudioBus, number>
  busChanges: { bus: AudioBus, gain: number, rampMs: number }[]
  disposed: boolean
}

/** Deferred loads/fades intentionally allow stale completions for race tests. */
export function createFakeAudioBackend(options: { locked?: boolean, deferLoads?: boolean, deferFades?: boolean, refuseUnlock?: boolean } = {}): FakeAudioBackend {
  let unlocked = !options.locked
  const backend: FakeAudioBackend = {
    playbacks: [],
    loads: [],
    busGains: { master: 1, music: 1, ambience: 1, voice: 1, sfx: 1, ui: 1 },
    busChanges: [],
    disposed: false,
    isUnlocked: () => unlocked && !backend.disposed,
    async unlock() {
      unlocked = !options.refuseUnlock
      return unlocked && !backend.disposed
    },
    createPlayback(asset, request) {
      const loading = deferred<AudioPlayback>()
      const load = {
        asset,
        signal: request.signal,
        complete() {
          const playback = new FakeAudioPlayback(asset, request.bus, request.loop, request.gain, options.deferFades)
          backend.playbacks.push(playback)
          loading.resolve(playback)
          return playback
        },
        fail() { loading.reject(new Error('Fake load failed')) },
      }
      backend.loads.push(load)
      if (!options.deferLoads)
        load.complete()
      return loading.promise
    },
    setBusGain(bus, gain, rampMs) {
      backend.busGains[bus] = gain
      backend.busChanges.push({ bus, gain, rampMs })
    },
    dispose() {
      backend.disposed = true
      for (const playback of backend.playbacks)
        playback.stop()
    },
  }
  return backend
}
