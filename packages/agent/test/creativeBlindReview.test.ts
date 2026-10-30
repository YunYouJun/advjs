import { describe, expect, it } from 'vitest'
import { collectCreativeBlindReviews, createCreativeBlindPacket, parseCreativeBlindSample } from '../src/evaluation/blind-review'

const scale = { narrative: '1–5 narrative', characters: '1–5 characters', style: '1–5 style', playability: '1–5 playability' }
const options = { scope: 'fixture' as const, seeds: [1729, 2718, 3141], qualityScale: scale }
const budget = { maxTotalTokens: 12000, maxMicroCny: 130000, deadlineMs: 180000 }
const versions = { model: 'fixture-model-hidden', prompts: 'fixture-prompt-hidden', runtime: 'fixture-runtime-hidden', tools: 'fixture-tools-hidden', project: 'fixture-baseline-hidden' }
function rawSample(mode: 'B' | 'C', seed = 1729, id = 'local-01', category: 'local' | 'chapter' | 'short-story' = 'local') {
  const input = { input: { mode, seed, input: { id, category, prompt: '修改一句对白，保留两个结局', checks: ['人物一致', '双结局'] }, project: { id: 'station', files: { 'adv/world.md': '# 当代车站' }, media: [], specifiedEndings: ['stay', 'leave'] } }, versions }
  const final = { outcome: 'completed', summary: '创作补充', project: { files: { 'adv/chapters/station.adv.md': `# 车站\n\n@lin\n等一会儿。` } }, consumption: { inputTokens: 10, outputTokens: 5, totalTokens: 15, costMicroCny: 25, toolCalls: 3, latencyMs: 10, reworkRounds: 0 }, ...(mode === 'C' ? { mode, caseId: id, category, seed, versions, run: { artifacts: [{ status: 'selected', output: { kind: 'art-direction', style: '冷灰雨夜', requests: [] } }] } } : {}) }
  return { input, final, budget, evidence: { input: `private-${mode}-input-hash`, final: `private-${mode}-final-hash` } }
}
function sample(...args: Parameters<typeof rawSample>) {
  return parseCreativeBlindSample(rawSample(...args))
}
function filled(form: Awaited<ReturnType<typeof createCreativeBlindPacket>>['form'], authorId: string) {
  return { ...structuredClone(form), authorId, declaration: { human: true, independent: true, modeUndisclosed: true }, reviews: form.reviews.map(item => ({ ...item, preferred: 'sample-1', scores: { 'sample-1': { narrative: 4, characters: 3, style: 5, playability: 4 }, 'sample-2': { narrative: 2, characters: 3, style: 4, playability: 4 } }, notes: '仅为明确测试样本，不是真实作者意见。' })) }
}

