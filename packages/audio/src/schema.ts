import type { AudioMixerConfig, AudioTrackState, AudioUserSettings, RuntimeAudioState } from '@advjs/types'

export const audioBuses = ['master', 'music', 'ambience', 'voice', 'sfx', 'ui'] as const
export const ambienceSlots = ['bed', 'weather', 'crowd', 'detail'] as const

function record(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`${path} must be an object`)
  return value as Record<string, unknown>
}

function keys(value: Record<string, unknown>, allowed: readonly string[], path: string) {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key))
      throw new Error(`${path}.${key} is not supported`)
  }
}

function numeric(value: unknown, path: string, min: number, max: number, integer = false) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value)))
    throw new Error(`${path} must be ${integer ? 'an integer' : 'a number'} in ${min}..${max}`)
}

function optionalBoolean(value: unknown, path: string) {
  if (value !== undefined && typeof value !== 'boolean')
    throw new Error(`${path} must be a boolean`)
}

function assetId(value: unknown, path: string) {
  if (typeof value !== 'string' || !value.trim() || value !== value.trim() || /[\s\\:?#]/u.test(value) || value.includes(String.fromCharCode(0)) || value.split('/').some(part => !part || part === '.' || part === '..'))
    throw new Error(`${path} must be a stable asset ID, not a URL or path traversal`)
}

function buses(value: unknown, path: string) {
  const settings = record(value, path)
  keys(settings, audioBuses, path)
  for (const [bus, raw] of Object.entries(settings)) {
    const setting = record(raw, `${path}.${bus}`)
    keys(setting, ['gain', 'muted', 'solo'], `${path}.${bus}`)
    if (setting.gain !== undefined)
      numeric(setting.gain, `${path}.${bus}.gain`, 0, 1)
    optionalBoolean(setting.muted, `${path}.${bus}.muted`)
    optionalBoolean(setting.solo, `${path}.${bus}.solo`)
  }
}

export function parseAudioUserSettings(value: unknown): AudioUserSettings {
  const config = record(value, 'audio settings')
  keys(config, ['buses'], 'audio settings')
  if (config.buses !== undefined)
    buses(config.buses, 'audio settings.buses')
  return structuredClone(value) as AudioUserSettings
}

export function parseAudioMixerConfig(value: unknown): AudioMixerConfig {
  const config = record(value, 'audio mixer')
  keys(config, ['schemaVersion', 'buses', 'ducking', 'sfx', 'ui'], 'audio mixer')
  if (config.schemaVersion !== 1)
    throw new Error('audio mixer.schemaVersion must be 1')
  if (config.buses !== undefined)
    buses(config.buses, 'audio mixer.buses')
  if (config.ducking !== undefined) {
    const duck = record(config.ducking, 'audio mixer.ducking')
    keys(duck, ['enabled', 'gain', 'attackMs', 'releaseMs'], 'audio mixer.ducking')
    optionalBoolean(duck.enabled, 'audio mixer.ducking.enabled')
    if (duck.gain !== undefined)
      numeric(duck.gain, 'audio mixer.ducking.gain', 0, 1)
    for (const key of ['attackMs', 'releaseMs']) {
      if (duck[key] !== undefined)
        numeric(duck[key], `audio mixer.ducking.${key}`, 0, 60000)
    }
  }
  if (config.sfx !== undefined) {
    const sfx = record(config.sfx, 'audio mixer.sfx')
    keys(sfx, ['maxVoices', 'groups'], 'audio mixer.sfx')
    if (sfx.maxVoices !== undefined)
      numeric(sfx.maxVoices, 'audio mixer.sfx.maxVoices', 1, 256, true)
    if (sfx.groups !== undefined) {
      for (const [group, limit] of Object.entries(record(sfx.groups, 'audio mixer.sfx.groups'))) {
        if (!group.trim())
          throw new Error('audio mixer.sfx.groups requires nonempty names')
        numeric(limit, `audio mixer.sfx.groups.${group}`, 1, 256, true)
      }
    }
  }
  if (config.ui !== undefined) {
    for (const [cue, assetId] of Object.entries(record(config.ui, 'audio mixer.ui'))) {
      if (!cue.trim() || typeof assetId !== 'string' || !assetId.trim())
        throw new Error('audio mixer.ui requires nonempty cues and asset IDs')
      parseAudioTrackState({ assetId })
    }
  }
  return structuredClone(value) as AudioMixerConfig
}

export function parseAudioTrackState(value: unknown): AudioTrackState {
  const track = record(value, 'audio track')
  keys(track, ['assetId', 'gain', 'loop', 'fadeInMs', 'fadeOutMs'], 'audio track')
  assetId(track.assetId, 'audio track.assetId')
  if (track.gain !== undefined)
    numeric(track.gain, 'audio track.gain', 0, 1)
  optionalBoolean(track.loop, 'audio track.loop')
  for (const key of ['fadeInMs', 'fadeOutMs']) {
    if (track[key] !== undefined)
      numeric(track[key], `audio track.${key}`, 0, 60000)
  }
  return structuredClone(value) as AudioTrackState
}

export function parseRuntimeAudioState(value: unknown): RuntimeAudioState {
  const state = record(value, 'runtime audio state')
  keys(state, ['bgm', 'ambience'], 'runtime audio state')
  const layers = record(state.ambience, 'runtime audio state.ambience')
  keys(layers, ambienceSlots, 'runtime audio state.ambience')
  return {
    bgm: state.bgm === null ? null : parseAudioTrackState(state.bgm),
    ambience: Object.fromEntries(Object.entries(layers).map(([slot, track]) => [slot, parseAudioTrackState(track)])),
  }
}
