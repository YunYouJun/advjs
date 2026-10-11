import type { AdvAssetEntry, CharacterVoiceProfile, VoiceLedger, VoiceLedgerLine, VoiceRights, VoiceTake, VoiceTakeResolution } from '@advjs/types'
import { canonicalAudioJson } from './fingerprint'
import { assertAudioId } from './ids'
import { normalizeAudioLocale } from './locale'
import { normalizeSpokenText } from './spoken-text'

export const VOICE_LEDGER_PATH = 'adv/audio/voice-ledger.json'
const HASH = /^[a-f0-9]{64}$/u
const SLUG = /^[a-z0-9][a-z0-9._-]*$/u

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`${label} must be an object`)
  return value as Record<string, unknown>
}

function keys(value: Record<string, unknown>, allowed: string[], label: string) {
  if (Object.keys(value).some(key => !allowed.includes(key)))
    throw new Error(`${label} has an unknown property`)
}

function text(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || !value.trim())
    throw new Error(`${label} must be a nonempty string`)
}

function hash(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || !HASH.test(value))
    throw new Error(`${label} must be a SHA-256 hash`)
}

export function assertVoiceSpeakerId(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !SLUG.test(value) || value === '.' || value === '..')
    throw new Error('Voice speaker ID must be a stable ASCII character ID or narrator')
}

export function validateVoiceRights(value: unknown): asserts value is VoiceRights {
  const rights = object(value, 'Voice rights')
  keys(rights, ['license', 'subject', 'consentRecord'], 'Voice rights')
  text(rights.license, 'Voice license')
  text(rights.subject, 'Voice rights subject')
  text(rights.consentRecord, 'Voice consent record')
  if (/^(?:[a-z]+:|\/|\\)/iu.test(rights.consentRecord) || rights.consentRecord.split(/[\\/]/u).includes('..'))
    throw new Error('Voice consent record must be a project-relative audit record')
}

function validateTake(value: unknown): asserts value is VoiceTake {
  const take = object(value, 'Voice take')
  keys(take, ['id', 'assetId', 'sha256', 'providerId', 'voiceId', 'model', 'modelRevision', 'voiceProfileRevision', 'inputFingerprint', 'pronunciationRevision', 'spokenText', 'createdAt', 'source', 'rights', 'parameters', 'projectVoiceId', 'projectVoiceVersion'], 'Voice take')
  assertAudioId(take.id, 'take')
  assertAudioId(take.assetId, 'audio')
  hash(take.sha256, 'Voice take asset hash')
  hash(take.voiceProfileRevision, 'Voice Profile revision')
  if (take.pronunciationRevision !== undefined)
    hash(take.pronunciationRevision, 'Pronunciation revision')
  hash(take.inputFingerprint, 'Voice input fingerprint')
  for (const field of ['providerId', 'voiceId', 'model', 'spokenText', 'createdAt'])
    text(take[field], `Voice take ${field}`)
  const createdAt = take.createdAt as string
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/u.test(createdAt)
    || !Number.isFinite(Date.parse(createdAt)) || new Date(createdAt).toISOString().slice(0, 10) !== createdAt.slice(0, 10)) {
    throw new Error('Voice take createdAt must be a valid UTC ISO timestamp')
  }
  if (!['system', 'designed', 'recorded', 'cloned'].includes(String(take.source)))
    throw new Error('Invalid Voice take source')
  if (take.rights !== undefined)
    validateVoiceRights(take.rights)
  if (take.source === 'cloned' && take.rights === undefined)
    throw new Error('Cloned voices require a consent record and rights metadata')
  if (take.parameters !== undefined)
    object(take.parameters, 'Voice take parameters')
  for (const field of ['modelRevision', 'projectVoiceId', 'projectVoiceVersion']) {
    if (take[field] !== undefined)
      text(take[field], `Voice take ${field}`)
  }
}

