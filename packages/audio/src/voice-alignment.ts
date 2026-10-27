import type { VoiceAlignment, VoiceAlignmentUnit } from '@advjs/types'

/** A durable task may keep timing evidence, but never the dialogue prose. */
export function parseVoiceAlignmentTiming(value: unknown): Omit<VoiceAlignment, 'text'> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !['schemaVersion', 'audioSha256', 'durationSeconds', 'engine', 'model', 'revision', 'units'].includes(key)))
    throw new Error('VOICE_ALIGNMENT_INVALID')
  const data = value as Omit<VoiceAlignment, 'text'>
  if (data.schemaVersion !== 1 || !/^[a-f0-9]{64}$/u.test(data.audioSha256) || !Number.isFinite(data.durationSeconds) || data.durationSeconds <= 0 || typeof data.engine !== 'string' || !data.engine || typeof data.model !== 'string' || !data.model || (data.revision !== undefined && (typeof data.revision !== 'string' || !data.revision)) || !Array.isArray(data.units) || !data.units.length || data.units.length > 4096)
    throw new Error('VOICE_ALIGNMENT_INVALID')
  let end = 0
  let time = 0
  for (const unit of data.units) {
    if (!unit || Object.keys(unit).some(key => !['start', 'end', 'startTime', 'endTime'].includes(key)) || !Number.isInteger(unit.start) || !Number.isInteger(unit.end) || unit.start < end || unit.end <= unit.start || unit.end > 1_000_000 || !Number.isFinite(unit.startTime) || !Number.isFinite(unit.endTime) || unit.startTime < time || unit.endTime <= unit.startTime || unit.endTime > data.durationSeconds + 0.001)
      throw new Error('VOICE_ALIGNMENT_INVALID')
    end = unit.end
    time = unit.endTime
  }
  return data
}

/** Reject stale or malformed evidence, without inventing or stretching timings. */
export function parseVoiceAlignment(value: unknown, expected?: { text: string, sha256: string, durationSeconds?: number }): VoiceAlignment {
  const fail = (): never => {
    throw new Error('VOICE_ALIGNMENT_INVALID: Timings must match exact text, audio and duration')
  }
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return fail()
  const alignment = value as VoiceAlignment
  if (Object.keys(alignment).some(key => !['schemaVersion', 'text', 'audioSha256', 'durationSeconds', 'engine', 'model', 'revision', 'units'].includes(key))
    || alignment.schemaVersion !== 1 || typeof alignment.text !== 'string' || !alignment.text.trim()
    || !/^[a-f0-9]{64}$/u.test(alignment.audioSha256)
    || !Number.isFinite(alignment.durationSeconds) || alignment.durationSeconds <= 0
    || typeof alignment.engine !== 'string' || !alignment.engine || typeof alignment.model !== 'string' || !alignment.model
    || (alignment.revision !== undefined && (typeof alignment.revision !== 'string' || !alignment.revision))
    || !Array.isArray(alignment.units) || !alignment.units.length || alignment.units.length > 4096) {
    return fail()
  }
  if (expected && (alignment.text !== expected.text || alignment.audioSha256 !== expected.sha256 || (expected.durationSeconds !== undefined && Math.abs(expected.durationSeconds - alignment.durationSeconds) > 0.001)))
    return fail()
  let previousEnd = 0
  let previousTime = 0
  for (const unit of alignment.units) {
    if (!unit || Object.keys(unit).some(key => !['start', 'end', 'startTime', 'endTime'].includes(key))
      || !Number.isInteger(unit.start) || !Number.isInteger(unit.end) || unit.start < previousEnd || unit.end <= unit.start || unit.end > alignment.text.length
      || !Number.isFinite(unit.startTime) || !Number.isFinite(unit.endTime) || unit.startTime < previousTime || unit.endTime <= unit.startTime || unit.endTime > alignment.durationSeconds + 0.001) {
      return fail()
    }
    if (/^[\uDC00-\uDFFF]/u.test(alignment.text.slice(unit.start)) || /[\uD800-\uDBFF]$/u.test(alignment.text.slice(0, unit.end)))
      return fail()
    previousEnd = unit.end
    previousTime = unit.endTime
  }
  return alignment
}

/** Shared lookup for both the player and authoring views' real audio clocks. */
export function voiceAlignmentUnitAt(alignment: VoiceAlignment | undefined, seconds: number): VoiceAlignmentUnit | undefined {
  if (!alignment || !Number.isFinite(seconds) || seconds < 0)
    return undefined
  let low = 0
  let high = alignment.units.length - 1
  while (low <= high) {
    const middle = (low + high) >>> 1
    const unit = alignment.units[middle]!
    if (seconds < unit.startTime)
      high = middle - 1
    else if (seconds >= unit.endTime)
      low = middle + 1
    else
      return unit
  }
  return undefined
}

/** Punctuation and whitespace need no spoken cue; missing letters do. */
export function voiceAlignmentUnresolvedCharacters(alignment: VoiceAlignment): number {
  let offset = 0
  let index = 0
  let count = 0
  for (const character of alignment.text) {
    while (alignment.units[index] && alignment.units[index]!.end <= offset)
      index++
    const unit = alignment.units[index]
    if (/[\p{L}\p{N}]/u.test(character) && (!unit || unit.start > offset || unit.end < offset + character.length))
      count++
    offset += character.length
  }
  return count
}
