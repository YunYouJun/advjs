export interface CreativePreferenceVote { caseId: string, seed: number, authorId: string, preferred: 'B' | 'C' | 'tie' }

/** Paired, input-level Wilson interval: repeats cannot inflate the sample count. */
export function summarizeCreativeVotes(judgments: readonly CreativePreferenceVote[]): { inputs: number, preferredC: number, rate: number, confidence95: readonly [number, number], evidenceSufficient: boolean } {
  const grouped = new Map<string, CreativePreferenceVote[]>()
  const seen = new Set<string>()
  for (const judgment of judgments) {
    const identity = JSON.stringify([judgment.caseId, judgment.seed, judgment.authorId])
    if (seen.has(identity))
      throw new TypeError('Duplicate blind judgment')
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
