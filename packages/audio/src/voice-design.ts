import type { AdvVoiceLibrary, AdvVoiceProfile, CharacterVoiceProfile, DesignedVoiceProfile, VoiceDesignDraft, VoiceDesignRecord, VoiceDesignSample } from '@advjs/types'
import { canonicalAudioJson } from './fingerprint'
import { normalizeAudioLocale } from './locale'
import { validateCharacterVoiceProfile, validateVoiceRights } from './voice-ledger'

export const VOICE_DESIGN_LIBRARY_PATH = 'authoring/voices/library.json'
export const VOICE_DESIGN_PRESET_ROOT = 'authoring/voices/designs'
const ID = /^[a-z0-9][\w.-]{0,79}$/u
const HASH = /^[a-f0-9]{64}$/u

export function voiceDesignId(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !ID.test(value))
    throw new Error('VOICE_DESIGN_ID_INVALID')
}
function object(value: unknown, fields?: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || (fields && Object.keys(value).some(key => !fields.includes(key))))
    throw new Error('VOICE_DESIGN_SCHEMA_INVALID')
  return value as Record<string, unknown>
}
function text(value: unknown, max = 4096): asserts value is string {
  if (typeof value !== 'string' || !value.trim() || Array.from(value).length > max)
    throw new Error('VOICE_DESIGN_TEXT_INVALID')
}

export function parseVoiceDesignDraft(value: unknown): VoiceDesignDraft {
  canonicalAudioJson(value)
  const input = object(value, ['id', 'version', 'characterId', 'label', 'intent', 'locales', 'supersedes'])
  for (const field of ['id', 'version', 'characterId'])
    voiceDesignId(input[field])
  text(input.label, 160)
  validateCharacterVoiceProfile({ intent: input.intent })
  const locales = object(input.locales)
  if (!Object.keys(locales).length || Object.keys(locales).length > 32)
    throw new Error('VOICE_DESIGN_LOCALES_INVALID')
  for (const [locale, raw] of Object.entries(locales)) {
    if (normalizeAudioLocale(locale) !== locale)
      throw new Error('VOICE_DESIGN_LOCALE_INVALID')
    const providers = object(object(raw, ['providers']).providers)
    if (!Object.keys(providers).length || Object.keys(providers).length > 16)
      throw new Error('VOICE_DESIGN_PROVIDERS_INVALID')
    for (const [providerId, source] of Object.entries(providers)) {
      voiceDesignId(providerId)
      const binding = object(source, ['preset', 'source', 'providerVoiceId', 'description', 'reference', 'rights'])
      voiceDesignId(binding.preset)
      if (!['system', 'designed', 'cloned'].includes(String(binding.source)))
        throw new Error('VOICE_DESIGN_SOURCE_UNSUPPORTED')
      if (binding.source === 'system') {
        text(binding.providerVoiceId, 256)
        if (binding.description !== undefined || binding.reference !== undefined || binding.rights !== undefined)
          throw new Error('VOICE_DESIGN_SOURCE_INVALID')
      }
      if (binding.source === 'designed') {
        text(binding.description)
        if (binding.providerVoiceId !== undefined || binding.reference !== undefined || binding.rights !== undefined)
          throw new Error('VOICE_DESIGN_SOURCE_INVALID')
      }
      if (binding.source === 'cloned') {
        const reference = object(binding.reference, ['assetId', 'sha256', 'text', 'mode'])
        text(reference.assetId, 256)
        if (!HASH.test(String(reference.sha256)) || (reference.mode !== undefined && !['icl', 'embedding-only'].includes(String(reference.mode))))
          throw new Error('VOICE_DESIGN_REFERENCE_INVALID')
        if (reference.text !== undefined)
          text(reference.text)
        if (reference.mode === 'icl')
          text(reference.text)
        if (binding.providerVoiceId !== undefined || binding.description !== undefined)
          throw new Error('VOICE_DESIGN_SOURCE_INVALID')
        validateVoiceRights(binding.rights)
      }
    }
  }
  if (input.supersedes !== undefined) {
    const prior = object(input.supersedes, ['id', 'version'])
    voiceDesignId(prior.id)
    voiceDesignId(prior.version)
    if (prior.id === input.id)
      throw new Error('VOICE_DESIGN_NEW_VERSION_ID_REQUIRED')
  }
  return JSON.parse(canonicalAudioJson(value)) as VoiceDesignDraft
}

export const validateVoiceDesignDraft = parseVoiceDesignDraft

