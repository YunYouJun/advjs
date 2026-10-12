import type { VoiceReviewRow } from './voice-review'
import { normalizeAudioLocale } from './locale'

export const VOICE_LISTENING_DIMENSIONS = ['naturalness', 'clarity', 'textAccuracy', 'styleFit', 'edges', 'referenceConsistency'] as const
export type VoiceListeningDimension = typeof VOICE_LISTENING_DIMENSIONS[number]
export type VoiceListeningScore = 1 | 2 | 3 | 4 | 5 | 'na' | null
export type VoiceListeningScores = Record<VoiceListeningDimension, VoiceListeningScore>
export type VoiceListeningPlaybackProvenance = 'browser-observed' | 'simulation'

/** Private author identity; never expose this mapping in an anonymous sample card. */
export interface VoiceListeningCandidate {
  lineId: string
  locale: string
  speakerId: string
  takeId: string
  assetId: string
  sha256: string
  /** The take's actual synthesis text, including historical pronunciation. */
  spokenText: string
  durationSeconds?: number
  stale: boolean
  unavailable: boolean
}

export interface VoiceListeningPlay {
  fromSeconds: number
  toSeconds: number
  rate: 1
  provenance: VoiceListeningPlaybackProvenance
}

export interface VoiceListeningPlaybackEvent {
  fromSeconds: number
  toSeconds: number
  rate: 1
  ended?: boolean
  durationSeconds?: number
  /** Omitted events are simulation; hosts must use actual trusted media events. */
  provenance?: VoiceListeningPlaybackProvenance
}

export interface VoiceListeningEnvironment {
  reviewerId: string
  device: string
  outputMode: string
  systemVolume: string
  language: string
  notes: string
}

export interface VoiceListeningSample {
  id: string
  candidate: VoiceListeningCandidate
  scores: VoiceListeningScores
  notes: string
  plays: VoiceListeningPlay[]
  endedCount: number
  simulatedPlayback: boolean
  observedDurationSeconds?: number
}

/** Project-private draft/export, distinct from the historical CLI eight-pack. */
export interface VoiceListeningSession {
  schemaVersion: 1
  kind: 'advjs-private-voice-listening-session'
  id: string
  projectId: string
  createdAt: string
  samples: VoiceListeningSample[]
  environment: VoiceListeningEnvironment
  humanConfirmed: boolean
  provenance: 'pending' | 'human-attested' | 'simulation'
  standardMOS: null
}

const SHA = /^[a-f0-9]{64}$/u
const candidateKeys = ['lineId', 'locale', 'speakerId', 'takeId', 'assetId', 'sha256', 'spokenText', 'durationSeconds', 'stale', 'unavailable']
const environmentLimits = { reviewerId: 80, device: 160, outputMode: 160, systemVolume: 160, language: 80, notes: 160 }
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))
const object = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))
const text = (value: unknown, limit: number, nonempty = false): value is string => typeof value === 'string' && value.length <= limit && !Array.from(value).some(character => character.charCodeAt(0) < 32 && ![9, 10, 13].includes(character.charCodeAt(0))) && (!nonempty || Boolean(value.trim()))
const duration = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 3600
const score = (value: unknown): value is VoiceListeningScore => value === null || value === 'na' || (typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5)
function assert(ok: unknown, code: string): asserts ok {
  if (!ok)
    throw new Error(code)
}
function fields(value: Record<string, unknown>, allowed: readonly string[]) {
  return Object.keys(value).every(key => allowed.includes(key))
}

export function validateVoiceListeningCandidate(value: unknown): VoiceListeningCandidate {
  assert(object(value) && fields(value, candidateKeys), 'VOICE_LISTENING_CANDIDATE_INVALID')
  for (const key of ['lineId', 'speakerId', 'takeId', 'assetId'])
    assert(text(value[key], 200, true), 'VOICE_LISTENING_CANDIDATE_INVALID')
  assert(text(value.locale, 80, true) && normalizeAudioLocale(value.locale) === value.locale && typeof value.sha256 === 'string' && SHA.test(value.sha256) && text(value.spokenText, 4000, true) && typeof value.stale === 'boolean' && typeof value.unavailable === 'boolean' && (value.durationSeconds === undefined || duration(value.durationSeconds)), 'VOICE_LISTENING_CANDIDATE_INVALID')
  return clone(value) as unknown as VoiceListeningCandidate
}

