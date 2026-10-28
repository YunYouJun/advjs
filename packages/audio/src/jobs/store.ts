import type { VoiceGenerationStore, VoiceGenerationStoreDocument } from './contracts'
import { canonicalAudioJson } from '../fingerprint'
import { assertAudioId } from '../ids'
import { normalizeAudioLocale } from '../locale'
import { parseVoiceAlignmentTiming } from '../voice-alignment'
import { validateAudioGenerationCost, validateVoiceGenerationBudget } from './planner'

export function emptyVoiceGenerationStore(): VoiceGenerationStoreDocument {
  return { schemaVersion: 1, jobs: {}, idempotency: {} }
}

/** Reject request prose and unsafe logs even when restoring untrusted disk state. */
export function parseVoiceGenerationStore(value: unknown): VoiceGenerationStoreDocument {
  canonicalAudioJson(value)
  function record(raw: unknown, allowed: string[]) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) || Object.keys(raw).some(key => !allowed.includes(key)))
      throw new Error('AUDIO_JOB_STORE_INVALID: Unsupported durable job fields')
  }
  function dictionary(raw: unknown) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) || Object.getPrototypeOf(raw) !== Object.prototype)
      throw new Error('AUDIO_JOB_STORE_INVALID: Durable collections must be plain JSON records')
  }
  function identity(raw: unknown) {
    return typeof raw === 'string' && Boolean(raw.trim())
  }
  function cost(raw: unknown) {
    record(raw, ['currency', 'amountMicros'])
    validateAudioGenerationCost(raw as NonNullable<VoiceGenerationStoreDocument['jobs'][string]['summary']['estimatedCost']>)
  }
  function date(raw: string) {
    if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(raw) || !Number.isFinite(Date.parse(raw)) || new Date(raw).toISOString() !== raw)
      throw new Error('AUDIO_JOB_STORE_INVALID: Durable timestamps must use canonical UTC dates')
  }
  function safePath(path: string) {
    if (typeof path !== 'string' || !path || /^(?:[a-z]+:|\/|\\)/iu.test(path) || path.includes('\\') || path.split('/').some(part => !part || ['.', '..', '.git', 'node_modules'].includes(part.toLowerCase())))
      throw new Error('AUDIO_JOB_STORE_INVALID: Media recovery coordinates must be bounded project paths')
  }
  const state = value as VoiceGenerationStoreDocument
  record(value, ['schemaVersion', 'jobs', 'idempotency'])
  if (state.schemaVersion !== 1 || !state.jobs || !state.idempotency)
    throw new Error('AUDIO_JOB_STORE_INVALID: Expected generation store schema v1')
  dictionary(state.jobs)
  dictionary(state.idempotency)
  for (const [id, job] of Object.entries(state.jobs)) {
    record(job, ['schemaVersion', 'id', 'accountId', 'projectId', 'createdAt', 'updatedAt', 'expiresAt', 'retentionDays', 'budget', 'summary', 'chargedCharacters', 'chargedCostMicros', 'cancelled', 'tasks'])
    assertAudioId(id, 'job')
    for (const timestamp of [job.createdAt, job.updatedAt, job.expiresAt])
      date(timestamp)
    if (id !== job.id || job.schemaVersion !== 1 || !Array.isArray(job.tasks) || !Number.isInteger(job.retentionDays) || job.retentionDays < 30 || job.retentionDays > 3650 || Date.parse(job.expiresAt) - Date.parse(job.createdAt) < job.retentionDays * 86_400_000 || typeof job.accountId !== 'string' || !job.accountId.trim() || typeof job.projectId !== 'string' || !job.projectId.trim() || typeof job.cancelled !== 'boolean' || !Number.isSafeInteger(job.chargedCharacters) || job.chargedCharacters < 0 || !Number.isSafeInteger(job.chargedCostMicros) || job.chargedCostMicros < 0)
      throw new Error('AUDIO_JOB_STORE_INVALID: Invalid job identity or retention')
    validateVoiceGenerationBudget(job.budget)
    record(job.budget, ['maxCharacters', 'maxCost', 'allowUnknownCost', 'concurrency'])
    if (job.budget.maxCost !== undefined)
      cost(job.budget.maxCost)
    record(job.summary, ['lines', 'characters', 'cacheHits', 'newGenerations', 'estimatedCost'])
    if (['lines', 'characters', 'cacheHits', 'newGenerations'].some(key => !Number.isSafeInteger(job.summary[key as keyof typeof job.summary]) || Number(job.summary[key as keyof typeof job.summary]) < 0)
      || job.summary.lines !== job.tasks.length || job.summary.cacheHits + job.summary.newGenerations !== job.summary.lines || job.summary.estimatedCost === undefined) {
      throw new Error('AUDIO_JOB_STORE_INVALID: Invalid reviewed job summary')
    }
    if (job.summary.estimatedCost !== null)
      cost(job.summary.estimatedCost)
    const taskIds = new Set<string>()
    for (const task of job.tasks) {
      record(task, ['id', 'lineId', 'locale', 'speakerId', 'providerId', 'voiceId', 'model', 'voiceProfileRevision', 'inputFingerprint', 'idempotencyKey', 'characterCount', 'estimatedCost', 'status', 'attempts', 'takeId', 'assetId', 'errorCode'])
      assertAudioId(task.id, 'job')
      assertAudioId(task.lineId, 'line')
      if (taskIds.has(task.id) || ![task.speakerId, task.providerId, task.voiceId, task.model].every(identity) || normalizeAudioLocale(task.locale) !== task.locale || !/^[a-f0-9]{64}$/u.test(task.inputFingerprint) || !/^[a-f0-9]{64}$/u.test(task.idempotencyKey) || !/^[a-f0-9]{64}$/u.test(task.voiceProfileRevision) || !['queued', 'running', 'unknown', 'generated', 'committed', 'failed', 'cancelled', 'blocked'].includes(task.status) || !Number.isSafeInteger(task.characterCount) || task.characterCount < 1 || !Number.isSafeInteger(task.attempts) || task.attempts < 0 || task.estimatedCost === undefined)
        throw new Error('AUDIO_JOB_STORE_INVALID: Invalid task identity or state')
      taskIds.add(task.id)
      if (task.takeId)
        assertAudioId(task.takeId, 'take')
      if (task.assetId)
        assertAudioId(task.assetId, 'audio')
      if (task.status === 'committed' && (!task.takeId || !task.assetId))
        throw new Error('AUDIO_JOB_STORE_INVALID: Committed work requires a registered immutable take')
      if (task.estimatedCost !== null)
        cost(task.estimatedCost)
      if (task.errorCode && !/^[A-Z][A-Z0-9_]{0,79}$/u.test(task.errorCode))
        throw new Error('AUDIO_JOB_STORE_INVALID: Store only safe error codes, never provider logs')
    }
  }
  for (const [key, item] of Object.entries(state.idempotency)) {
    record(item, ['key', 'accountId', 'projectId', 'inputFingerprint', 'ownerJobId', 'ownerTaskId', 'dispatchId', 'status', 'createdAt', 'updatedAt', 'expiresAt', 'candidate', 'errorCode'])
    for (const timestamp of [item.createdAt, item.updatedAt, item.expiresAt])
      date(timestamp)
    assertAudioId(item.ownerJobId, 'job')
    assertAudioId(item.ownerTaskId, 'job')
    if (item.dispatchId)
      assertAudioId(item.dispatchId, 'job')
    if (key !== item.key || !/^[a-f0-9]{64}$/u.test(key) || !/^[a-f0-9]{64}$/u.test(item.inputFingerprint) || ![item.accountId, item.projectId].every(identity) || !['running', 'unknown', 'generated', 'committed', 'failed'].includes(item.status))
      throw new Error('AUDIO_JOB_STORE_INVALID: Invalid idempotency record')
    if (item.candidate) {
      record(item.candidate, ['id', 'path', 'sha256', 'bytes', 'mimeType', 'durationSeconds', 'sampleRate', 'provider', 'model', 'revision', 'providerVoiceId', 'voiceId', 'voiceVersion', 'alignment'])
      if (item.candidate.alignment) {
        const timing = parseVoiceAlignmentTiming(item.candidate.alignment)
        if (timing.audioSha256 !== item.candidate.sha256 || Math.abs(timing.durationSeconds - item.candidate.durationSeconds) > 0.001)
          throw new Error('AUDIO_JOB_STORE_INVALID: Alignment receipt does not match generated media')
      }
      safePath(item.candidate.path)
      if (!/^[a-f0-9]{64}$/u.test(item.candidate.sha256) || !Number.isSafeInteger(item.candidate.bytes) || item.candidate.bytes <= 0 || !Number.isFinite(item.candidate.durationSeconds) || item.candidate.durationSeconds <= 0 || !Number.isInteger(item.candidate.sampleRate) || item.candidate.sampleRate <= 0 || !/^audio\/[\w.+-]+$/u.test(item.candidate.mimeType))
        throw new Error('AUDIO_JOB_STORE_INVALID: Invalid generated media receipt')
    }
    if (item.errorCode && !/^[A-Z][A-Z0-9_]{0,79}$/u.test(item.errorCode))
      throw new Error('AUDIO_JOB_STORE_INVALID: Store only safe error codes')
  }
  return structuredClone(state)
}

