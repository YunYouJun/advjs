import type { AudioBus, AudioMixerConfig, AudioSfxRequest, AudioSyncReason, AudioUserSettings, AudioVoiceRequest, RuntimeAudioState } from '@advjs/types'

export interface AudioResolvedAsset {
  assetId: string
  url: string
  /** Known short voices decode; unknown or long voices use a streamed transport. */
  duration?: number
  mime?: string
}

export interface AudioPlayback {
  play: () => void | Promise<void>
  pause: () => void
  resume: () => void | Promise<void>
  stop: () => void
  setGain: (gain: number) => void
  fadeTo: (gain: number, durationMs: number) => Promise<void>
  onEnded: (listener: () => void) => () => void
}

/** No DOM or vendor SDK in the protocol; browser and test hosts implement it. */
export interface AudioBackend {
  isUnlocked: () => boolean
  unlock: () => Promise<boolean>
  createPlayback: (asset: AudioResolvedAsset, options: {
    bus: Exclude<AudioBus, 'master'>
    loop: boolean
    gain: number
    signal: AbortSignal
  }) => Promise<AudioPlayback>
  setBusGain: (bus: AudioBus, gain: number, rampMs: number) => void
  /** Optional host cache warmup; never creates a playback or starts sound. */
  prefetch?: (asset: AudioResolvedAsset, signal: AbortSignal) => Promise<void>
  dispose: () => void
}

export interface AudioEngineOptions {
  backend: AudioBackend
  resolveAsset: (assetId: string, bus: Exclude<AudioBus, 'master'>, signal: AbortSignal) => AudioResolvedAsset | Promise<AudioResolvedAsset>
  mixer?: AudioMixerConfig
}

export interface AudioTrackInspection {
  id: number
  assetId: string
  bus: Exclude<AudioBus, 'master'>
  slot?: string
  group?: string
  priority?: number
  status: 'queued' | 'loading' | 'playing' | 'paused' | 'ended' | 'error'
}

export interface AudioEngineInspection {
  unlocked: boolean
  paused: boolean
  disposed: boolean
  state: RuntimeAudioState
  voice?: AudioVoiceRequest
  tracks: AudioTrackInspection[]
  buses: Record<AudioBus, { gain: number, effectiveGain: number, muted: boolean, solo: boolean }>
  ducking: boolean
  errors: { assetId: string, message: string }[]
}

export interface AudioEngine {
  syncState: (state: RuntimeAudioState, options?: { reason?: AudioSyncReason, fadeOutMs?: number, slot?: string }) => Promise<void>
  playVoice: (request: AudioVoiceRequest) => Promise<void>
  playSfx: (request: AudioSfxRequest) => Promise<void>
  playUi: (cue: string | { assetId: string, gain?: number }) => Promise<void>
  stopVoice: () => void
  pause: () => void
  resume: () => Promise<void>
  unlock: () => Promise<boolean>
  setUserSettings: (settings: AudioUserSettings) => void
  inspect: () => AudioEngineInspection
  onVoiceEnded: (listener: (request: AudioVoiceRequest) => void) => () => void
  dispose: () => void
}
