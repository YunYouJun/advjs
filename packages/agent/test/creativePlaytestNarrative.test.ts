import type { CreativeNarrativeConcern, CreativeNarrativeDecision, CreativePartnerOutput } from '../src'
import { describe, expect, it } from 'vitest'
import { assertCreativePlaytestNarrativeSource, computeAgentProjectRevision, createCreativePlaytestNarrativeReview, createCreativeTeamRun, creativeNarrativeSourceStatus, creativePlaytestFindings, parseCreativeDirectorSummaryEvidence, parseCreativeNarrativeConcern, parseCreativePartnerOutput, parseCreativePlaytestNarrativeReview, parseCreativePlaytestReport, parseCreativeTeamRun, prepareCreativeDirectorSummaryEvidence, prepareCreativePlaytestRepair, runCreativePlaytest } from '../src'
import corpus from './fixtures/creative-narrative-review-v1.json'
import captured from './fixtures/creative-playtest-narrative-author-host.json'
import frozen from './fixtures/creative-team/v2/project.json'
import { creativeArtifact, creativePlan } from './helpers/creative-team'

const chapter = 'adv/chapters/station.adv.md'
const scenarios = [{ id: 'stay', choices: [0], expectedEnding: 'stay#ending-stay' }, { id: 'leave', choices: [1], expectedEnding: 'leave#ending-leave' }]
async function fixture(sample = corpus.cases[0]!) {
  const files: Record<string, string> = { ...frozen.files, 'adv/world.md': '# 雨夜车站\n科技水平与当代相同，不存在超能力。\n', [chapter]: `# 雨夜车站 {#arrival}\n\n> ${sample.statement}\n\n- [留下](stay#ending-stay)\n- [离开](leave#ending-leave)\n` }
  const concern: CreativeNarrativeConcern = { path: chapter, line: 3, expected: sample.expected, actual: sample.actual, suggestion: '由作者核对并交给编剧处理，不能自动改写世界设定。', evidence: { expected: { path: sample.basisPath, line: sample.basisLine, endLine: sample.basisLine, text: sample.basisText }, actual: { path: chapter, line: 3, endLine: 3, text: `> ${sample.statement}` } } }
  const project = { id: 'station', files, revision: await computeAgentProjectRevision(files) }
  const plan = { ...creativePlan(), projectRevision: project.revision }
  const run = createCreativeTeamRun({ id: 'run1', accountId: 'author1', plan, now: 0 })
  run.status = 'awaiting_review'
  run.tasks = run.tasks.map(task => ({ ...task, status: 'completed', attempt: 1 }))
  const output = parseCreativePartnerOutput('playtest-plan', { kind: 'playtest-plan', summary: '独立核对源中的疑点', scenarios, concerns: [concern] }, { projectId: project.id, projectRevision: project.revision, files, characterIds: ['lin', 'qiao'], limits: plan.limits })
  run.artifacts = [creativeArtifact({ id: 'narrative-plan', taskId: 'test', partner: 'playtester', kind: 'playtest-plan', fingerprint: 'narrative-plan-v1', source: { projectId: project.id, revision: project.revision, files, upstream: [] }, output, changes: [], reviewCapabilities: [], status: 'candidate' })]
  const input = { run, artifactId: run.artifacts[0]!.id, fingerprint: run.artifacts[0]!.fingerprint, decisions: [{ index: 0, status: sample.decision as CreativeNarrativeDecision['status'], reason: sample.reason }] }
  return { project, run, concern, input }
}