export function voiceListeningCandidate(row: VoiceReviewRow, takeId: string, durationSeconds?: number): VoiceListeningCandidate {
  const take = row.takes.find(take => take.id === takeId)
  assert(take, 'VOICE_LISTENING_TAKE_REQUIRED')
  return validateVoiceListeningCandidate({ lineId: row.lineId, locale: normalizeAudioLocale(row.locale), speakerId: row.speakerId, takeId: take.id, assetId: take.assetId, sha256: take.sha256, spokenText: take.spokenText, ...(durationSeconds === undefined ? {} : { durationSeconds }), stale: take.stale, unavailable: take.unavailable })
}

export function voiceListeningCandidateKey(candidate: VoiceListeningCandidate): string {
  return JSON.stringify([candidate.lineId, candidate.locale, candidate.speakerId, candidate.takeId, candidate.assetId, candidate.sha256])
}

export function compareVoiceListeningCandidates(candidates: readonly VoiceListeningCandidate[]) {
  const groups = new Map<string, VoiceListeningCandidate[]>()
  const reasons: string[] = []
  if (candidates.length < 2)
    reasons.push('VOICE_LISTENING_NEEDS_TWO_CANDIDATES')
  if (candidates.length > 32)
    reasons.push('VOICE_LISTENING_TOO_MANY_CANDIDATES')
  const seen = new Set<string>()
  for (const value of candidates) {
    const candidate = validateVoiceListeningCandidate(value)
    const identity = voiceListeningCandidateKey(candidate)
    if (seen.has(identity))
      reasons.push('VOICE_LISTENING_DUPLICATE_CANDIDATE')
    seen.add(identity)
    if (candidate.unavailable) {
      reasons.push('VOICE_LISTENING_SOURCE_UNAVAILABLE')
      continue
    }
    const key = JSON.stringify([candidate.lineId, candidate.locale, candidate.speakerId, candidate.spokenText])
    groups.set(key, [...(groups.get(key) ?? []), candidate])
  }
  if (groups.size > 1)
    reasons.push('VOICE_LISTENING_DIFFERENT_LINE_LOCALE_SPEAKER_OR_TEXT')
  return { eligible: reasons.length === 0 && groups.size === 1, groups: [...groups].map(([key, candidates]) => ({ key, candidates })), reasons: [...new Set(reasons)] }
}

/** A UI guard only. Actual adoption still uses the existing authoring select/CAS. */
export function voiceListeningAdoptionEligibility(value: VoiceListeningCandidate, options: { staleReviewed: boolean }) {
  const candidate = validateVoiceListeningCandidate(value)
  const reasons: string[] = []
  if (candidate.unavailable)
    reasons.push('VOICE_LISTENING_SOURCE_UNAVAILABLE')
  if (candidate.stale && options.staleReviewed !== true)
    reasons.push('VOICE_LISTENING_STALE_REVIEW_REQUIRED')
  return { eligible: reasons.length === 0, reasons }
}

/** Union of continuous 1x intervals. Seeks/overlaps cannot increase coverage. */
export function voiceListeningCoverage(plays: readonly { fromSeconds: number, toSeconds: number, rate: number }[], durationSeconds: number): number {
  if (!duration(durationSeconds))
    return 0
  const ranges = plays.filter(play => play.rate === 1 && Number.isFinite(play.fromSeconds) && Number.isFinite(play.toSeconds) && play.fromSeconds >= 0 && play.toSeconds >= play.fromSeconds && play.toSeconds <= durationSeconds + 0.15).map(play => [Math.min(play.fromSeconds, durationSeconds), Math.min(play.toSeconds, durationSeconds)] as const).sort((a, b) => a[0] - b[0])
  let covered = 0
  let from = 0
  let to = 0
  for (const range of ranges) {
    if (range[0] > to) {
      covered += to - from
      from = range[0]
      to = range[1]
    }
    else {
      to = Math.max(to, range[1])
    }
  }
  return Math.min(1, (covered + to - from) / durationSeconds)
}