describe('paired blind review materials and human vote collection', () => {
  it('accepts both real final layouts and keeps versions, costs, identities and the key out of public metadata', async () => {
    const result = await createCreativeBlindPacket([sample('B'), sample('C')], options)
    expect(result.packet.pairs).toHaveLength(1)
    const publicText = JSON.stringify(result.packet)
    for (const hidden of [...Object.values(versions), 'private-B-input-hash', 'costMicroCny', 'authorId', 'caseId', 'nonce', 'modes'])
      expect(publicText).not.toContain(hidden)
    expect(result.ledger.pairs[0].modes).toEqual(expect.objectContaining({ 'sample-1': expect.stringMatching(/^[BC]$/), 'sample-2': expect.stringMatching(/^[BC]$/) }))
    expect(new Set(Object.values(result.ledger.pairs[0].modes)).size).toBe(2)
    expect(result.form.authorId).toBe('')
    expect(result.form.reviews[0].preferred).toBeNull()
    expect(result.form.reviews[0].scores['sample-1'].narrative).toBeNull()
    await expect(collectCreativeBlindReviews(result.packet, result.ledger, [result.form])).rejects.toThrow()
  })
  it('unblinds actual paired scores without creating a real-author or routing claim from fixtures', async () => {
    const result = await createCreativeBlindPacket([sample('B'), sample('C')], options)
    const summary = await collectCreativeBlindReviews(result.packet, result.ledger, [filled(result.form, 'author-a'), filled(result.form, 'author-b')], { blindingReviewedBy: 'fixture-organizer' })
    expect(summary.judgments[0].preferred).toBe(result.ledger.pairs[0].modes['sample-1'])
    expect(summary.judgments[0].scores[result.ledger.pairs[0].modes['sample-1']].narrative).toBe(4)
    expect(summary.judgments[0].scores[result.ledger.pairs[0].modes['sample-2']].narrative).toBe(2)
    expect(summary.incompletePairs).toEqual([])
    expect(summary.byCategory.local).toMatchObject({ inputs: 0, evidenceSufficient: false })
    expect(summary.humanEvidence).toBe('fixture-only, not author evidence')
    expect(summary.routingDecision).toBe('unchanged')
  })
  it('rejects incomplete scores, duplicate authors, changed material and a changed private assignment', async () => {
    const result = await createCreativeBlindPacket([sample('B'), sample('C')], options)
    const form = filled(result.form, 'author-a')
    await expect(collectCreativeBlindReviews(result.packet, result.ledger, [form, { ...form, authorId: ' AUTHOR-A ' }])).rejects.toThrow('Duplicate')
    const incomplete = structuredClone(form)
    incomplete.reviews[0].scores['sample-2'].style = 0
    await expect(collectCreativeBlindReviews(result.packet, result.ledger, [incomplete])).rejects.toThrow('four human scores')
    const changed = structuredClone(result.packet)
    changed.pairs[0].samples['sample-1'].files['adv/chapters/station.adv.md'] = 'changed'
    await expect(collectCreativeBlindReviews(changed, result.ledger, [form])).rejects.toThrow('changed')
    const key = structuredClone(result.ledger)
    const modes = key.pairs[0].modes
    modes['sample-1'] = modes['sample-2']
    await expect(collectCreativeBlindReviews(result.packet, key, [form])).rejects.toThrow('changed')
  })
  it('refuses unequal versions, source/media or budgets and does not fill missing or failed counterparts', async () => {
    const b = sample('B')
    for (const mutate of [(c: typeof b) => c.budget.maxTotalTokens++, (c: typeof b) => c.versions.model += '-different', (c: typeof b) => c.baseline = { different: true }]) {
      const c = sample('C')
      mutate(c)
      await expect(createCreativeBlindPacket([b, c], options)).rejects.toThrow('differ')
    }
    const missing = await createCreativeBlindPacket([b], options)
    expect(missing.ledger.excluded).toMatchObject([{ reason: 'missing-paired-result', sources: { B: { consumption: b.consumption } } }])
    expect((await collectCreativeBlindReviews(missing.packet, missing.ledger, [])).resources).toMatchObject([{ excluded: true, mode: 'B', consumption: b.consumption }])
    const c = sample('C')
    c.outcome = 'provider'
    const failed = await createCreativeBlindPacket([b, c], options)
    expect(failed.packet.pairs).toEqual([])
    expect(failed.ledger.excluded[0].reason).toBe('provider')
    c.outcome = 'completed'
    c.consumption.costMicroCny = budget.maxMicroCny + 1
    expect((await createCreativeBlindPacket([b, c], options)).ledger.excluded[0].reason).toBe('cap-exceeded')
    await expect(createCreativeBlindPacket([b, b], options)).rejects.toThrow('Duplicate')
  })
  it('counts eight inputs after three repeats and two authors, separately by category', async () => {
    const sources = Array.from({ length: 8 }, (_, index) => [1729, 2718, 3141].flatMap(seed => [sample('B', seed, `chapter-${index}`, 'chapter'), sample('C', seed, `chapter-${index}`, 'chapter')])).flat()
    const result = await createCreativeBlindPacket(sources, options)
    const forms = ['author-a', 'author-b'].map((id) => {
      const form = filled(result.form, id)
      for (const review of form.reviews) {
        review.preferred = result.ledger.pairs.find(pair => pair.id === review.pairId)!.modes['sample-1'] === 'C' ? 'sample-1' : 'sample-2'
      }
      return form
    })
    const summary = await collectCreativeBlindReviews(result.packet, result.ledger, forms)
    expect(summary.judgments).toHaveLength(48)
    expect(summary.byCategory.chapter).toMatchObject({ inputs: 8, preferredC: 8, evidenceSufficient: true })
    expect(summary.byCategory.local).toMatchObject({ inputs: 0, evidenceSufficient: false })
    expect(summary.blinding.readyForInterpretation).toBe(false)
    expect(summary.routingDecision).toBe('unchanged')
  })
  it('projects creative advice without director evidence, artifact references, role IDs or fees', () => {
    const source = rawSample('C')
    const result = parseCreativeBlindSample({ ...source, final: { ...source.final, run: { artifacts: [{ status: 'selected', output: { kind: 'delivery-summary', summary: '收尾建议', overview: '雨夜的悬念来自未寄出的信。', deliverables: [{ artifactId: 'private-writer-artifact', fingerprint: 'private-fingerprint', assessment: '两人动机清楚。' }], risks: ['配音尚未制作'], nextSteps: ['请作者核对节奏'], evidence: { state: { tasks: [{ partner: 'writer', chargedMicroPoints: 999 }], chargedBeforeSummary: 999 } } } }] } } })
    expect(result.material.supplement).toContain('两人动机清楚')
    expect(result.material.supplement).toContain('配音尚未制作')
    for (const value of ['private-writer-artifact', 'private-fingerprint', 'chargedMicroPoints', 'chargedBeforeSummary', 'partner', 'evidence'])
      expect(result.material.supplement).not.toContain(value)
  })
  it('excludes a provider-invalidated result without replacing its original consumption', async () => {
    const source = rawSample('B')
    const b = parseCreativeBlindSample({ ...source, providerCheck: { executionOutcome: 'completed', result: { outcome: 'system', consumption: source.final.consumption } } })
    expect(b.consumption).toEqual(source.final.consumption)
    const packet = await createCreativeBlindPacket([b, sample('C')], options)
    expect(packet.packet.pairs).toEqual([])
    expect(packet.ledger.excluded).toMatchObject([{ reason: 'system' }])
    expect(() => parseCreativeBlindSample({ ...source, providerCheck: { executionOutcome: 'completed', result: { outcome: 'completed', consumption: source.final.consumption } } })).toThrow('cannot upgrade')
    expect(() => parseCreativeBlindSample({ ...source, providerCheck: { executionOutcome: 'completed', result: { outcome: 'system', consumption: { ...source.final.consumption, totalTokens: 100 } } } })).toThrow('replace its accounting')
  })
  it('keeps explicit content markers visible to the organizer and does not certify blinding', async () => {
    const b = sample('B')
    b.material.supplement = '强单Agent 的自我说明'
    const result = await createCreativeBlindPacket([b, sample('C')], { ...options, scope: 'real-evaluation' })
    expect(JSON.stringify(result.packet)).toContain('强单Agent 的自我说明')
    const collected = await collectCreativeBlindReviews(result.packet, result.ledger, [filled(result.form, 'fixture-only-author-a'), filled(result.form, 'fixture-only-author-b')], { blindingReviewedBy: 'fixture-only-organizer' })
    expect(collected.blinding.explicitModeMarkers).toEqual([result.packet.pairs[0].id])
    expect(collected.blinding.readyForInterpretation).toBe(false)
    expect((await collectCreativeBlindReviews(result.packet, result.ledger, [])).humanEvidence).toBe('no human judgments supplied')
  })
})
