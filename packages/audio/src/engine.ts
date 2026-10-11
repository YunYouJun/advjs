import type { AudioBus, AudioSfxRequest, AudioTrackState, AudioVoiceRequest, RuntimeAudioState } from '@advjs/types'
import type { AudioEngine, AudioEngineOptions, AudioPlayback, AudioTrackInspection } from './contracts'
import { createAudioMixer } from './mixer'
import { ambienceSlots, parseAudioTrackState, parseRuntimeAudioState } from './schema'

interface Entry extends AudioTrackInspection {
  controller: AbortController
  target: AudioTrackState
  voice?: AudioVoiceRequest
  playback?: AudioPlayback
  ended?: () => void
  loading?: Promise<void>
}

/** Owns all logical tracks. Backends only own physical sources and audio graph nodes. */
export function createAudioEngine(options: AudioEngineOptions): AudioEngine {
  const { backend } = options
  const mixer = createAudioMixer(options.mixer ?? { schemaVersion: 1 }, (bus, gain, ramp) => backend.setBusGain(bus, gain, ramp))
  const persistent = new Map<string, Entry>()
  const transient = new Map<number, Entry>()
  const retiring = new Set<Entry>()
  const voiceListeners = new Set<(request: AudioVoiceRequest) => void>()
  const errors: { assetId: string, message: string }[] = []
  let state: RuntimeAudioState = { bgm: null, ambience: {} }
  let voice: Entry | undefined
  let serial = 0
  let paused = false
  let disposed = false
  let unlocking: Promise<boolean> | undefined

  function current(entry: Entry) {
    return !disposed && !entry.controller.signal.aborted && (voice === entry || transient.get(entry.id) === entry || persistent.get(entry.slot!) === entry)
  }

  function refreshVoice() {
    mixer.setVoiceActive(voice?.status === 'playing')
  }

  function destroy(entry: Entry) {
    entry.controller.abort()
    entry.ended?.()
    entry.ended = undefined
    entry.playback?.stop()
    entry.playback = undefined
    retiring.delete(entry)
  }

  function retire(entry: Entry, fadeMs = 0) {
    entry.controller.abort()
    entry.ended?.()
    entry.ended = undefined
    const playback = entry.playback
    if (!playback || !fadeMs || disposed || entry.status === 'paused' || entry.target.gain === 0) {
      destroy(entry)
      return
    }
    retiring.add(entry)
    // The completion only disposes its own source. It cannot touch the new target.
    void playback.fadeTo(0, fadeMs).catch(() => {}).finally(() => destroy(entry))
  }

  function stopVoice() {
    const previous = voice
    voice = undefined
    if (previous)
      destroy(previous)
    refreshVoice()
  }

  function stopStoryTransients() {
    for (const entry of transient.values()) {
      if (entry.bus === 'sfx') {
        transient.delete(entry.id)
        destroy(entry)
      }
    }
  }

  function makeEntry(bus: Exclude<AudioBus, 'master'>, target: AudioTrackState, extra: Partial<Entry> = {}): Entry {
    return { id: ++serial, assetId: target.assetId, bus, target, controller: new AbortController(), status: 'queued', ...extra }
  }

  function report(entry: Entry) {
    errors.push({ assetId: entry.assetId, message: 'Audio asset failed to load or play' })
    if (errors.length > 100)
      errors.shift()
  }

  async function start(entry: Entry): Promise<void> {
    if (!current(entry) || !backend.isUnlocked())
      return
    if (entry.loading)
      return entry.loading
    entry.status = 'loading'
    entry.loading = (async () => {
      let playback: AudioPlayback | undefined
      try {
        const asset = await options.resolveAsset(entry.assetId, entry.bus, entry.controller.signal)
        if (!current(entry))
          return
        if (asset.assetId !== entry.assetId || typeof asset.url !== 'string' || !asset.url.trim())
          throw new Error('Invalid resolved audio asset')
        const initialGain = entry.target.fadeInMs ? 0 : entry.target.gain ?? 1
        playback = await backend.createPlayback(asset, {
          bus: entry.bus,
          loop: entry.target.loop ?? (entry.bus === 'music' || entry.bus === 'ambience'),
          gain: initialGain,
          signal: entry.controller.signal,
        })
        if (!current(entry)) {
          playback.stop()
          return
        }
        entry.playback = playback
        playback.setGain(entry.target.fadeInMs ? 0 : entry.target.gain ?? 1)
        entry.ended = playback.onEnded(() => {
          if (!current(entry))
            return
          if (voice === entry) {
            const request = entry.voice!
            stopVoice()
            for (const listener of voiceListeners)
              listener({ ...request })
          }
          else if (transient.get(entry.id) === entry) {
            transient.delete(entry.id)
            destroy(entry)
          }
          else {
            entry.status = 'ended'
            destroy(entry)
            // Persist the completed target without replaying it on an identical state.
            entry.controller = new AbortController()
          }
        })
        await playback.play()
        if (!current(entry)) {
          playback.stop()
          return
        }
        if (paused && entry.bus !== 'ui') {
          playback.pause()
          entry.status = 'paused'
        }
        else {
          entry.status = 'playing'
        }
        refreshVoice()
        if (entry.target.fadeInMs)
          void playback.fadeTo(entry.target.gain ?? 1, entry.target.fadeInMs).catch(() => {})
      }
      catch {
        playback?.stop()
        entry.ended?.()
        entry.ended = undefined
        entry.playback = undefined
        if (current(entry)) {
          entry.status = 'error'
          report(entry)
          if (voice === entry)
            stopVoice()
          if (transient.get(entry.id) === entry)
            transient.delete(entry.id)
          refreshVoice()
        }
      }
      finally {
        entry.loading = undefined
      }
    })()
    return entry.loading
  }

  async function setTrack(slot: string, bus: 'music' | 'ambience', target: AudioTrackState | undefined, fadeOutMs?: number) {
    const old = persistent.get(slot)
    if (old && target && old.assetId === target.assetId && (old.target.loop ?? true) === (target.loop ?? true) && old.status !== 'error') {
      const changedGain = old.target.gain !== target.gain
      old.target = target
      if (changedGain)
        old.playback?.setGain(target.gain ?? 1)
      if (old.status === 'queued')
        return start(old)
      return
    }
    persistent.delete(slot)
    if (old)
      retire(old, fadeOutMs ?? target?.fadeOutMs ?? old.target.fadeOutMs ?? 0)
    if (target) {
      const entry = makeEntry(bus, target, { slot })
      persistent.set(slot, entry)
      await start(entry)
    }
  }

  async function playTransient(bus: 'sfx' | 'ui', raw: AudioSfxRequest) {
    if (disposed)
      return
    const target = parseAudioTrackState({ assetId: raw.assetId, ...(raw.gain === undefined ? {} : { gain: raw.gain }), loop: false })
    if (raw.priority !== undefined && (!Number.isFinite(raw.priority) || !Number.isInteger(raw.priority)))
      throw new Error('Audio SFX priority must be an integer')
    if (raw.group !== undefined && !raw.group.trim())
      throw new Error('Audio SFX group must be nonempty')
    const entries = [...transient.values()].filter(entry => entry.bus === bus)
    const groupLimit = raw.group ? mixer.config.sfx?.groups?.[raw.group] : undefined
    const grouped = entries.filter(entry => entry.group === raw.group)
    const full = bus === 'sfx' && groupLimit && grouped.length >= groupLimit
      ? grouped
      : entries.length >= (bus === 'sfx' ? mixer.config.sfx?.maxVoices ?? 16 : 16) ? entries : []
    if (full.length) {
      const victim = full.sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0) || a.id - b.id)[0]!
      if ((raw.priority ?? 0) < (victim.priority ?? 0))
        return
      transient.delete(victim.id)
      destroy(victim)
    }
    const entry = makeEntry(bus, target, { group: raw.group, priority: raw.priority ?? 0 })
    transient.set(entry.id, entry)
    await start(entry)
  }

  const engine: AudioEngine = {
    async syncState(raw, syncOptions = {}) {
      if (disposed)
        return
      const target = parseRuntimeAudioState(raw)
      if (syncOptions.fadeOutMs !== undefined)
        parseAudioTrackState({ assetId: 'validation', fadeOutMs: syncOptions.fadeOutMs })
      if (syncOptions.reason && syncOptions.reason !== 'advance') {
        stopVoice()
        stopStoryTransients()
      }
      state = target
      await Promise.all([
        setTrack('music', 'music', target.bgm ?? undefined, !syncOptions.slot ? syncOptions.fadeOutMs : undefined),
        ...ambienceSlots.map(slot => setTrack(`ambience:${slot}`, 'ambience', target.ambience[slot], syncOptions.slot === slot ? syncOptions.fadeOutMs : undefined)),
      ])
    },
    async playVoice(request) {
      if (disposed)
        return
      const target = parseAudioTrackState({ assetId: request.assetId, ...(request.gain === undefined ? {} : { gain: request.gain }), loop: false })
      stopVoice()
      voice = makeEntry('voice', target, { voice: { ...request } })
      await start(voice)
    },
    playSfx: request => playTransient('sfx', request),
    async playUi(cue) {
      const request = typeof cue === 'string'
        ? { assetId: mixer.config.ui && Object.hasOwn(mixer.config.ui, cue) ? mixer.config.ui[cue] : undefined }
        : cue
      if (request.assetId)
        await playTransient('ui', { ...request, assetId: request.assetId })
    },
    stopVoice,
    pause() {
      if (disposed || paused)
        return
      paused = true
      for (const entry of [...persistent.values(), ...retiring, ...transient.values(), ...(voice ? [voice] : [])]) {
        if (entry.bus !== 'ui' && entry.status === 'playing') {
          entry.playback?.pause()
          entry.status = 'paused'
        }
      }
      refreshVoice()
    },
    async resume() {
      if (disposed || !paused)
        return
      paused = false
      await Promise.all([...persistent.values(), ...transient.values(), ...(voice ? [voice] : [])].map(async (entry) => {
        if (entry.status !== 'paused' || !current(entry))
          return
        try {
          await entry.playback?.resume()
          if (current(entry))
            entry.status = 'playing'
        }
        catch {
          if (current(entry)) {
            entry.status = 'error'
            report(entry)
            destroy(entry)
            if (voice === entry)
              voice = undefined
          }
        }
      }))
      refreshVoice()
    },
    async unlock() {
      if (disposed)
        return false
      if (unlocking)
        return unlocking
      unlocking = (async () => {
        try {
          const unlocked = await backend.unlock()
          if (!unlocked || disposed)
            return false
          await Promise.all([...persistent.values(), ...transient.values(), ...(voice ? [voice] : [])].filter(entry => entry.status === 'queued').map(start))
          return true
        }
        catch {
          return false
        }
        finally {
          unlocking = undefined
        }
      })()
      return unlocking
    },
    setUserSettings(settings) {
      if (!disposed)
        mixer.setUserSettings(settings)
    },
    inspect() {
      return {
        unlocked: !disposed && backend.isUnlocked(),
        paused,
        disposed,
        state: structuredClone(state),
        ...(voice?.voice ? { voice: { ...voice.voice } } : {}),
        tracks: [...persistent.values(), ...transient.values(), ...(voice ? [voice] : [])].map(({ id, assetId, bus, slot, group, priority, status }) => ({ id, assetId, bus, slot, group, priority, status })),
        buses: mixer.inspect(),
        ducking: mixer.ducking,
        errors: errors.map(error => ({ ...error })),
      }
    },
    onVoiceEnded(listener) {
      voiceListeners.add(listener)
      return () => voiceListeners.delete(listener)
    },
    dispose() {
      if (disposed)
        return
      disposed = true
      stopVoice()
      for (const entry of [...persistent.values(), ...transient.values(), ...retiring])
        destroy(entry)
      persistent.clear()
      transient.clear()
      voiceListeners.clear()
      backend.dispose()
    },
  }
  return engine
}
