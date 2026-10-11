import type { AdvVoiceSynthesisResult, JsonObject } from '@advjs/types'
import type { VoiceListResult } from '../commands/voice'
import { canonicalAudioJson } from '@advjs/audio'
import { AdvCommandError } from '../commands/errors'

function changed(): never {
  throw new AdvCommandError('ADV_VALIDATION', 'VOICE_PROVENANCE_CHANGED: Synthesis differs from the reviewed provider implementation')
}

/** One canonical parameter record for single-line and durable batch generation. */
export function canonicalVoiceGenerationParameters(inspected: VoiceListResult, speakerId: string, presetSha256: string): JsonObject {
  const actual = inspected.characters.find(character => character.id === speakerId)?.generation
  if (!actual || (inspected.presetSha256 !== undefined && inspected.presetSha256 !== presetSha256))
    changed()
  const parameters: JsonObject = {
    ...actual.parameters,
    preset: inspected.preset,
    presetSha256,
    ...(actual.revision === undefined ? {} : { modelRevision: actual.revision }),
    ...(actual.referenceAssetId === undefined ? {} : { referenceAssetId: actual.referenceAssetId }),
    ...(actual.referenceSha256 === undefined ? {} : { referenceSha256: actual.referenceSha256 }),
    ...(inspected.seed === undefined ? {} : { seed: inspected.seed }),
    ...(inspected.referenceMode === undefined ? {} : { referenceMode: inspected.referenceMode }),
  }
  canonicalAudioJson(parameters)
  return parameters
}

/** Provider adapters are trusted, but their returned provenance must match review. */
export function assertVoiceSynthesisProvenance(result: AdvVoiceSynthesisResult, reviewed: {
  providerId: string
  preset: string
  speakerId: string
  voiceId: string
  model: string
  mimeType?: string
  parameters: JsonObject
}) {
  const candidate = result.candidates.find(candidate => candidate.characterId === reviewed.speakerId)
  if (result.provider !== reviewed.providerId || result.preset !== reviewed.preset || result.candidates.length !== 1 || !candidate
    || candidate.providerVoiceId !== reviewed.voiceId || candidate.model !== reviewed.model
    || (reviewed.mimeType !== undefined && candidate.mimeType !== reviewed.mimeType)
    || (reviewed.parameters.modelRevision !== undefined && candidate.revision !== reviewed.parameters.modelRevision)) {
    changed()
  }
  const inputs = result.manifest.inputs
  const input = Array.isArray(inputs) ? inputs.find(value => value && typeof value === 'object' && !Array.isArray(value) && value.characterId === reviewed.speakerId) : undefined
  const actualInput = input && typeof input === 'object' && !Array.isArray(input) ? input : {}
  for (const [key, expected] of Object.entries(reviewed.parameters)) {
    const actualKey = key === 'modelRevision' ? 'revision' : key
    const actual = actualInput[key] ?? result.manifest[key] ?? result.manifest[actualKey]
    if (actual !== undefined && canonicalAudioJson(actual) !== canonicalAudioJson(expected))
      changed()
  }
  if ((result.manifest.model !== undefined && result.manifest.model !== reviewed.model)
    || (actualInput.providerVoiceId !== undefined && actualInput.providerVoiceId !== reviewed.voiceId)) {
    changed()
  }
}
