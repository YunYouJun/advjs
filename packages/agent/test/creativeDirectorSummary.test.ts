import type { CreativeArtifact, CreativeTeamRun } from '../src'
import { describe, expect, it } from 'vitest'
import { canRequestCreativeDirectorSummary, createCreativeTeamRun, creativeDirectorSummaryBriefs, creativeOutputFileChanges, isCreativeDirectorSummaryCurrent, nextCreativeTeamTask, parseCreativeDirectorSummaryContext, parseCreativePartnerOutput, parseCreativeTeamPlan, parseCreativeTeamRun, prepareCreativeDirectorSummaryEvidence, reduceCreativeTeamRun, runCreativePlaytest } from '../src'
import project from './fixtures/creative-team/v2/project.json'

const usage = (chargedMicroPoints: number) => ({ inputTokens: 10, outputTokens: 10, totalTokens: 20, providerCostMicroCny: 1, chargedMicroPoints })
const facts = { revision: 'r1', files: { 'adv/world.md': '已保存的创作目标' } }
function setup() {
  let run = createCreativeTeamRun({ id: 'run1', accountId: 'author', now: 0, plan: { protocolVersion: 1, projectId: 'station', projectRevision: 'r1', goal: '实际成果的导演交付建议', limits: { maxTasks: 4, maxToolCalls: 8, maxReworkRounds: 1, maxMicroPoints: 100 }, tasks: [
    { id: 'script', partner: 'writer', capability: 'write-chapters', dependsOn: [], sourcePaths: ['adv/world.md'], instruction: 'Write', expectedOutput: 'Chapter' },
    { id: 'delivery', partner: 'director', capability: 'summarize-production', dependsOn: ['script'], sourcePaths: ['adv/world.md'], instruction: 'Summarize actual results', expectedOutput: 'Editorial advice' },
  ] } })
  const act = (action: Parameters<typeof reduceCreativeTeamRun>[1]) => run = reduceCreativeTeamRun(run, action, run.updatedAt + 1)
  act({ type: 'approve-plan', decisionId: 'approve' })
  act({ type: 'reserve-next', taskId: 'script', inputFingerprint: 'input1', quotedMicroPoints: 10, toolCalls: 1 })
  const artifact: CreativeArtifact = { id: 'chapter1', taskId: 'script', runId: run.id, projectId: 'station', partner: 'writer', kind: 'chapter', source: { projectId: 'station', revision: facts.revision, files: facts.files, upstream: [] }, fingerprint: 'chapter-v1', summary: '实际章节', changes: [], reviewCapabilities: ['candidate-preview'], status: 'candidate' }
  act({ type: 'settle-task', taskId: 'script', dispatchKey: run.tasks[0]!.dispatchKey!, status: 'completed', usage: usage(10), artifacts: [artifact] })
  return { run: () => run, act }
}
function requested() {
  const h = setup()
  h.act({ type: 'select', taskId: 'script', artifactIds: ['chapter1'], decisionId: 'select-script', reason: '作者选定章节' })
  h.act({ type: 'request-rework', taskId: 'delivery', decisionId: 'request-summary', reason: '作者明确请求按剩余预算生成摘要' })
  const evidence = prepareCreativeDirectorSummaryEvidence(h.run(), 'delivery', facts, {}, facts.revision)
  const model = { kind: 'delivery-summary', summary: '导演建议', overview: '实际章节已选定，尚无实际试玩证据。', deliverables: [{ artifactId: 'chapter1', fingerprint: 'chapter-v1', assessment: '作者仍需核对剧情与媒体' }], risks: ['没有实际试玩报告'], nextSteps: ['执行两个指定结局'], recommendation: 'continue-creation' }
  const context = { projectId: 'station', projectRevision: facts.revision, files: facts.files, characterIds: [], limits: h.run().plan.limits, directorSummary: evidence }
  return { ...h, evidence, model, context }
}