/** Legacy author metadata is preserved; only the new finite design schema is strict. */
export function parseVoiceDesignLibrary(value: unknown): AdvVoiceLibrary {
  if (typeof value === 'string') {
    if (new TextEncoder().encode(value).byteLength > 1024 * 1024)
      throw new Error('VOICE_DESIGN_LIBRARY_LIMIT')
    value = JSON.parse(value)
  }
  const raw = canonicalAudioJson(value)
  if (new TextEncoder().encode(raw).byteLength > 1024 * 1024)
    throw new Error('VOICE_DESIGN_LIBRARY_LIMIT')
  const library = object(value)
  if (library.schemaVersion !== 1 || !Array.isArray(library.voices) || library.voices.length > 500)
    throw new Error('VOICE_DESIGN_LIBRARY_INVALID')
  const ids = new Set<string>()
  for (const entry of library.voices) {
    const voice = object(entry)
    voiceDesignId(voice.id)
    text(voice.version, 80)
    voiceDesignId(voice.characterId)
    text(voice.label, 160)
    object(voice.implementations)
    if (ids.has(String(voice.id)))
      throw new Error('VOICE_DESIGN_ID_DUPLICATE')
    ids.add(String(voice.id))
    if (voice.design === undefined)
      continue
    const design = object(voice.design, ['schemaVersion', 'intent', 'locales', 'supersedes', 'samples', 'selectedSamples'])
    if (design.schemaVersion !== 1 || !Array.isArray(design.samples) || design.samples.length > 500)
      throw new Error('VOICE_DESIGN_SCHEMA_INVALID')
    parseVoiceDesignDraft({ id: voice.id, version: voice.version, characterId: voice.characterId, label: voice.label, intent: design.intent, locales: design.locales, ...(design.supersedes ? { supersedes: design.supersedes } : {}) })
    const samples = new Set<string>()
    for (const rawSample of design.samples) {
      const sample = object(rawSample, ['assetId', 'sha256', 'bytes', 'locale', 'providerId', 'providerVoiceId', 'model', 'source', 'text', 'presetSha256', 'createdAt'])
      text(sample.assetId, 256)
      if (samples.has(String(sample.assetId)) || !HASH.test(String(sample.sha256)) || !HASH.test(String(sample.presetSha256)) || !Number.isSafeInteger(sample.bytes) || Number(sample.bytes) <= 0 || normalizeAudioLocale(String(sample.locale)) !== sample.locale || !['system', 'designed', 'cloned'].includes(String(sample.source)))
        throw new Error('VOICE_DESIGN_SAMPLE_INVALID')
      for (const key of ['providerId', 'providerVoiceId', 'model', 'text', 'createdAt'])
        text(sample[key])
      const source = design.locales as VoiceDesignDraft['locales']
      if (source[String(sample.locale)]?.providers[String(sample.providerId)]?.source !== sample.source)
        throw new Error('VOICE_DESIGN_SAMPLE_BINDING_INVALID')
      samples.add(String(sample.assetId))
    }
    for (const [locale, providers] of Object.entries(object(design.selectedSamples))) {
      normalizeAudioLocale(locale)
      for (const [providerId, rawSelection] of Object.entries(object(providers))) {
        const selected = object(rawSelection, ['assetId', 'sha256'])
        if (!design.samples.some((raw) => {
          const sample = raw as VoiceDesignSample
          return sample.assetId === selected.assetId && sample.sha256 === selected.sha256 && sample.locale === locale && sample.providerId === providerId
        })) {
          throw new Error('VOICE_DESIGN_SELECTION_INVALID')
        }
      }
    }
  }
  return JSON.parse(raw) as AdvVoiceLibrary
}

export function voiceDesignVersion(library: AdvVoiceLibrary, id: string): DesignedVoiceProfile {
  voiceDesignId(id)
  const voice = library.voices.find(voice => voice.id === id)
  if (!voice?.design)
    throw new Error('VOICE_DESIGN_VERSION_REQUIRED')
  return voice as DesignedVoiceProfile
}

export function addVoiceDesignVersion(library: AdvVoiceLibrary, draft: VoiceDesignDraft, implementations: AdvVoiceProfile['implementations']): AdvVoiceLibrary {
  draft = parseVoiceDesignDraft(draft)
  const result = parseVoiceDesignLibrary(library)
  if (result.voices.some(voice => voice.id === draft.id))
    throw new Error('VOICE_DESIGN_VERSION_IMMUTABLE')
  if (draft.supersedes && !result.voices.some(voice => voice.id === draft.supersedes!.id && voice.version === draft.supersedes!.version && voice.characterId === draft.characterId))
    throw new Error('VOICE_DESIGN_PRIOR_VERSION_INVALID')
  const design: VoiceDesignRecord = { schemaVersion: 1, intent: draft.intent, locales: draft.locales, ...(draft.supersedes ? { supersedes: draft.supersedes } : {}), samples: [], selectedSamples: {} }
  result.voices.push({ id: draft.id, version: draft.version, characterId: draft.characterId, label: draft.label, implementations, design })
  return parseVoiceDesignLibrary(result)
}

export function applyDesignedVoiceProfile(current: CharacterVoiceProfile | undefined, voice: DesignedVoiceProfile, locale: string, providerId: string, sample: VoiceDesignSample, replaceBinding = false): CharacterVoiceProfile {
  if (sample.locale !== locale || sample.providerId !== providerId || voice.design.selectedSamples[locale]?.[providerId]?.assetId !== sample.assetId)
    throw new Error('VOICE_DESIGN_REVIEWED_SAMPLE_REQUIRED')
  const prior = current?.locales?.[locale]?.providers[providerId]
  const definition = voice.design.locales[locale]?.providers[providerId]
  if (!definition || definition.source !== sample.source)
    throw new Error('VOICE_DESIGN_BINDING_INVALID')
  const binding = { voiceId: sample.providerVoiceId, source: sample.source, model: sample.model, projectVoiceId: voice.id, projectVoiceVersion: voice.version, ...(definition.rights ? { rights: definition.rights } : {}) }
  if (prior && canonicalAudioJson(prior) !== canonicalAudioJson(binding) && !replaceBinding)
    throw new Error('VOICE_DESIGN_REPLACE_REQUIRED')
  const profile: CharacterVoiceProfile = { intent: structuredClone(voice.design.intent), locales: { ...current?.locales, [locale]: { providers: { ...current?.locales?.[locale]?.providers, [providerId]: binding } } } }
  validateCharacterVoiceProfile(profile)
  return profile
}
