/** Pure JSON runtime audio contracts shared by all ADV.JS hosts. */
export type AudioBus = 'master' | 'music' | 'ambience' | 'voice' | 'sfx' | 'ui'
export type AudioAmbienceSlot = 'bed' | 'weather' | 'crowd' | 'detail'

export interface AudioTrackState {
  assetId: string
  gain?: number
  loop?: boolean
  fadeInMs?: number
  fadeOutMs?: number
}

export interface RuntimeAudioState {
  bgm: AudioTrackState | null
  ambience: Partial<Record<AudioAmbienceSlot, AudioTrackState>>
}

export interface AudioSfxRequest {
  assetId: string
  group?: string
  priority?: number
  gain?: number
}

export interface AudioVoiceRequest {
  assetId: string
  lineId?: string
  locale?: string
  gain?: number
}

export type AudioSyncReason = 'advance' | 'history' | 'restore' | 'locale' | 'skip'