describe('director editorial delivery summary', () => {
  it('waits for author choices and an explicit summary request, without creating a charge or terminal decision', () => {
    const h = setup()
    expect(canRequestCreativeDirectorSummary(h.run(), 'delivery')).toBe(false)
    expect(nextCreativeTeamTask(h.run())).toBeUndefined()
    h.act({ type: 'select', taskId: 'script', artifactIds: ['chapter1'], decisionId: 'selected', reason: '已审阅' })
    expect(canRequestCreativeDirectorSummary(h.run(), 'delivery')).toBe(true)
    expect(nextCreativeTeamTask(h.run())).toBeUndefined()
    expect(h.run().status).toBe('awaiting_review')
    h.act({ type: 'request-rework', taskId: 'delivery', decisionId: 'summary', reason: '生成导演建议' })
    expect(nextCreativeTeamTask(h.run())).toBe('delivery')
    expect(h.run().chargedMicroPoints).toBe(10)
    expect(h.run().delivery).toBeUndefined()
  })

  it('freezes actual totals and every selected result, rejecting invented references, costs and evidence', () => {
    const h = requested()
    const output = parseCreativePartnerOutput('delivery-summary', h.model, h.context)
    expect(output).toMatchObject({ evidence: { state: { chargedBeforeSummary: 10, pendingArtifacts: [] }, reports: [] } })
    expect(creativeOutputFileChanges(output, facts.files)).toEqual([])
    for (const patch of [{ chargedMicroPoints: 0 }, { passed: true }, { deliverables: [] }, { deliverables: [{ ...h.model.deliverables[0], fingerprint: 'invented' }] }, { evidence: { ...h.evidence, state: { ...h.evidence.state, chargedBeforeSummary: 0 } } }])
      expect(() => parseCreativePartnerOutput('delivery-summary', { ...h.model, ...patch }, h.context)).toThrow()
    expect(() => parseCreativePartnerOutput('delivery-summary', h.model, { ...h.context, directorSummary: undefined })).toThrow('frozen')
  })

  it('keeps its own settlement current and becomes stale after another actual outcome changes', () => {
    const h = requested()
    const output = parseCreativePartnerOutput('delivery-summary', h.model, h.context)
    h.act({ type: 'reserve-next', taskId: 'delivery', inputFingerprint: 'summary-input', quotedMicroPoints: 7, toolCalls: 1 })
    const artifact: CreativeArtifact = { id: 'summary1', taskId: 'delivery', runId: 'run1', projectId: 'station', partner: 'director', kind: 'delivery-summary', summary: output.summary, output, source: { projectId: 'station', revision: facts.revision, files: facts.files, upstream: [{ artifactId: 'chapter1', fingerprint: 'chapter-v1' }] }, fingerprint: 'summary-v1', status: 'candidate', changes: [], reviewCapabilities: [] }
    h.act({ type: 'settle-task', taskId: 'delivery', dispatchKey: h.run().tasks[1]!.dispatchKey!, status: 'completed', usage: usage(7), artifacts: [artifact] })
    expect(h.run().chargedMicroPoints).toBe(17)
    expect(isCreativeDirectorSummaryCurrent(h.run(), h.run().artifacts[1]!)).toBe(true)
    h.act({ type: 'select', taskId: 'delivery', artifactIds: ['summary1'], decisionId: 'select-summary', reason: '仅保留建议' })
    expect(h.run().status).toBe('awaiting_review')
    expect(parseCreativeTeamRun(h.run(), { accountId: 'author', projectId: 'station' }).artifacts[1]!.output).toEqual(output)
    h.act({ type: 'refresh-facts', files: { ...facts.files, 'adv/outline.md': '作者新增的内容' } })
    expect(h.run().artifacts[1]!.status).toBe('stale')
  })

  it('requires the summary to be terminal and preserves finite rework and account settlement gates', () => {
    const h = requested()
    expect(() => parseCreativeTeamPlan({ ...h.run().plan, tasks: [...h.run().plan.tasks, { ...h.run().plan.tasks[0], id: 'another', dependsOn: [] }] }, h.run().plan)).toThrow('every production task')
    expect(canRequestCreativeDirectorSummary({ ...h.run(), reservedMicroPoints: 1 }, 'delivery')).toBe(false)
    expect(canRequestCreativeDirectorSummary({ ...h.run(), status: 'completed' }, 'delivery')).toBe(false)
    expect(canRequestCreativeDirectorSummary({ ...h.run(), tasks: h.run().tasks.map(task => task.taskId === 'delivery' ? { ...task, attempt: 2, status: 'failed' } : task) }, 'delivery')).toBe(false)
  })

  it('preserves selected art and voice advice without repeating full dialogue sources or accepting foreign briefs', () => {
    const h = requested()
    const base = h.run().artifacts[0]!
    const voice: CreativeArtifact = { ...base, id: 'voice1', kind: 'voice-direction', partner: 'voice-director', output: { kind: 'voice-direction', summary: '克制表演', cast: [{ speakerId: 'lin', designBrief: '低音', performance: '疲惫但坚定' }], dictionary: [{ term: '站名', pronunciation: 'zhàn míng' }], lines: [{ path: 'adv/chapters/main.adv.md', speakerId: 'lin', lineId: 'voice-1', text: '不可重复的完整对白', instruction: '停顿后轻声说', source: { line: 10, endLine: 12, text: '@lin\n不可重复的完整对白' } }] } }
    const art: CreativeArtifact = { ...base, id: 'art1', kind: 'art-direction', partner: 'art-director', output: { kind: 'art-direction', summary: '雨夜', style: '冷灰色调，暖光指引出口', requests: [] } }
    const briefs = creativeDirectorSummaryBriefs({ artifacts: [base, art, voice, { ...art, id: 'unselected', status: 'candidate' }] })
    expect(briefs.map(item => item.artifactId)).toEqual(['art1', 'voice1'])
    expect(briefs[0]!.content).toContain('暖光指引出口')
    expect(briefs[1]!.content).toContain('疲惫但坚定')
    expect(briefs[1]!.content).toContain('停顿后轻声说')
    expect(briefs[1]!.content).not.toContain('不可重复的完整对白')
    const evidence = prepareCreativeDirectorSummaryEvidence({ ...h.run(), artifacts: [base, art, voice] }, 'delivery', facts, {}, facts.revision)
    expect(parseCreativeDirectorSummaryContext({ evidence, changes: [], briefs }).briefs).toEqual(briefs)
    expect(() => parseCreativeDirectorSummaryContext({ evidence, changes: [], briefs: [{ ...briefs[0], fingerprint: 'foreign' }] })).toThrow('reference')
    expect(() => parseCreativeDirectorSummaryContext({ evidence, changes: [], briefs: [briefs[0], briefs[0]] })).toThrow('Duplicate')
  })

  it('projects real stored core outcomes with their snapshot and missing-report state, without inventing traces', async () => {
    const { computeAgentProjectRevision } = await import('../src')
    const report = await runCreativePlaytest({ project: { id: 'station', revision: await computeAgentProjectRevision(project.files), files: project.files }, scenarios: [{ id: 'stay', choices: [0], expectedEnding: 'stay#ending-stay' }, { id: 'leave', choices: [1], expectedEnding: 'leave#ending-leave' }] })
    report.voiceCoverage = { verification: 'author-host-byte-check', snapshotRevision: report.snapshotRevision, locale: 'zh-CN', complete: true, rows: [], rowsOmitted: 0 }
    const h = requested()
    const summary = { id: 'report1', projectId: 'station', baselineRevision: report.baselineRevision, snapshotRevision: report.snapshotRevision, scope: report.scope, artifacts: report.artifacts, runnerVersion: report.runnerVersion, verification: 'author-host' as const, passed: 2, failed: 0, blocked: 0, cancelled: 0, createdAt: 1 }
    const run: CreativeTeamRun = { ...h.run(), playtests: [summary] }
    const evidence = prepareCreativeDirectorSummaryEvidence(run, 'delivery', facts, { report1: report }, facts.revision)
    expect(evidence.reports[0]!.executions.map(item => item.status)).toEqual(['passed', 'passed'])
    expect(evidence.reports[0]!.voiceCoverage).toEqual(report.voiceCoverage)
    expect(evidence.reports[0]!.executions.every(item => !('trace' in item))).toBe(true)
    expect(evidence.state.playtests[0]!.snapshotRevision).toBe(report.snapshotRevision)
    expect(prepareCreativeDirectorSummaryEvidence(run, 'delivery', facts, {}, facts.revision).reports[0]!.available).toBe(false)
    expect(() => prepareCreativeDirectorSummaryEvidence({ ...run, playtests: [{ ...summary, passed: 1 }] }, 'delivery', facts, { report1: report }, facts.revision)).toThrow('REPORT_CONFLICT')

    // A real report arriving during a paid summary invalidates the old advice, but never erases its fee.
    const output = parseCreativePartnerOutput('delivery-summary', h.model, h.context)
    h.act({ type: 'reserve-next', taskId: 'delivery', inputFingerprint: 'summary-before-report', quotedMicroPoints: 7, toolCalls: 1 })
    h.run().playtests = [summary]
    const artifact: CreativeArtifact = { id: 'old-summary', taskId: 'delivery', runId: 'run1', projectId: 'station', partner: 'director', kind: 'delivery-summary', summary: output.summary, output, source: { projectId: 'station', revision: facts.revision, files: facts.files, upstream: [{ artifactId: 'chapter1', fingerprint: 'chapter-v1' }] }, fingerprint: 'old-fp', status: 'candidate', changes: [], reviewCapabilities: [] }
    h.act({ type: 'settle-task', taskId: 'delivery', dispatchKey: h.run().tasks[1]!.dispatchKey!, status: 'completed', usage: usage(7), artifacts: [artifact] })
    expect(h.run().artifacts[1]!.status).toBe('stale')
    expect(h.run().chargedMicroPoints).toBe(17)
    h.act({ type: 'request-rework', taskId: 'delivery', decisionId: 'new-report-summary', reason: '依据刚保存的真实试玩结果重新汇总' })
    h.act({ type: 'refresh-facts', files: facts.files })
    expect(nextCreativeTeamTask(h.run())).toBe('delivery')
    const retry = prepareCreativeDirectorSummaryEvidence(h.run(), 'delivery', facts, { report1: report }, facts.revision)
    expect(retry.attempt).toBe(2)
    expect(retry.state.chargedBeforeSummary).toBe(17)
    expect(retry.reports[0]!.executions).toHaveLength(2)
    h.act({ type: 'reserve-next', taskId: 'delivery', inputFingerprint: 'summary-after-report', quotedMicroPoints: 7, toolCalls: 1 })
    h.act({ type: 'settle-task', taskId: 'delivery', dispatchKey: h.run().tasks[1]!.dispatchKey!, status: 'failed', usage: usage(7), artifacts: [], error: { code: 'provider_failed', message: '真实的第二次调用失败' } })
    expect(h.run().chargedMicroPoints).toBe(24)
    expect(canRequestCreativeDirectorSummary(h.run(), 'delivery')).toBe(false)
  })
})
