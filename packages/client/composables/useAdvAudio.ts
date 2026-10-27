import type { AudioBackend, AudioEngine } from '@advjs/audio'
import type { AdvGameConfig, AudioUserSettings, RuntimeEffect, RuntimeState, VoiceAlignment, VoiceAlignmentUnit } from '@advjs/types'
import { createAudioEngine, normalizeAudioLocale, parseAudioUserSettings, parseVoiceAlignment, resolveVoiceTake, voiceAlignmentUnitAt } from '@advjs/audio'
import { readonly, shallowRef } from 'vue'
import { createBrowserAudioBackend, getBrowserAudioCapabilities, resolveBrowserAudioAsset } from '../audio'

/** One director for ordinary games, Editor previews and Studio previews. */
export function useAdvAudio(options: {
  gameConfig: () => Readonly<AdvGameConfig>
  backend?: AudioBackend
  isSkipping?: () => boolean
  onDiagnostic?: (code: string, message: string) => void
  onUserSettings?: (settings: AudioUserSettings) => void
  voiceLineIds?: (state: Readonly<RuntimeState>) => readonly string[]
}) {
  let engine: AudioEngine | undefined
  let disposed = false
  let voiceGeneration = 0
  let effectGeneration = 0
  const voicePlaying = shallowRef(false)
  const voiceHighlight = shallowRef<{ lineId: string, text: string, unit?: VoiceAlignmentUnit }>()
  let highlightFrame: number | undefined
  function clearHighlight() {
    if (highlightFrame !== undefined)
      cancelAnimationFrame(highlightFrame)
    highlightFrame = undefined
    voiceHighlight.value = undefined
  }
  function followVoice(alignment: VoiceAlignment, lineId: string, generation: number) {
    clearHighlight()
    const tick = () => {
      if (disposed || generation !== voiceGeneration || !engine?.inspect().voice) {
        clearHighlight()
        return
      }
      const seconds = engine.voicePosition?.()
      voiceHighlight.value = { lineId, text: alignment.text, unit: seconds === undefined ? undefined : voiceAlignmentUnitAt(alignment, seconds) }
      highlightFrame = requestAnimationFrame(tick)
    }
    tick()
  }
  const isMuted = shallowRef(false)
  const musicMuted = shallowRef(false)
  const locale = shallowRef<string>()
  let userSettings: AudioUserSettings = {}
  const backend = options.backend ?? createBrowserAudioBackend()
  const capabilities = getBrowserAudioCapabilities()
  let prefetchController: AbortController | undefined
  let prefetchState: Readonly<RuntimeState> | undefined

  function cancelPrefetch() {
    prefetchController?.abort()
    prefetchController = undefined
    prefetchState = undefined
  }
  function prefetchVoice(state: Readonly<RuntimeState>) {
    prefetchState = state
    if (!backend.prefetch || !backend.isUnlocked())
      return
    prefetchController?.abort()
    const controller = new AbortController()
    prefetchController = controller
    const config = options.gameConfig().audio
    if (!config?.voiceLedger)
      return
    const language = locale.value ?? config.locale ?? 'zh-CN'
    for (const lineId of [...new Set(options.voiceLineIds?.(state) ?? [])].slice(0, 3)) {
      try {
        const resolution = resolveVoiceTake(config.voiceLedger, lineId, language, config.assets)
        const asset = resolution.take && config.assets[resolution.take.assetId]
        if (asset?.kind === 'voice')
          void backend.prefetch(resolveBrowserAudioAsset(resolution.take!.assetId, asset, 'voice', capabilities), controller.signal).catch(() => {})
      }
      catch { /* An invalid or absent future binding stays silent until reached. */ }
    }
  }

  function getEngine() {
    if (disposed)
      throw new Error('ADV_AUDIO_DISPOSED')
    if (!engine) {
      engine = createAudioEngine({
        backend,
        mixer: options.gameConfig().audio?.mixer ? JSON.parse(JSON.stringify(options.gameConfig().audio!.mixer)) : undefined,
        resolveAsset(assetId, bus) {
          const asset = options.gameConfig().audio?.assets[assetId]
          const kind = bus === 'music' ? 'bgm' : bus
          if (!asset || asset.kind !== kind)
            throw new Error(`ADV_AUDIO_ASSET_INVALID: ${assetId} requires ${kind}`)
          try {
            return resolveBrowserAudioAsset(assetId, asset, bus, capabilities)
          }
          catch (error) {
            options.onDiagnostic?.('ADV_AUDIO_STREAM_CODEC_UNSUPPORTED', 'This audio stream requires a compatible processed AAC variant')
            throw error
          }
        },
      })
      engine.onVoiceEnded(() => {
        voicePlaying.value = false
        clearHighlight()
      })
      isMuted.value = engine.inspect().buses.master.muted
      musicMuted.value = engine.inspect().buses.music.muted
    }
    return engine
  }

  function stopVoice() {
    clearHighlight()
    cancelPrefetch()
    voiceGeneration += 1
    voicePlaying.value = false
    engine?.stopVoice()
  }

  async function applyEffects(effects: readonly RuntimeEffect[], state: Readonly<RuntimeState>) {
    if (disposed)
      return
    const effectEpoch = ++effectGeneration
    cancelPrefetch()
    const history = effects.some(effect => ['runtime.back', 'runtime.forward', 'runtime.restore'].includes(effect.type))
    const skip = options.isSkipping?.() ?? false
    const audio = getEngine()
    const reason = history ? 'history' : skip ? 'skip' : 'advance'
    const cues = history ? [] : effects.filter(effect => effect.type === 'audio.state')
    if (effects.some(effect => effect.type === 'dialogue.voice') || history || skip || state.status === 'ended')
      stopVoice()
    if (!history && !skip) {
      const dialogue = effects.find(effect => effect.type === 'dialogue.voice')?.payload as { lineId?: string } | undefined
      const config = options.gameConfig().audio
      const binding = dialogue?.lineId ? config?.voiceLedger?.lines[dialogue.lineId]?.locales[locale.value ?? config?.locale ?? 'zh-CN'] : undefined
      voicePlaying.value = Boolean(binding?.selectedTake)
    }
    const persistentWork: Promise<void>[] = []
    if (!cues.length)
      persistentWork.push(audio.syncState(state.stage.audio, { reason }))
    for (const cue of cues) {
      const payload = cue.payload as unknown as { state: RuntimeState['stage']['audio'], fade?: { out?: number }, slot?: 'bed' | 'weather' | 'crowd' | 'detail' }
      persistentWork.push(audio.syncState(payload.state, { reason, fadeOutMs: payload.fade?.out, slot: payload.slot }))
      if (effectEpoch !== effectGeneration)
        return
    }
    if (effectEpoch !== effectGeneration)
      return
    if (history || skip || state.status === 'ended') {
      stopVoice()
      await Promise.all(persistentWork)
      return
    }
    for (const effect of effects) {
      if (effectEpoch !== effectGeneration)
        return
      if (effect.type === 'audio.sfx') {
        const request = effect.payload as { assetId: string, group?: string, priority?: number, gain?: number }
        persistentWork.push(audio.playSfx(request))
      }
      if (effect.type !== 'dialogue.voice')
        continue
      stopVoice()
      const generation = voiceGeneration
      const dialogue = effect.payload as { lineId?: string, speakerId: string, text: string }
      const config = options.gameConfig().audio
      if (!dialogue.lineId || !config?.voiceLedger)
        continue
      const language = locale.value ?? config.locale ?? 'zh-CN'
      let resolution
      try {
        resolution = resolveVoiceTake(config.voiceLedger, dialogue.lineId, language, config.assets)
      }
      catch {
        voicePlaying.value = false
        options.onDiagnostic?.('ADV_AUDIO_VOICE_INVALID', `Voice binding is invalid for ${dialogue.lineId}`)
        continue
      }
      if (!resolution.take) {
        voicePlaying.value = false
        continue
      }
      const line = config.voiceLedger.lines[dialogue.lineId]
      if (line.speakerId !== dialogue.speakerId) {
        voicePlaying.value = false
        options.onDiagnostic?.('ADV_AUDIO_SPEAKER_MISMATCH', `Voice binding speaker differs for ${dialogue.lineId}`)
        continue
      }
      if (line.displayText !== dialogue.text)
        options.onDiagnostic?.('ADV_AUDIO_VOICE_STALE', `Voice text changed for ${dialogue.lineId}`)
      for (const warning of resolution.warnings)
        options.onDiagnostic?.('ADV_AUDIO_VOICE_STALE', warning.message)
      voicePlaying.value = true
      await audio.playVoice({ assetId: resolution.take.assetId, lineId: dialogue.lineId, locale: language })
      if (generation === voiceGeneration && resolution.take.alignment && resolution.take.alignment.text === dialogue.text) {
        try {
          followVoice(parseVoiceAlignment(resolution.take.alignment, { text: dialogue.text, sha256: resolution.take.sha256 }), dialogue.lineId, generation)
        }
        catch {
          options.onDiagnostic?.('ADV_AUDIO_ALIGNMENT_INVALID', 'Voice timing does not match the current dialogue and audio')
        }
      }
      if (generation === voiceGeneration && !audio.inspect().voice)
        voicePlaying.value = false
    }
    if (effectEpoch === effectGeneration)
      prefetchVoice(state)
    await Promise.all(persistentWork)
  }

  return {
    voicePlaying: readonly(voicePlaying),
    voiceHighlight: readonly(voiceHighlight),
    isMuted: readonly(isMuted),
    musicMuted: readonly(musicMuted),
    locale: readonly(locale),
    applyEffects,
    stopVoice,
    /** End a story session without disposing the unlocked device or user settings. */
    async reset() {
      if (disposed)
        return
      effectGeneration += 1
      stopVoice()
      await engine?.syncState({ bgm: null, ambience: {} }, { reason: 'restore', fadeOutMs: 0 })
      await engine?.resume()
    },
    async unlock() {
      const unlocked = await getEngine().unlock()
      if (unlocked && prefetchState)
        prefetchVoice(prefetchState)
      return unlocked
    },
    setLocale(value: string) {
      locale.value = normalizeAudioLocale(value)
      effectGeneration += 1
      cancelPrefetch()
      stopVoice()
    },
    setUserSettings(settings: AudioUserSettings) {
      const buses = { ...userSettings.buses }
      for (const [bus, value] of Object.entries(settings.buses ?? {}))
        buses[bus as keyof typeof buses] = { ...buses[bus as keyof typeof buses], ...value }
      userSettings = parseAudioUserSettings({ buses })
      getEngine().setUserSettings(userSettings)
      isMuted.value = getEngine().inspect().buses.master.muted
      musicMuted.value = getEngine().inspect().buses.music.muted
      options.onUserSettings?.(structuredClone(userSettings))
    },
    replaceUserSettings(settings: AudioUserSettings) {
      userSettings = parseAudioUserSettings(settings)
      getEngine().setUserSettings(userSettings)
      isMuted.value = getEngine().inspect().buses.master.muted
      musicMuted.value = getEngine().inspect().buses.music.muted
    },
    toggleMute() {
      const audio = getEngine()
      isMuted.value = !isMuted.value
      userSettings = { ...userSettings, buses: { ...userSettings.buses, master: { ...userSettings.buses?.master, muted: isMuted.value } } }
      audio.setUserSettings(userSettings)
      options.onUserSettings?.(structuredClone(userSettings))
    },
    toggleMusicMute() {
      const audio = getEngine()
      musicMuted.value = !musicMuted.value
      userSettings = { ...userSettings, buses: { ...userSettings.buses, music: { ...userSettings.buses?.music, muted: musicMuted.value } } }
      audio.setUserSettings(userSettings)
      options.onUserSettings?.(structuredClone(userSettings))
    },
    async playUi(cue: string) {
      const audio = getEngine()
      await audio.unlock()
      return await audio.playUi(cue)
    },
    inspect() { return getEngine().inspect() },
    pause() { getEngine().pause() },
    resume() { return getEngine().resume() },
    dispose() {
      if (disposed)
        return
      stopVoice()
      cancelPrefetch()
      engine?.dispose()
      disposed = true
    },
  }
}