/** Strict shared validation; plain JSON is the only interchange protocol. */
export function parseVoiceLedger(value: string | unknown): VoiceLedger {
  const parsed: unknown = typeof value === 'string' ? JSON.parse(value) : value
  canonicalAudioJson(parsed)
  const ledger = object(parsed, 'Voice ledger')
  keys(ledger, ['schemaVersion', 'lines'], 'Voice ledger')
  if (ledger.schemaVersion !== 1)
    throw new Error('Voice ledger must declare schemaVersion 1')
  const lines = object(ledger.lines, 'Voice ledger lines')
  const takeIds = new Set<string>()
  const assetIds = new Set<string>()
  for (const [lineId, input] of Object.entries(lines)) {
    assertAudioId(lineId, 'line')
    const line = object(input, 'Voice ledger line')
    keys(line, ['speakerId', 'displayText', 'spokenText', 'locales'], 'Voice ledger line')
    assertVoiceSpeakerId(line.speakerId)
    text(line.displayText, 'Voice line displayText')
    if (line.spokenText !== undefined)
      text(line.spokenText, 'Voice line spokenText')
    const locales = object(line.locales, 'Voice line locales')
    for (const [locale, localeValue] of Object.entries(locales)) {
      if (normalizeAudioLocale(locale) !== locale)
        throw new Error('Voice ledger locale keys must be canonical BCP 47')
      const binding = object(localeValue, 'Voice locale binding')
      keys(binding, ['selectedTake', 'takes', 'displayText', 'spokenText'], 'Voice locale binding')
      for (const field of ['displayText', 'spokenText']) {
        if (binding[field] !== undefined)
          text(binding[field], `Voice locale ${field}`)
      }
      if (binding.selectedTake !== null)
        assertAudioId(binding.selectedTake, 'take')
      if (!Array.isArray(binding.takes))
        throw new Error('Voice locale binding takes must be an array')
      for (const take of binding.takes) {
        validateTake(take)
        if (takeIds.has(take.id) || assetIds.has(take.assetId))
          throw new Error('Voice take IDs and asset IDs must be unique across the ledger')
        takeIds.add(take.id)
        assetIds.add(take.assetId)
      }
      if (binding.selectedTake !== null && !binding.takes.some(take => take.id === binding.selectedTake))
        throw new Error('Selected Voice take is missing from its line and locale')
    }
  }
  return JSON.parse(JSON.stringify(parsed)) as VoiceLedger
}

export function serializeVoiceLedger(ledger: VoiceLedger): string {
  return `${JSON.stringify(parseVoiceLedger(ledger), null, 2)}\n`
}

export function createVoiceLedger(): VoiceLedger {
  return { schemaVersion: 1, lines: {} }
}

/** Exact input cache lookup for planners; reuse never selects a take implicitly. */
export function findVoiceTakeByFingerprint(ledger: VoiceLedger, lineId: string, locale: string, fingerprint: string): VoiceTake | undefined {
  assertAudioId(lineId, 'line')
  hash(fingerprint, 'Voice input fingerprint')
  return ledger.lines[lineId]?.locales[normalizeAudioLocale(locale)]?.takes.find(take => take.inputFingerprint === fingerprint)
}

export function validateCharacterVoiceProfile(value: unknown): asserts value is CharacterVoiceProfile {
  canonicalAudioJson(value)
  const profile = object(value, 'Character Voice Profile')
  keys(profile, ['intent', 'locales'], 'Character Voice Profile')
  const intent = object(profile.intent, 'Voice intent')
  keys(intent, ['ageImpression', 'genderExpression', 'temperament', 'speakingStyle', 'pitch', 'pace'], 'Voice intent')
  for (const field of ['ageImpression', 'genderExpression', 'speakingStyle']) {
    if (intent[field] !== undefined)
      text(intent[field], `Voice intent ${field}`)
  }
  if (intent.temperament !== undefined && (!Array.isArray(intent.temperament) || !intent.temperament.every(item => typeof item === 'string' && item.trim())))
    throw new Error('Voice temperament must be a string array')
  if (intent.pitch !== undefined && !['low', 'medium', 'high'].includes(String(intent.pitch)))
    throw new Error('Invalid Voice intent pitch')
  if (intent.pace !== undefined && !['slow', 'medium', 'fast'].includes(String(intent.pace)))
    throw new Error('Invalid Voice intent pace')
  if (profile.locales === undefined)
    return
  for (const [locale, localeInput] of Object.entries(object(profile.locales, 'Voice Profile locales'))) {
    if (normalizeAudioLocale(locale) !== locale)
      throw new Error('Voice Profile locale keys must be canonical BCP 47')
    const binding = object(localeInput, 'Voice Profile locale')
    keys(binding, ['providers'], 'Voice Profile locale')
    for (const [providerId, providerInput] of Object.entries(object(binding.providers, 'Voice Profile providers'))) {
      text(providerId, 'Voice provider ID')
      const provider = object(providerInput, 'Voice provider binding')
      keys(provider, ['voiceId', 'source', 'model', 'rights', 'projectVoiceId', 'projectVoiceVersion'], 'Voice provider binding')
      for (const field of ['projectVoiceId', 'projectVoiceVersion']) {
        if (provider[field] !== undefined)
          text(provider[field], `Voice provider ${field}`)
      }
      if ((provider.projectVoiceId === undefined) !== (provider.projectVoiceVersion === undefined))
        throw new Error('Project voice identity and version must be supplied together')
      text(provider.voiceId, 'Voice provider voiceId')
      if (provider.model !== undefined)
        text(provider.model, 'Voice provider model')
      if (!['system', 'designed', 'recorded', 'cloned'].includes(String(provider.source)))
        throw new Error('Invalid Voice provider source')
      if (provider.rights !== undefined)
        validateVoiceRights(provider.rights)
      if (provider.source === 'cloned' && provider.rights === undefined)
        throw new Error('Cloned voices require a consent record and rights metadata')
    }
  }
}

