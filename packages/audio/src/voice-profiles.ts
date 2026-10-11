import type { AudioVoiceProfiles } from '@advjs/types'
import { canonicalAudioJson } from './fingerprint'
import { validateCharacterVoiceProfile } from './voice-ledger'

export const AUDIO_VOICE_PROFILES_PATH = 'adv/audio/voice-profiles.json'

export function createAudioVoiceProfiles(): AudioVoiceProfiles {
  return { schemaVersion: 1, revision: 0 }
}

export function parseAudioVoiceProfiles(value: unknown): AudioVoiceProfiles {
  if (typeof value === 'string') {
    if (value.length > 131072)
      throw new Error('AUDIO_VOICE_PROFILES_LIMIT')
    value = JSON.parse(value)
  }
  const canonical = canonicalAudioJson(value)
  if (canonical.length > 131072)
    throw new Error('AUDIO_VOICE_PROFILES_LIMIT')
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('AUDIO_VOICE_PROFILES_INVALID')
  const source = value as Record<string, unknown>
  if (Object.keys(source).some(key => !['schemaVersion', 'revision', 'narrator'].includes(key)) || source.schemaVersion !== 1 || !Number.isSafeInteger(source.revision) || Number(source.revision) < 0)
    throw new Error('AUDIO_VOICE_PROFILES_INVALID: Use schemaVersion 1 and a nonnegative revision')
  if (source.narrator !== undefined)
    validateCharacterVoiceProfile(source.narrator)
  return JSON.parse(canonical) as AudioVoiceProfiles
}

export function activeAudioVoiceProfiles(value?: AudioVoiceProfiles): AudioVoiceProfiles | undefined {
  const profiles = parseAudioVoiceProfiles(value ?? createAudioVoiceProfiles())
  return profiles.revision || profiles.narrator ? profiles : undefined
}

export function serializeAudioVoiceProfiles(value: AudioVoiceProfiles): string {
  return `${JSON.stringify(parseAudioVoiceProfiles(value), null, 2)}\n`
}
