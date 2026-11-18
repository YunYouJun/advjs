import { describe, expect, it } from 'vitest'
import { summarizeCreativePreference } from '../src/evaluation/creative-team'

describe('input-level blind evaluation', () => {
  it('reports no quality evidence for no judgments or repeated samples of only one input', () => {
    expect(summarizeCreativePreference([])).toMatchObject({ inputs: 0, evidenceSufficient: false, confidence95: [0, 1] })
    const judgments = [1729, 2718, 3141].flatMap(seed => ['author-a', 'author-b'].map(authorId => ({ caseId: 'short-story-01', seed, authorId, preferred: 'C' as const, scores: { narrative: 4, characters: 4, style: 4, playability: 4 } })))
    expect(summarizeCreativePreference(judgments)).toMatchObject({ inputs: 1, preferredC: 1, evidenceSufficient: false })
    expect(summarizeCreativePreference(judgments).confidence95[0]).toBeLessThan(0.5)
    expect(() => summarizeCreativePreference([...judgments, judgments[0]])).toThrow(/Duplicate/)
  })
})
