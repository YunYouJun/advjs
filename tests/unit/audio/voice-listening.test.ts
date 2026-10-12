import type { VoiceListeningCandidate, VoiceListeningSession } from '../../../packages/audio/src/voice-listening'
import type { VoiceReviewRow } from '../../../packages/audio/src/voice-review'
import { webcrypto } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { attestVoiceListeningSession, compareVoiceListeningCandidates, createVoiceListeningSession, exportVoiceListeningSession, inspectVoiceListeningSession, recordVoiceListeningPlayback, restoreVoiceListeningSession, setVoiceListeningEnvironment, setVoiceListeningSampleReview, validateVoiceListeningSession, VOICE_LISTENING_DIMENSIONS, voiceListeningAdoptionEligibility, voiceListeningAnonymousSamples, voiceListeningCandidate, voiceListeningCoverage } from '../../../packages/audio/src/voice-listening'

beforeEach(() => vi.stubGlobal('crypto', webcrypto))
afterEach(() => vi.unstubAllGlobals())
const a: VoiceListeningCandidate = { lineId: 'line_a', locale: 'zh-CN', speakerId: 'hero', takeId: 'take_a', assetId: 'audio_a', sha256: 'a'.repeat(64), spokenText: '实际发音。', durationSeconds: 10, stale: false, unavailable: false }
const b: VoiceListeningCandidate = { ...a, takeId: 'take_b', assetId: 'audio_b', sha256: 'b'.repeat(64), stale: true }
const environment = { reviewerId: 'unit-fixture', device: 'simulated device', outputMode: 'simulated headphones', systemVolume: '30%', language: 'zh-CN', notes: 'Protocol unit fixture; no real auditory scores or artifact.' }
function session(candidates = [a, b]) {
  return createVoiceListeningSession({ projectId: 'project-a', candidates, id: 'unit-session', random: () => 0.5 })
}
function reviewed(current: VoiceListeningSession) {
  let next = setVoiceListeningEnvironment(current, environment)
  for (const sample of next.samples)
    next = setVoiceListeningSampleReview(next, sample.id, { scores: Object.fromEntries(VOICE_LISTENING_DIMENSIONS.map(key => [key, 'na'])) })
  return next
}