function randomUnit() {
  const values = new Uint32Array(1)
  globalThis.crypto.getRandomValues(values)
  return values[0]! / 0x100000000
}

export function createVoiceListeningSession(options: { projectId: string, candidates: readonly VoiceListeningCandidate[], id?: string, random?: () => number }): VoiceListeningSession {
  assert(text(options.projectId, 200, true) && options.candidates.length >= 2 && options.candidates.length <= 32, 'VOICE_LISTENING_SESSION_INPUT_INVALID')
  const candidates = options.candidates.map(validateVoiceListeningCandidate)
  assert(!candidates.some(candidate => candidate.unavailable), 'VOICE_LISTENING_SOURCE_UNAVAILABLE')
  assert(new Set(candidates.map(voiceListeningCandidateKey)).size === candidates.length, 'VOICE_LISTENING_DUPLICATE_CANDIDATE')
  for (let index = candidates.length - 1; index > 0; index--) {
    const random = (options.random ?? randomUnit)()
    assert(Number.isFinite(random) && random >= 0 && random < 1, 'VOICE_LISTENING_RANDOM_INVALID')
    const other = Math.floor(random * (index + 1))
    ;[candidates[index], candidates[other]] = [candidates[other]!, candidates[index]!]
  }
  const id = options.id ?? `listening_${globalThis.crypto.randomUUID()}`
  assert(text(id, 200, true), 'VOICE_LISTENING_SESSION_INPUT_INVALID')
  return {
    schemaVersion: 1,
    kind: 'advjs-private-voice-listening-session',
    id,
    projectId: options.projectId,
    createdAt: new Date().toISOString(),
    samples: candidates.map((candidate, index) => ({ id: `S${String(index + 1).padStart(2, '0')}`, candidate, scores: Object.fromEntries(VOICE_LISTENING_DIMENSIONS.map(key => [key, null])) as VoiceListeningScores, notes: '', plays: [], endedCount: 0, simulatedPlayback: false })),
    environment: { reviewerId: '', device: '', outputMode: '', systemVolume: '', language: '', notes: '' },
    humanConfirmed: false,
    provenance: 'pending',
    standardMOS: null,
  }
}

