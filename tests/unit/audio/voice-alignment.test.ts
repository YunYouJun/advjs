import type { VoiceAlignment } from '@advjs/types'
import { describe, expect, it } from 'vitest'
import { parseVoiceAlignment, voiceAlignmentUnitAt, voiceAlignmentUnresolvedCharacters } from '../../../packages/audio/src/voice-alignment'

const alignment: VoiceAlignment = { schemaVersion: 1, text: '你好，世界。', audioSha256: 'a'.repeat(64), durationSeconds: 1.5, engine: 'fixture/forced-aligner', model: 'fixture', units: [{ start: 0, end: 1, startTime: 0.1, endTime: 0.3 }, { start: 1, end: 2, startTime: 0.3, endTime: 0.5 }, { start: 3, end: 4, startTime: 0.8, endTime: 1 }, { start: 4, end: 5, startTime: 1, endTime: 1.2 }] }

describe('voice timing evidence', () => {
  it('reports unresolved letters without treating punctuation or whitespace as missing speech', () => {
    expect(voiceAlignmentUnresolvedCharacters(alignment)).toBe(0)
    expect(voiceAlignmentUnresolvedCharacters({ ...alignment, units: alignment.units.filter(unit => unit.start !== 1) })).toBe(1)
    expect(voiceAlignmentUnresolvedCharacters({ ...alignment, text: '𠮷a！\n', units: [{ start: 0, end: 2, startTime: 0.1, endTime: 0.3 }] })).toBe(1)
  })
  it('uses real intervals and preserves pauses rather than filling them', () => {
    expect(parseVoiceAlignment(alignment, { text: alignment.text, sha256: alignment.audioSha256, durationSeconds: 1.5 })).toEqual(alignment)
    expect(voiceAlignmentUnitAt(alignment, 0.2)?.start).toBe(0)
    expect(voiceAlignmentUnitAt(alignment, 0.3)?.start).toBe(1)
    expect(voiceAlignmentUnitAt(alignment, 0.6)).toBeUndefined()
    expect(voiceAlignmentUnitAt(alignment, 1.6)).toBeUndefined()
    // A seek can move backwards without keeping the prior word highlighted.
    expect(voiceAlignmentUnitAt(alignment, 1.1)?.start).toBe(4)
    expect(voiceAlignmentUnitAt(alignment, 0.2)?.start).toBe(0)
  })
  it.each([
    { text: '改过的文本', sha256: alignment.audioSha256 },
    { text: alignment.text, sha256: 'b'.repeat(64) },
    { text: alignment.text, sha256: alignment.audioSha256, durationSeconds: 2 },
  ])('rejects changed text or master audio (%j)', expected => expect(() => parseVoiceAlignment(alignment, expected)).toThrow('ALIGNMENT_INVALID'))

  it.each([
    { ...alignment, units: [] },
    { ...alignment, units: [{ start: 0, end: 8, startTime: 0, endTime: 1 }] },
    { ...alignment, units: [{ start: 0, end: 1, startTime: 0.5, endTime: 0.5 }] },
    { ...alignment, units: [{ start: 0, end: 1, startTime: 0.5, endTime: 2 }] },
    { ...alignment, units: [...alignment.units, alignment.units[0]!] },
    { ...alignment, text: '𠮷野', units: [{ start: 0, end: 1, startTime: 0.1, endTime: 0.5 }] },
  ])('rejects invalid ranges and timing without inventing a repair (case %#)', value => expect(() => parseVoiceAlignment(value)).toThrow('ALIGNMENT_INVALID'))

  it('keeps Unicode scalar and English word offsets in UTF-16 coordinates', () => {
    const value = { ...alignment, text: '𠮷野 hello', units: [{ start: 0, end: 2, startTime: 0, endTime: 0.2 }, { start: 2, end: 3, startTime: 0.2, endTime: 0.4 }, { start: 4, end: 9, startTime: 0.5, endTime: 1 }] }
    expect(parseVoiceAlignment(value)).toEqual(value)
  })
})