/** Atomic test/reference store. Production hosts supply durable persistence. */
export function createMemoryVoiceGenerationStore(initial = emptyVoiceGenerationStore()): VoiceGenerationStore {
  let state = parseVoiceGenerationStore(initial)
  let pending = Promise.resolve()
  return {
    async read() { return structuredClone(state) },
    async mutate<T>(mutation: (document: VoiceGenerationStoreDocument) => T) {
      let result!: T
      const operation = pending.catch(() => {}).then(() => {
        const next = structuredClone(state)
        result = mutation(next)
        state = parseVoiceGenerationStore(next)
      })
      pending = operation
      await operation
      return structuredClone(result)
    },
  }
}

/** Unresolved requests outlive the retention cutoff until their outcome is known. */
export function pruneVoiceGenerationStore(state: VoiceGenerationStoreDocument, now: number) {
  const next = parseVoiceGenerationStore(state)
  for (const [id, job] of Object.entries(next.jobs)) {
    if (Date.parse(job.expiresAt) < now && job.tasks.every(task => ['committed', 'failed', 'cancelled'].includes(task.status)))
      delete next.jobs[id]
  }
  const referenced = new Set(Object.values(next.jobs).flatMap(job => job.tasks.map(task => task.idempotencyKey)))
  for (const [key, item] of Object.entries(next.idempotency)) {
    if (Date.parse(item.expiresAt) < now && !referenced.has(key) && ['committed', 'failed'].includes(item.status))
      delete next.idempotency[key]
  }
  return next
}