export function validateVoiceListeningSession(value: unknown): VoiceListeningSession {
  assert(object(value) && fields(value, ['schemaVersion', 'kind', 'id', 'projectId', 'createdAt', 'samples', 'environment', 'humanConfirmed', 'provenance', 'standardMOS']) && value.schemaVersion === 1 && value.kind === 'advjs-private-voice-listening-session' && text(value.id, 200, true) && text(value.projectId, 200, true) && text(value.createdAt, 80, true) && Number.isFinite(Date.parse(value.createdAt)) && Date.parse(value.createdAt) <= Date.now() && value.standardMOS === null && typeof value.humanConfirmed === 'boolean' && ['pending', 'human-attested', 'simulation'].includes(String(value.provenance)) && Array.isArray(value.samples) && value.samples.length >= 2 && value.samples.length <= 32, 'VOICE_LISTENING_SESSION_INVALID')
  assert(object(value.environment) && fields(value.environment, Object.keys(environmentLimits)) && Object.entries(environmentLimits).every(([key, limit]) => text((value.environment as Record<string, unknown>)[key], limit)), 'VOICE_LISTENING_ENVIRONMENT_INVALID')
  const ids = new Set<string>()
  const identities = new Set<string>()
  for (const raw of value.samples) {
    assert(object(raw) && fields(raw, ['id', 'candidate', 'scores', 'notes', 'plays', 'endedCount', 'simulatedPlayback', 'observedDurationSeconds']) && typeof raw.id === 'string' && /^S(?:0[1-9]|[12]\d|3[0-2])$/u.test(raw.id) && !ids.has(raw.id) && text(raw.notes, 4000) && Number.isSafeInteger(raw.endedCount) && Number(raw.endedCount) >= 0 && Number(raw.endedCount) <= 1000 && typeof raw.simulatedPlayback === 'boolean' && Array.isArray(raw.plays) && raw.plays.length <= 1000 && (raw.observedDurationSeconds === undefined || duration(raw.observedDurationSeconds)), 'VOICE_LISTENING_SAMPLE_INVALID')
    ids.add(raw.id)
    const candidate = validateVoiceListeningCandidate(raw.candidate)
    const key = voiceListeningCandidateKey(candidate)
    assert(!identities.has(key), 'VOICE_LISTENING_DUPLICATE_CANDIDATE')
    identities.add(key)
    assert(object(raw.scores) && fields(raw.scores, VOICE_LISTENING_DIMENSIONS) && VOICE_LISTENING_DIMENSIONS.every(key => score((raw.scores as Record<string, unknown>)[key])), 'VOICE_LISTENING_SCORE_INVALID')
    const expectedDuration = raw.observedDurationSeconds ?? candidate.durationSeconds
    for (const play of raw.plays) {
      assert(object(play) && fields(play, ['fromSeconds', 'toSeconds', 'rate', 'provenance']) && play.rate === 1 && ['browser-observed', 'simulation'].includes(String(play.provenance)) && typeof play.fromSeconds === 'number' && Number.isFinite(play.fromSeconds) && typeof play.toSeconds === 'number' && Number.isFinite(play.toSeconds) && play.fromSeconds >= 0 && play.toSeconds >= play.fromSeconds && duration(expectedDuration) && play.toSeconds <= expectedDuration + 0.15, 'VOICE_LISTENING_PLAYBACK_INVALID')
    }
  }
  return clone(value) as unknown as VoiceListeningSession
}

function changed(session: VoiceListeningSession) {
  const next = validateVoiceListeningSession(session)
  next.humanConfirmed = false
  next.provenance = next.provenance === 'simulation' || next.samples.some(sample => sample.simulatedPlayback || sample.plays.some(play => play.provenance === 'simulation')) ? 'simulation' : 'pending'
  return next
}

function sampleById(session: VoiceListeningSession, id: string) {
  const sample = session.samples.find(sample => sample.id === id)
  assert(sample, 'VOICE_LISTENING_SAMPLE_REQUIRED')
  return sample
}

export function setVoiceListeningSampleReview(session: VoiceListeningSession, id: string, patch: { scores?: Partial<VoiceListeningScores>, notes?: string }): VoiceListeningSession {
  assert(object(patch) && fields(patch, ['scores', 'notes']), 'VOICE_LISTENING_SCORE_INVALID')
  const next = changed(session)
  const sample = sampleById(next, id)
  if (patch.scores !== undefined) {
    assert(object(patch.scores) && fields(patch.scores, VOICE_LISTENING_DIMENSIONS) && Object.values(patch.scores).every(score), 'VOICE_LISTENING_SCORE_INVALID')
    sample.scores = { ...sample.scores, ...patch.scores }
  }
  if (patch.notes !== undefined) {
    assert(text(patch.notes, 4000), 'VOICE_LISTENING_SAMPLE_INVALID')
    sample.notes = patch.notes
  }
  return next
}

export function setVoiceListeningEnvironment(session: VoiceListeningSession, environment: VoiceListeningEnvironment): VoiceListeningSession {
  const next = changed(session)
  next.environment = clone(environment)
  return validateVoiceListeningSession(next)
}

