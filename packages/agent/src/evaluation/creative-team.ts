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

/** Paired, input-level Wilson interval: repeats cannot inflate the sample count. */
export function summarizeCreativePreference(judgments: readonly CreativeBlindJudgment[]): { inputs: number, preferredC: number, rate: number, confidence95: readonly [number, number], evidenceSufficient: boolean } {
  const grouped = new Map<string, CreativeBlindJudgment[]>()
  const seen = new Set<string>()
  for (const judgment of judgments) {
    const identity = JSON.stringify([judgment.caseId, judgment.seed, judgment.authorId])
    if (seen.has(identity))
      throw new TypeError('Duplicate blind judgment')
    if (Object.values(judgment.scores).some(score => !Number.isInteger(score) || score < 1 || score > 5))
      throw new TypeError('Quality scores must be integers from 1 to 5')
    seen.add(identity)
    const values = grouped.get(judgment.caseId) ?? []
    values.push(judgment)
    grouped.set(judgment.caseId, values)
  }
  const eligible = [...grouped.values()].filter(values => new Set(values.map(item => item.seed)).size >= 3
    && [...new Set(values.map(item => item.seed))].every(seed => new Set(values.filter(item => item.seed === seed).map(item => item.authorId)).size >= 2))
  const n = eligible.length
  const wins = eligible.filter(values => values.filter(item => item.preferred === 'C').length > values.length / 2).length
  if (!n)
    return { inputs: 0, preferredC: 0, rate: 0, confidence95: [0, 1], evidenceSufficient: false }
  const z = 1.959963984540054
  const rate = wins / n
  const denominator = 1 + z ** 2 / n
  const center = (rate + z ** 2 / (2 * n)) / denominator
  const margin = z * Math.sqrt(rate * (1 - rate) / n + z ** 2 / (4 * n ** 2)) / denominator
  return { inputs: n, preferredC: wins, rate, confidence95: [center - margin, center + margin], evidenceSufficient: n >= 8 }
}
