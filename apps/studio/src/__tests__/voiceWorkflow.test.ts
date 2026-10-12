import { describe, expect, it } from 'vitest'
import { readVoiceWorkflowQuery, voiceWorkflowLocation } from '../utils/voiceWorkflow'

describe('studio voice workflow navigation scope', () => {
  it('roundtrips an exact role and line without execution or selection flags', () => {
    const location = voiceWorkflowLocation('jobs', 'hero', 'stable-line')
    expect(location.path).toBe('/tabs/workspace/audio')
    expect(readVoiceWorkflowQuery(location.query)).toEqual({ section: 'jobs', speakerId: 'hero', lineId: 'stable-line' })
    expect(location.query).toEqual({ section: 'jobs', speaker: 'hero', line: 'stable-line' })
  })
  it('rejects repeated, unsupported, oversized and control-bearing query values', () => {
    expect(readVoiceWorkflowQuery({ section: 'execute', speaker: ['hero', 'other'], line: 'a'.repeat(161) })).toEqual({ section: undefined, speakerId: '', lineId: '' })
    expect(readVoiceWorkflowQuery({ section: 'review', speaker: `hero${String.fromCharCode(10)}` })).toEqual({ section: 'review', speakerId: '', lineId: '' })
  })
})
