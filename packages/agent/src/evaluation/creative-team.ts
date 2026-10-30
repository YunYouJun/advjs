import { summarizeCreativeVotes } from './preference'

/** A fixed input category is the unit of analysis, not each correlated repeat. */
export type CreativeEvaluationCategory = 'local' | 'chapter' | 'short-story'
export type CreativeEvaluationMode = 'A' | 'B' | 'C'

/** Every run records effective versions and all orchestration costs. */
export interface CreativeEvaluationResult {
  caseId: string
  category: CreativeEvaluationCategory
  seed: number
  mode: CreativeEvaluationMode
  versions: { model: string, prompts: string, tools: string, runtime: string, project: string }
  inputFingerprint: string
  outcome: 'completed' | 'generation-quality' | 'system' | 'provider' | 'billing' | 'cancelled'
  usability: { compiled: boolean, referencesValid: boolean, specifiedEndingsReached: number, mediaPlayback: 'passed' | 'failed' | 'unverified' }
  defects: { expected: number, detected: number, falsePositives: number, retestPassed: number }
  consumption: { inputTokens: number, outputTokens: number, totalTokens: number, costMicroCny: number, toolCalls: number, latencyMs: number, reworkRounds: number }
  author: { edits: number, confirmations: number, repeatedInstructions: number }
  evidence: readonly string[]
}

/** Blind judgments are recorded separately from generation/system results. */
export interface CreativeBlindJudgment {
  caseId: string
  seed: number
  authorId: string
  preferred: 'B' | 'C' | 'tie'
  scores: { narrative: number, characters: number, style: number, playability: number }
}

/** Existing single-score records retain their original public contract. */
export function summarizeCreativePreference(judgments: readonly CreativeBlindJudgment[]) {
  for (const judgment of judgments) {
    if (Object.values(judgment.scores).some(score => !Number.isInteger(score) || score < 1 || score > 5))
      throw new TypeError('Quality scores must be integers from 1 to 5')
  }
  return summarizeCreativeVotes(judgments)
}
