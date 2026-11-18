import type { VoiceAuthoringSnapshot, VoiceTake } from '@advjs/types'
import type { AudioGenerationCost, VoiceGenerationBudget, VoiceGenerationJob, VoiceGenerationResolvedInput } from './contracts'
import { audioFingerprint, voiceInputFingerprint } from '../fingerprint'
import { assertAudioId, createAudioId } from '../ids'
import { normalizeAudioLocale } from '../locale'
import { prepareVoiceSpokenText, resolveVoiceSpokenText } from '../spoken-text'
import { findVoiceTakeByFingerprint } from '../voice-ledger'

export interface VoiceGenerationPlanLine extends VoiceGenerationResolvedInput {
  estimatedCost: AudioGenerationCost | null
}

export type VoiceGenerationSelectionMode = 'all' | 'missing' | 'stale'

/** Shared Editor/Studio selection against the inspected, exact generation input. */
export function voiceGenerationTargetMatches(mode: VoiceGenerationSelectionMode, selected: Pick<VoiceTake, 'inputFingerprint'> | undefined, fingerprint: string): boolean {
  if (mode === 'missing')
    return !selected
  if (mode === 'stale')
    return Boolean(selected && selected.inputFingerprint !== fingerprint)
  return true
}

export function validateVoiceGenerationBudget(budget: VoiceGenerationBudget) {
  if (!Number.isSafeInteger(budget.maxCharacters) || budget.maxCharacters < 1 || !Number.isInteger(budget.concurrency) || budget.concurrency < 1 || budget.concurrency > 32 || typeof budget.allowUnknownCost !== 'boolean')
    throw new Error('AUDIO_JOB_BUDGET_INVALID: Character and concurrency limits must be explicitly reviewed')
  if (budget.maxCost)
    validateAudioGenerationCost(budget.maxCost)
}

export function validateAudioGenerationCost(cost: AudioGenerationCost) {
  if (!/^[A-Z]{3}$/u.test(cost.currency) || !Number.isSafeInteger(cost.amountMicros) || cost.amountMicros < 0)
    throw new Error('AUDIO_JOB_COST_INVALID: Costs require a currency and nonnegative integer millionths')
}

export async function voiceGenerationInputFingerprint(input: VoiceGenerationResolvedInput, pronunciation = input.pronunciation) {
  const prepared = await prepareVoiceSpokenText(input.displayText, { override: input.spokenText, locale: input.locale, pronunciation })
  return await voiceInputFingerprint({ spokenText: prepared.text, locale: input.locale, speakerId: input.speakerId, providerId: input.providerId, voiceId: input.voiceId, model: input.model, voiceProfileRevision: input.voiceProfileRevision, parameters: input.parameters, ...(prepared.pronunciationRevision ? { pronunciationRevision: prepared.pronunciationRevision } : {}) })
}