describe('source-grounded narrative review, independently from core execution', () => {
  it('replays the real captured browser report, source overlay and author decisions through the public core runner', async () => {
    const report = parseCreativePlaytestReport(captured.report)
    const run = parseCreativeTeamRun(captured.run, { accountId: captured.run.accountId, projectId: captured.project.id })
    const review = report.narrativeReview!
    const replay = await runCreativePlaytest({ project: captured.project, scenarios: report.executions.map(item => item.scenario), candidate: { run, artifacts: report.artifacts }, narrative: { run, artifactId: review.artifactId, fingerprint: review.fingerprint, decisions: review.rows.flatMap(row => row.decision ? [{ index: row.index, ...row.decision }] : []) } })
    expect(replay.snapshotRevision).toBe(report.snapshotRevision)
    expect(await computeAgentProjectRevision(captured.effectiveFiles)).toBe(report.snapshotRevision)
    expect(replay.program).toEqual(report.program)
    expect(replay.executions).toEqual(report.executions)
    expect(replay.narrativeReview).toEqual(report.narrativeReview)
  })

  it('freezes actual author narrative decisions in director evidence without changing their authority', async () => {
    const f = await fixture()
    const report = await runCreativePlaytest({ project: f.project, scenarios, narrative: f.input })
    f.run.plan.tasks = [...f.run.plan.tasks, { id: 'delivery', partner: 'director', capability: 'summarize-production', dependsOn: ['test'], sourcePaths: Object.keys(f.project.files), instruction: '审阅实际证据', expectedOutput: '交付建议' }]
    f.run.tasks = [...f.run.tasks, { taskId: 'delivery', status: 'pending', attempt: 0, artifactIds: [] }]
    f.run.playtests = [{ id: 'report1', projectId: report.projectId, baselineRevision: report.baselineRevision, snapshotRevision: report.snapshotRevision, artifacts: [], scope: 'saved', runnerVersion: report.runnerVersion, verification: 'author-host', passed: 2, failed: 0, blocked: 0, cancelled: 0, createdAt: 1 }]
    const evidence = prepareCreativeDirectorSummaryEvidence(f.run, 'delivery', { revision: f.project.revision, files: f.project.files }, { report1: report }, report.snapshotRevision)
    expect(evidence.reports[0]!.narrativeReview).toEqual(report.narrativeReview)
    expect(() => parseCreativeDirectorSummaryEvidence({ ...evidence, reports: [{ ...evidence.reports[0], narrativeReview: { ...report.narrativeReview, snapshotRevision: `sha256:${'f'.repeat(64)}` } }] })).toThrow()
  })

  it.each(corpus.cases)('retains both source witnesses and the explicit author judgement: $id', async (sample) => {
    const f = await fixture(sample)
    const report = await runCreativePlaytest({ project: f.project, scenarios, narrative: f.input })
    expect(report.executions.map(item => item.status)).toEqual(['passed', 'passed'])
    expect(report.narrativeReview?.rows[0]).toEqual({ index: 0, concern: f.concern, sourceStatus: 'matched', decision: { status: sample.decision, reason: sample.reason } })
    expect(report.unverified).toContain('narrative-consistency')
    expect(creativePlaytestFindings(report).filter(item => item.kind === 'narrative')).toHaveLength(sample.decision === 'confirmed' ? 1 : 0)
    expect(() => assertCreativePlaytestNarrativeSource(report.narrativeReview!, f.run, f.project.files, f.project.files)).not.toThrow()
    expect(parseCreativePlaytestReport(JSON.parse(JSON.stringify(report)))).toEqual(report)
  })

  it('never promotes unreviewed or unanchored legacy suggestions to verified findings', async () => {
    const f = await fixture()
    const report = await runCreativePlaytest({ project: f.project, scenarios, narrative: { ...f.input, decisions: [] } })
    expect(report.narrativeReview?.rows[0]?.decision).toBeUndefined()
    expect(creativePlaytestFindings(report).filter(item => item.kind === 'narrative')).toEqual([])
    const { evidence: _evidence, ...legacy } = f.concern
    const artifact = f.run.artifacts[0]!
    artifact.output = { ...artifact.output as Extract<CreativePartnerOutput, { kind: 'playtest-plan' }>, concerns: [legacy] }
    expect(() => createCreativePlaytestNarrativeReview(f.input, { revision: f.project.revision, files: f.project.files }, f.project.files)).toThrow('CREATIVE_NARRATIVE_SOURCE_CONFLICT')
    const historical = createCreativePlaytestNarrativeReview({ ...f.input, decisions: [] }, { revision: f.project.revision, files: f.project.files }, f.project.files)
    expect(historical.rows[0]?.sourceStatus).toBe('unanchored')
  })

  it('rejects invented, partial, out-of-range and mislocated quotes while normalizing only CRLF', async () => {
    const f = await fixture()
    const raw = structuredClone(f.concern)
    raw.evidence!.actual.text = '凭空编造的证据'
    expect(() => parseCreativeNarrativeConcern(raw, f.project.files)).toThrow()
    expect(() => parseCreativeNarrativeConcern({ ...f.concern, line: 4 }, f.project.files)).toThrow()
    expect(() => parseCreativeNarrativeConcern({ ...f.concern, evidence: { expected: f.concern.evidence!.expected } })).toThrow()
    expect(() => parseCreativeNarrativeConcern({ ...f.concern, evidence: { ...f.concern.evidence, actual: { ...f.concern.evidence!.actual, endLine: 999 } } })).toThrow()
    const windows = Object.fromEntries(Object.entries(f.project.files).map(([path, content]) => [path, content.replace(/\n/g, '\r\n')]))
    expect(parseCreativeNarrativeConcern(f.concern, windows)).toEqual(f.concern)
    const quote = { path: 'adv/chapters/flow.chapter.json', line: 2, endLine: 3, text: '  "text": "车站没有超能力",\n  "speakerId": "lin"' }
    const flowConcern = { ...f.concern, path: quote.path, line: 2, evidence: { expected: f.concern.evidence!.expected, actual: quote } }
    const flowFiles = { ...f.project.files, [quote.path]: `{\n${quote.text}\n}` }
    expect(creativeNarrativeSourceStatus(parseCreativeNarrativeConcern(flowConcern, flowFiles), flowFiles)).toBe('matched')
    expect(() => parseCreativeNarrativeConcern({ ...f.concern, evidence: { ...f.concern.evidence, expected: { ...f.concern.evidence!.expected, path: '../private.txt' } } })).toThrow()
  })

  it('binds judgements to the tested proposal, snapshot and actual source rather than caller authority', async () => {
    const f = await fixture()
    const snapshot = { revision: f.project.revision, files: f.project.files }
    const review = createCreativePlaytestNarrativeReview(f.input, snapshot, snapshot.files)
    expect(() => createCreativePlaytestNarrativeReview({ ...f.input, fingerprint: 'other' }, snapshot, snapshot.files)).toThrow()
    expect(() => createCreativePlaytestNarrativeReview({ ...f.input, decisions: [...f.input.decisions, ...f.input.decisions] }, snapshot, snapshot.files)).toThrow()
    expect(() => createCreativePlaytestNarrativeReview({ ...f.input, decisions: [{ ...f.input.decisions[0]!, reason: '' }] }, snapshot, snapshot.files)).toThrow()
    expect(() => assertCreativePlaytestNarrativeSource({ ...review, rows: [{ ...review.rows[0]!, concern: { ...f.concern, actual: '伪造结论' } }] }, f.run, snapshot.files, snapshot.files)).toThrow()
    const changed = { ...snapshot.files, [chapter]: snapshot.files[chapter]!.replace('瞬移', '走路') }
    expect(() => createCreativePlaytestNarrativeReview(f.input, { ...snapshot, files: changed }, snapshot.files)).toThrow()
    const report = await runCreativePlaytest({ project: f.project, scenarios, narrative: f.input })
    expect(() => parseCreativePlaytestReport({ ...report, narrativeReview: { ...review, snapshotRevision: `sha256:${'0'.repeat(64)}` } })).toThrow()
    expect(() => parseCreativePlaytestNarrativeReview({ ...review, verification: 'server-certified' })).toThrow()
  })

  it('bounds the copied evidence, preserves omissions and rejects oversized or inconsistent claims', async () => {
    const f = await fixture()
    const artifact = f.run.artifacts[0]!
    artifact.output = { ...artifact.output as Extract<CreativePartnerOutput, { kind: 'playtest-plan' }>, concerns: Array.from({ length: 32 }, () => ({ ...f.concern, actual: '长中文解释'.repeat(350) })) }
    const review = createCreativePlaytestNarrativeReview({ ...f.input, decisions: [] }, { revision: f.project.revision, files: f.project.files }, f.project.files)
    expect(review.rows.length).toBeGreaterThan(0)
    expect(review.rowsOmitted).toBeGreaterThan(0)
    expect(review.rows.length + review.rowsOmitted).toBe(32)
    expect(new TextEncoder().encode(JSON.stringify(review)).length).toBeLessThanOrEqual(16384)
    expect(() => parseCreativePlaytestNarrativeReview({ ...review, rowsOmitted: 32 })).toThrow()
    expect(() => assertCreativePlaytestNarrativeSource({ ...review, rowsOmitted: 0 }, f.run, f.project.files, f.project.files)).toThrow()
  })

  it('hands confirmed evidence and both original source files to the chosen owner, then independently executes the repaired project', async () => {
    const f = await fixture()
    const report = await runCreativePlaytest({ project: f.project, scenarios, narrative: f.input })
    f.run.playtests = [{ id: 'report1', projectId: report.projectId, baselineRevision: report.baselineRevision, snapshotRevision: report.snapshotRevision, artifacts: [], scope: 'saved', runnerVersion: report.runnerVersion, verification: 'author-host', passed: 2, failed: 0, blocked: 0, cancelled: 0, createdAt: 1 }]
    const handoff = prepareCreativePlaytestRepair({ run: f.run, project: f.project, report, taskId: 'script', reference: { reportId: 'report1', snapshotRevision: report.snapshotRevision, findingId: 'narrative:0' } })
    expect(handoff.repair?.finding).toMatchObject({ kind: 'narrative', code: 'ADV_CREATIVE_NARRATIVE_AUTHOR_CONFIRMED', source: { path: chapter, line: 3 } })
    expect(handoff.facts.files['adv/world.md']).toBe(f.project.files['adv/world.md'])
    expect(handoff.facts.files[chapter]).toBe(f.project.files[chapter])
    expect(handoff.repair?.files).toEqual({})
    const files = { ...f.project.files, [chapter]: f.project.files[chapter]!.replace('没有借助设备，瞬移穿过封闭的站台', '沿着通道，走到站台另一端') }
    const repaired = await runCreativePlaytest({ project: { ...f.project, files, revision: await computeAgentProjectRevision(files) }, scenarios })
    expect(repaired.executions.map(item => item.status)).toEqual(['passed', 'passed'])
    expect(repaired.snapshotRevision).not.toBe(report.snapshotRevision)
    expect(report.narrativeReview!.rows[0]!.decision!.status).toBe('confirmed')
    expect(repaired.narrativeReview).toBeUndefined()
    expect(repaired.unverified).toContain('narrative-consistency')
  })
})
