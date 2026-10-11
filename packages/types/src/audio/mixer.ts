import type { AudioBus } from './runtime'

export interface AudioBusSettings {
  gain?: number
  muted?: boolean
  solo?: boolean
}

/** Project defaults. Device preferences are a separate AudioUserSettings value. */
export interface AudioMixerConfig {
  schemaVersion: 1
  buses?: Partial<Record<AudioBus, AudioBusSettings>>
  ducking?: {
    enabled?: boolean
    gain?: number
    attackMs?: number
    releaseMs?: number
  }
  sfx?: {
    maxVoices?: number
    groups?: Record<string, number>
  }
  ui?: Record<string, string>
}

export interface AudioUserSettings {
  buses?: Partial<Record<AudioBus, AudioBusSettings>>
}
