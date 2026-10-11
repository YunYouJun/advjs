import type { CharacterVoiceProfile } from './voice'

/** Project-owned narrator intent without a fabricated character. */
export interface AudioVoiceProfiles {
  schemaVersion: 1
  revision: number
  narrator?: CharacterVoiceProfile
}