export function recordVoiceListeningPlayback(session: VoiceListeningSession, id: string, event: VoiceListeningPlaybackEvent): VoiceListeningSession {
  assert(object(event) && fields(event, ['fromSeconds', 'toSeconds', 'rate', 'ended', 'durationSeconds', 'provenance']) && (event.ended === undefined || typeof event.ended === 'boolean') && (event.durationSeconds === undefined || duration(event.durationSeconds)), 'VOICE_LISTENING_PLAYBACK_INVALID')
  const next = changed(session)
  const sample = sampleById(next, id)
  assert(!sample.candidate.unavailable, 'VOICE_LISTENING_SOURCE_UNAVAILABLE')
  if (event.durationSeconds !== undefined) {
    assert(sample.observedDurationSeconds === undefined || Math.abs(sample.observedDurationSeconds - event.durationSeconds) <= 0.15, 'VOICE_LISTENING_MEDIA_REPLACED')
    sample.observedDurationSeconds = event.durationSeconds
  }
  const durationSeconds = sample.observedDurationSeconds ?? sample.candidate.durationSeconds
  const provenance = event.provenance ?? 'simulation'
  const play: VoiceListeningPlay = { fromSeconds: event.fromSeconds, toSeconds: event.toSeconds, rate: event.rate, provenance }
  assert(event.rate === 1 && ['browser-observed', 'simulation'].includes(provenance) && duration(durationSeconds) && Number.isFinite(event.fromSeconds) && Number.isFinite(event.toSeconds) && event.fromSeconds >= 0 && event.toSeconds >= event.fromSeconds && event.toSeconds <= durationSeconds + 0.15, 'VOICE_LISTENING_PLAYBACK_INVALID')
  if (play.toSeconds > play.fromSeconds) {
    const prior = sample.plays.at(-1)
    if (prior && prior.rate === play.rate && prior.provenance === provenance && Math.abs(prior.toSeconds - play.fromSeconds) < 0.000001)
      prior.toSeconds = play.toSeconds
    else
      sample.plays.push(play)
  }
  if (event.ended) {
    assert(event.toSeconds >= durationSeconds - 0.15, 'VOICE_LISTENING_ENDED_INVALID')
    sample.endedCount++
  }
  if (provenance === 'simulation') {
    sample.simulatedPlayback = true
    next.provenance = 'simulation'
  }
  return validateVoiceListeningSession(next)
}

export function attestVoiceListeningSession(session: VoiceListeningSession, human: boolean, provenance: 'human-attested' | 'simulation' = 'human-attested'): VoiceListeningSession {
  assert(typeof human === 'boolean' && ['human-attested', 'simulation'].includes(provenance), 'VOICE_LISTENING_ATTESTATION_INVALID')
  const next = validateVoiceListeningSession(session)
  next.humanConfirmed = human
  next.provenance = next.provenance === 'simulation' || provenance === 'simulation' || next.samples.some(sample => sample.simulatedPlayback || sample.plays.some(play => play.provenance === 'simulation')) ? 'simulation' : human ? 'human-attested' : 'pending'
  return next
}