describe('shared author listening protocol (all observations below are unit simulations)', () => {
  it('compares actual historical spoken text, permitting stale but not unavailable audio', () => {
    const row = { lineId: a.lineId, locale: a.locale, speakerId: a.speakerId, spokenText: '当前词典改变了文本。', takes: [{ id: a.takeId, assetId: a.assetId, sha256: a.sha256, spokenText: a.spokenText, stale: true, unavailable: false }] } as VoiceReviewRow
    expect(voiceListeningCandidate(row, a.takeId, 10)).toEqual({ ...a, stale: true })
    expect(compareVoiceListeningCandidates([a, b]).eligible).toBe(true)
    const different = compareVoiceListeningCandidates([a, { ...b, spokenText: '另一段文本。' }])
    expect(different.groups).toHaveLength(2)
    expect(different.reasons).toContain('VOICE_LISTENING_DIFFERENT_LINE_LOCALE_SPEAKER_OR_TEXT')
    expect(compareVoiceListeningCandidates([a, { ...b, unavailable: true }]).reasons).toContain('VOICE_LISTENING_SOURCE_UNAVAILABLE')
  })

  it.each(['lineId', 'locale', 'speakerId'] as const)('does not pair different %s', (key) => {
    expect(compareVoiceListeningCandidates([a, { ...b, [key]: key === 'locale' ? 'en-US' : 'different' }]).eligible).toBe(false)
  })

  it('keeps comparison separate from explicit stale adoption and cannot override unavailability', () => {
    expect(voiceListeningAdoptionEligibility(b, { staleReviewed: false })).toEqual({ eligible: false, reasons: ['VOICE_LISTENING_STALE_REVIEW_REQUIRED'] })
    expect(voiceListeningAdoptionEligibility(b, { staleReviewed: true }).eligible).toBe(true)
    expect(voiceListeningAdoptionEligibility({ ...b, unavailable: true }, { staleReviewed: true }).eligible).toBe(false)
  })

  it('supports anonymous variable-size groups without exposing the private identity map', () => {
    const third = { ...a, takeId: 'take_c', assetId: 'audio_c', sha256: 'c'.repeat(64), spokenText: '另一组实际文本。' }
    const state = createVoiceListeningSession({ projectId: 'project-a', candidates: [a, b, third], random: () => 0, id: 'unit' })
    expect(state.samples.map(sample => sample.candidate.takeId)).toEqual(['take_b', 'take_c', 'take_a'])
    const anonymous = voiceListeningAnonymousSamples(state)
    expect(anonymous.map(sample => sample.groupId)).toEqual(['G01', 'G02', 'G01'])
    expect(JSON.stringify(anonymous)).not.toMatch(/take_a|audio_a|speakerId|sha256|provider/u)
    expect(() => session([a])).toThrow('VOICE_LISTENING_SESSION_INPUT_INVALID')
    expect(() => session(Array.from({ length: 33 }, (_, index) => ({ ...a, takeId: `take_${index}` })))).toThrow('VOICE_LISTENING_SESSION_INPUT_INVALID')
    expect(() => session([a, a])).toThrow('VOICE_LISTENING_DUPLICATE_CANDIDATE')
  })

  it('preserves four independent same-text groups in an eight-sample private session across hosts', () => {
    const candidates = Array.from({ length: 8 }, (_, index) => ({ ...a, lineId: `line_${Math.floor(index / 2)}`, takeId: `take_${index}`, assetId: `audio_${index}`, sha256: index.toString(16).repeat(64), spokenText: `Group ${Math.floor(index / 2)}` }))
    const original = session(candidates)
    const restored = restoreVoiceListeningSession(exportVoiceListeningSession(original), { projectId: 'project-a', candidates })
    expect(restored.samples).toHaveLength(8)
    expect(compareVoiceListeningCandidates(candidates).groups.map(group => group.candidates.length)).toEqual([2, 2, 2, 2])
    const groups = Object.groupBy(voiceListeningAnonymousSamples(restored), sample => sample.groupId)
    expect(Object.values(groups).map(group => group!.length)).toEqual([2, 2, 2, 2])
  })

  it('uses a union of only 1x ranges; overlap and bookend seeking are not full coverage', () => {
    expect(voiceListeningCoverage([{ fromSeconds: 0, toSeconds: 6, rate: 1 }, { fromSeconds: 4, toSeconds: 9.5, rate: 1 }], 10)).toBe(0.95)
    expect(voiceListeningCoverage([{ fromSeconds: 0, toSeconds: 1, rate: 1 }, { fromSeconds: 9, toSeconds: 10, rate: 1 }, { fromSeconds: 0, toSeconds: 10, rate: 2 }], 10)).toBe(0.2)
    expect(voiceListeningCoverage([], Number.NaN)).toBe(0)
  })

  it('requires actual media duration and ended, independently of catalogue duration and human confirmation', () => {
    let state = reviewed(session())
    for (const sample of state.samples)
      state = recordVoiceListeningPlayback(state, sample.id, { fromSeconds: 0, toSeconds: 10, rate: 1, provenance: 'browser-observed' })
    expect(inspectVoiceListeningSession(state).canAttest).toBe(false)
    expect(inspectVoiceListeningSession(state).samples[0]!.pendingReasons).toContain('VOICE_LISTENING_DURATION_REQUIRED')
    for (const sample of state.samples)
      state = recordVoiceListeningPlayback(state, sample.id, { fromSeconds: 10, toSeconds: 10, rate: 1, durationSeconds: 10, ended: true, provenance: 'browser-observed' })
    expect(inspectVoiceListeningSession(state)).toMatchObject({ canAttest: true, eligibleHumanReview: false, standardMOS: null })
    // A unit/automation run explicitly declares simulation, never a human result.
    state = attestVoiceListeningSession(state, true, 'simulation')
    expect(inspectVoiceListeningSession(state)).toMatchObject({ canAttest: false, eligibleHumanReview: false, standardMOS: null })
  })

  it('uses actual duration rather than a false short catalogue hint and reports mismatch', () => {
    let state = reviewed(session([{ ...a, durationSeconds: 1 }, { ...b, durationSeconds: 1 }]))
    for (const sample of state.samples) {
      state = recordVoiceListeningPlayback(state, sample.id, { fromSeconds: 0, toSeconds: 1, durationSeconds: 10, rate: 1, provenance: 'browser-observed' })
      state = recordVoiceListeningPlayback(state, sample.id, { fromSeconds: 10, toSeconds: 10, durationSeconds: 10, rate: 1, ended: true, provenance: 'browser-observed' })
    }
    const result = inspectVoiceListeningSession(state)
    expect(result.samples[0]!.coverage).toBe(0.1)
    expect(result.samples[0]!.pendingReasons).toContain('VOICE_LISTENING_DURATION_MISMATCH')
    expect(result.canAttest).toBe(false)
    expect(() => recordVoiceListeningPlayback(state, 'S01', { fromSeconds: 0, toSeconds: 1, durationSeconds: 1, rate: 1 })).toThrow('VOICE_LISTENING_MEDIA_REPLACED')
  })

  it('keeps simulation sticky across edits and prevents fake ended-only events from becoming human proof', () => {
    let state = reviewed(session())
    state = attestVoiceListeningSession(state, true, 'simulation')
    state = setVoiceListeningSampleReview(state, 'S01', { notes: 'edited draft' })
    state = setVoiceListeningEnvironment(state, environment)
    expect(attestVoiceListeningSession(state, true).provenance).toBe('simulation')
    const observed = recordVoiceListeningPlayback(reviewed(session()), 'S01', { fromSeconds: 0, toSeconds: 10, rate: 1, durationSeconds: 10, provenance: 'browser-observed' })
    const fakeEnd = recordVoiceListeningPlayback(observed, 'S01', { fromSeconds: 10, toSeconds: 10, rate: 1, ended: true })
    expect(attestVoiceListeningSession(setVoiceListeningSampleReview(fakeEnd, 'S01', { notes: 'edited' }), true).provenance).toBe('simulation')
  })

  it('restores only grades/notes against current project authority, resetting playback and attestation', () => {
    let state = reviewed(session())
    state = recordVoiceListeningPlayback(state, 'S01', { fromSeconds: 0, toSeconds: 10, rate: 1, durationSeconds: 10, ended: true })
    state = attestVoiceListeningSession(state, true, 'simulation')
    const current = [{ ...a, stale: true }, b]
    const restored = restoreVoiceListeningSession(exportVoiceListeningSession(state), { projectId: 'project-a', candidates: current })
    expect(restored).toMatchObject({ humanConfirmed: false, provenance: 'pending', standardMOS: null })
    expect(restored.samples.every(sample => !sample.plays.length && !sample.endedCount && !sample.simulatedPlayback && sample.observedDurationSeconds === undefined)).toBe(true)
    expect(restored.samples.find(sample => sample.candidate.takeId === a.takeId)!.candidate.stale).toBe(true)
    expect(restored.samples[0]!.scores.naturalness).toBe('na')
    expect(() => restoreVoiceListeningSession(state, { projectId: 'other-project', candidates: current })).toThrow('VOICE_LISTENING_PROJECT_MISMATCH')
    expect(() => restoreVoiceListeningSession(state, { projectId: 'project-a', candidates: [{ ...a, sha256: 'c'.repeat(64) }, b] })).toThrow('VOICE_LISTENING_SOURCE_CHANGED')
    expect(() => restoreVoiceListeningSession(state, { projectId: 'project-a', candidates: [{ ...a, unavailable: true }, b] })).toThrow('VOICE_LISTENING_SOURCE_UNAVAILABLE')
  })

  it('rejects fabricated import fields, future dates, scores and invalid playback', () => {
    const state = session()
    expect(() => validateVoiceListeningSession({ ...state, createdAt: new Date(Date.now() + 60_000).toISOString() })).toThrow('VOICE_LISTENING_SESSION_INVALID')
    expect(() => validateVoiceListeningSession({ ...state, selectedTake: a.takeId })).toThrow('VOICE_LISTENING_SESSION_INVALID')
    expect(() => createVoiceListeningSession({ projectId: 'p', candidates: [{ ...a, apiKey: 'no secret fields' } as VoiceListeningCandidate, b] })).toThrow('VOICE_LISTENING_CANDIDATE_INVALID')
    expect(() => setVoiceListeningSampleReview(state, 'S01', { scores: { naturalness: 6 as 5 } })).toThrow('VOICE_LISTENING_SCORE_INVALID')
    expect(() => recordVoiceListeningPlayback(state, 'S01', { fromSeconds: 0, toSeconds: 10, rate: 2 as 1 })).toThrow('VOICE_LISTENING_PLAYBACK_INVALID')
    expect(() => recordVoiceListeningPlayback(state, 'S01', { fromSeconds: 0, toSeconds: 1, rate: 1, ended: true })).toThrow('VOICE_LISTENING_ENDED_INVALID')
    expect(() => validateVoiceListeningSession({ ...state, kind: 'advjs-human-listening-review' })).toThrow('VOICE_LISTENING_SESSION_INVALID')
  })
})