/** Exact locale only. Hash mismatches are errors; stale historical takes remain playable. */
interface VoiceTakeResolveInput {
  lineId: string
  locale: string
  assets: readonly AdvAssetEntry[]
  spokenText?: string
  voiceProfileRevision?: string
  inputFingerprint?: string
  pronunciationRevision?: string | null
}

export function resolveVoiceTake(ledger: VoiceLedger, input: VoiceTakeResolveInput): VoiceTakeResolution
export function resolveVoiceTake(ledger: VoiceLedger, lineId: string, locale: string, assets: Record<string, { kind: string, sha256?: string }>): VoiceTakeResolution
export function resolveVoiceTake(ledger: VoiceLedger, value: VoiceTakeResolveInput | string, requestedLocale?: string, assets?: Record<string, { kind: string, sha256?: string }>): VoiceTakeResolution {
  const input: VoiceTakeResolveInput = typeof value === 'string'
    ? { lineId: value, locale: requestedLocale!, assets: Object.entries(assets ?? {}).map(([id, asset]) => ({ ...asset, id, type: 'audio' })) }
    : value
  const locale = normalizeAudioLocale(input.locale)
  const line = ledger.lines[input.lineId]
  const binding = line?.locales[locale]
  if (!binding?.selectedTake)
    return { warnings: [] }
  const take = binding.takes.find(take => take.id === binding.selectedTake)
  if (!take)
    throw new Error('Selected Voice take is missing')
  const asset = input.assets.find(asset => asset.id === take.assetId)
  if (!asset || asset.type !== 'audio' || asset.kind !== 'voice' || asset.sha256 !== take.sha256)
    throw new Error('Selected Voice take asset is missing or its SHA-256 differs from the ledger')
  const currentText = input.spokenText ?? normalizeSpokenText(binding.displayText ?? line!.displayText, { override: binding.spokenText ?? line!.spokenText })
  const stale = take.spokenText !== currentText
    || (input.pronunciationRevision !== undefined && input.pronunciationRevision !== (take.pronunciationRevision ?? null))
    || (input.voiceProfileRevision !== undefined && input.voiceProfileRevision !== take.voiceProfileRevision)
    || (input.inputFingerprint !== undefined && input.inputFingerprint !== take.inputFingerprint)
  return { take, warnings: stale ? [{ code: 'VOICE_STALE', message: `Selected take for ${input.lineId} (${locale}) uses earlier text or voice settings` }] : [] }
}

/** Merge additions, but never overwrite an immutable take or silently choose a winner. */
export function mergeVoiceLedgers(base: VoiceLedger, incoming: VoiceLedger): VoiceLedger {
  const merged = parseVoiceLedger(base)
  for (const [lineId, incomingLine] of Object.entries(parseVoiceLedger(incoming).lines)) {
    const existing = merged.lines[lineId]
    if (!existing) {
      merged.lines[lineId] = incomingLine
      continue
    }
    if (existing.speakerId !== incomingLine.speakerId || existing.displayText !== incomingLine.displayText || existing.spokenText !== incomingLine.spokenText)
      throw new Error('VOICE_CONFLICT: Dialogue metadata changed in both ledger inputs')
    for (const [locale, binding] of Object.entries(incomingLine.locales)) {
      const current = existing.locales[locale]
      if (!current) {
        existing.locales[locale] = binding
        continue
      }
      if (current.selectedTake !== binding.selectedTake)
        throw new Error('VOICE_CONFLICT: Both ledgers selected different takes')
      if (current.displayText !== binding.displayText || current.spokenText !== binding.spokenText)
        throw new Error('VOICE_CONFLICT: Localized dialogue metadata changed in both ledger inputs')
      for (const take of binding.takes) {
        const duplicate = current.takes.find(item => item.id === take.id)
        if (duplicate && canonicalAudioJson(duplicate) !== canonicalAudioJson(take))
          throw new Error('VOICE_CONFLICT: An immutable Voice take changed')
        if (!duplicate)
          current.takes.push(take)
      }
    }
  }
  return parseVoiceLedger(merged)
}

/** Update prose explicitly, preserving immutable history to expose staleness. */
export function updateVoiceLedgerLine(ledger: VoiceLedger, lineId: string, input: Omit<VoiceLedgerLine, 'locales'>): VoiceLedger {
  assertAudioId(lineId, 'line')
  const result = parseVoiceLedger(ledger)
  const current = result.lines[lineId]
  if (current && current.speakerId !== input.speakerId)
    throw new Error('VOICE_CONFLICT: A persistent line cannot change its speaker')
  result.lines[lineId] = { ...input, locales: current?.locales ?? {} }
  return parseVoiceLedger(result)
}