export function inspectVoiceListeningSession(session: VoiceListeningSession) {
  const current = validateVoiceListeningSession(session)
  const pendingReasons: string[] = []
  const environmentComplete = ['reviewerId', 'device', 'outputMode', 'systemVolume', 'language'].every(key => current.environment[key as keyof VoiceListeningEnvironment].trim())
  if (!environmentComplete)
    pendingReasons.push('VOICE_LISTENING_ENVIRONMENT_REQUIRED')
  if (!current.humanConfirmed || current.provenance !== 'human-attested')
    pendingReasons.push('VOICE_LISTENING_HUMAN_ATTESTATION_REQUIRED')
  const samples = current.samples.map((sample) => {
    const durationSeconds = sample.observedDurationSeconds ?? sample.candidate.durationSeconds
    const coverage = durationSeconds ? voiceListeningCoverage(sample.plays, durationSeconds) : 0
    const reasons: string[] = []
    if (sample.candidate.unavailable)
      reasons.push('VOICE_LISTENING_SOURCE_UNAVAILABLE')
    if (!sample.observedDurationSeconds)
      reasons.push('VOICE_LISTENING_DURATION_REQUIRED')
    if (sample.observedDurationSeconds && sample.candidate.durationSeconds && Math.abs(sample.observedDurationSeconds - sample.candidate.durationSeconds) > Math.max(0.15, sample.observedDurationSeconds * 0.01))
      reasons.push('VOICE_LISTENING_DURATION_MISMATCH')
    if (coverage < 0.95 || !sample.endedCount)
      reasons.push('VOICE_LISTENING_COMPLETE_PLAYBACK_REQUIRED')
    if (sample.simulatedPlayback || sample.plays.some(play => play.provenance !== 'browser-observed'))
      reasons.push('VOICE_LISTENING_SIMULATED_PLAYBACK')
    if (VOICE_LISTENING_DIMENSIONS.some(key => sample.scores[key] === null))
      reasons.push('VOICE_LISTENING_SCORES_REQUIRED')
    return { id: sample.id, coverage, endedCount: sample.endedCount, pendingReasons: reasons, stale: sample.candidate.stale }
  })
  const canAttest = environmentComplete && current.provenance !== 'simulation' && samples.every(sample => sample.pendingReasons.length === 0)
  const eligibleHumanReview = pendingReasons.length === 0 && canAttest
  return { status: eligibleHumanReview ? 'complete' as const : 'pending' as const, canAttest, eligibleHumanReview, standardMOS: null, pendingReasons, samples, comparison: compareVoiceListeningCandidates(current.samples.map(sample => sample.candidate)) }
}

/** Omits author IDs, source/provider metadata and the private unblinding mapping. */
export function voiceListeningAnonymousSamples(session: VoiceListeningSession) {
  const current = validateVoiceListeningSession(session)
  const groups = new Map<string, string>()
  return current.samples.map((sample) => {
    const key = JSON.stringify([sample.candidate.lineId, sample.candidate.locale, sample.candidate.speakerId, sample.candidate.spokenText])
    if (!groups.has(key))
      groups.set(key, `G${String(groups.size + 1).padStart(2, '0')}`)
    return { id: sample.id, groupId: groups.get(key)!, spokenText: sample.candidate.spokenText, durationSeconds: sample.observedDurationSeconds ?? sample.candidate.durationSeconds, scores: clone(sample.scores), notes: sample.notes }
  })
}

export function exportVoiceListeningSession(session: VoiceListeningSession): string {
  return `${JSON.stringify(validateVoiceListeningSession(session), null, 2)}\n`
}

/** Incoming grades are only a draft. Current project/native identities are authority. */
export function restoreVoiceListeningSession(value: unknown, options: { projectId: string, candidates: readonly VoiceListeningCandidate[] }): VoiceListeningSession {
  if (typeof value === 'string') {
    assert(value.length <= 512 * 1024, 'VOICE_LISTENING_IMPORT_TOO_LARGE')
    value = JSON.parse(value)
  }
  const incoming = validateVoiceListeningSession(value)
  assert(incoming.projectId === options.projectId, 'VOICE_LISTENING_PROJECT_MISMATCH')
  const authority = new Map(options.candidates.map(validateVoiceListeningCandidate).map(candidate => [voiceListeningCandidateKey(candidate), candidate]))
  for (const sample of incoming.samples) {
    const candidate = authority.get(voiceListeningCandidateKey(sample.candidate))
    assert(candidate && candidate.spokenText === sample.candidate.spokenText, 'VOICE_LISTENING_SOURCE_CHANGED')
    assert(!candidate.unavailable, 'VOICE_LISTENING_SOURCE_UNAVAILABLE')
    sample.candidate = candidate
    sample.plays = []
    sample.endedCount = 0
    sample.simulatedPlayback = false
    delete sample.observedDurationSeconds
  }
  incoming.humanConfirmed = false
  incoming.provenance = 'pending'
  return incoming
}