/** Review this immutable plan before enqueueing. It contains no request prose. */
export async function planVoiceGeneration(input: { accountId: string, projectId: string, snapshot: VoiceAuthoringSnapshot, lines: VoiceGenerationPlanLine[], budget: VoiceGenerationBudget, now?: number, retentionDays?: number }): Promise<VoiceGenerationJob> {
  validateVoiceGenerationBudget(input.budget)
  if (!input.accountId.trim() || !input.projectId.trim())
    throw new Error('AUDIO_JOB_SCOPE_INVALID: Account and project scope are required')
  const retentionDays = input.retentionDays ?? 30
  if (!Number.isInteger(retentionDays) || retentionDays < 30 || retentionDays > 3650)
    throw new Error('AUDIO_JOB_RETENTION_INVALID: Recoverable idempotency must be retained for at least 30 days')
  const now = input.now ?? Date.now()
  const tasks: VoiceGenerationJob['tasks'] = []
  const targets = new Set<string>()
  const newFingerprints = new Set<string>()
  let characters = 0
  let cost: AudioGenerationCost | null | undefined
  for (const line of input.lines) {
    assertAudioId(line.lineId, 'line')
    const locale = normalizeAudioLocale(line.locale)
    if (!line.providerId.trim() || !line.voiceId.trim() || !line.model.trim() || !/^[a-f0-9]{64}$/u.test(line.voiceProfileRevision))
      throw new Error('AUDIO_JOB_PROFILE_INVALID: A reviewed provider, actual voice, model and profile hash are required')
    const target = `${line.lineId}:${locale}`
    if (targets.has(target))
      throw new Error('AUDIO_JOB_TARGET_DUPLICATE: Plan each line and exact locale once')
    targets.add(target)
    const inputFingerprint = await voiceGenerationInputFingerprint({ ...line, locale }, input.snapshot.pronunciation)
    const cached = findVoiceTakeByFingerprint(input.snapshot.ledger, line.lineId, locale, inputFingerprint)
    if (cached) {
      const asset = input.snapshot.catalog.assets.find(asset => asset.id === cached.assetId)
      if (!asset || asset.type !== 'audio' || asset.kind !== 'voice' || asset.sha256 !== cached.sha256 || asset.state === 'rejected')
        throw new Error('AUDIO_JOB_CACHE_MEDIA_INVALID: Restore or review the existing immutable take before planning more synthesis')
    }
    const idempotencyKey = await audioFingerprint({ accountId: input.accountId, projectId: input.projectId, inputFingerprint })
    const characterCount = Array.from(resolveVoiceSpokenText(line.displayText, { override: line.spokenText, locale, pronunciation: input.snapshot.pronunciation })).length
    if (line.estimatedCost)
      validateAudioGenerationCost(line.estimatedCost)
    if (!cached && !newFingerprints.has(inputFingerprint)) {
      characters += characterCount
      newFingerprints.add(inputFingerprint)
      if (line.estimatedCost) {
        validateAudioGenerationCost(line.estimatedCost)
        if (cost !== null) {
          if (cost && cost.currency !== line.estimatedCost.currency)
            throw new Error('AUDIO_JOB_COST_CURRENCY: Review separate jobs for different currencies')
          cost = { currency: line.estimatedCost.currency, amountMicros: (cost?.amountMicros ?? 0) + line.estimatedCost.amountMicros }
        }
      }
      else {
        cost = null
      }
    }
    tasks.push({ id: createAudioId('job'), lineId: line.lineId, locale, speakerId: line.speakerId, providerId: line.providerId, voiceId: line.voiceId, model: line.model, voiceProfileRevision: line.voiceProfileRevision, inputFingerprint, idempotencyKey, characterCount, estimatedCost: line.estimatedCost, status: 'queued', attempts: 0, ...(cached ? { takeId: cached.id, assetId: cached.assetId } : {}) })
  }
  if (characters > input.budget.maxCharacters)
    throw new Error('AUDIO_JOB_CHARACTER_LIMIT: The reviewed plan exceeds its character budget')
  if (newFingerprints.size && cost === null && (!input.budget.allowUnknownCost || input.budget.maxCost))
    throw new Error('AUDIO_JOB_UNKNOWN_COST: Unknown provider cost requires explicit review without an unenforceable cost cap')
  if (cost && input.budget.maxCost && (cost.currency !== input.budget.maxCost.currency || cost.amountMicros > input.budget.maxCost.amountMicros))
    throw new Error('AUDIO_JOB_COST_LIMIT: The reviewed plan exceeds its cost budget')
  return {
    schemaVersion: 1,
    id: createAudioId('job'),
    accountId: input.accountId,
    projectId: input.projectId,
    createdAt: new Date(now).toISOString(),
    updatedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + retentionDays * 86_400_000).toISOString(),
    retentionDays,
    budget: structuredClone(input.budget),
    summary: { lines: tasks.length, characters, cacheHits: tasks.length - newFingerprints.size, newGenerations: newFingerprints.size, estimatedCost: cost ?? null },
    chargedCharacters: 0,
    chargedCostMicros: 0,
    cancelled: false,
    tasks,
  }
}
