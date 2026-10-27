import type { CreativePlaytestReport, CreativeTeamRun } from '../src'
import { describe, expect, it } from 'vitest'
import { computeAgentProjectRevision, createCreativeTeamRun, creativePlaytestFindings, parseCreativeTeamPublicDecision, parseCreativeTeamRun, prepareCreativePlaytestRepair, reduceCreativeTeamRun, runCreativePlaytest } from '../src'
import frozen from './fixtures/creative-team/v2/project.json'
import { creativeArtifact, creativePlan } from './helpers/creative-team'

const path = 'adv/chapters/station.adv.md'
const scenarios = [{ id: 'stay', choices: [0], expectedEnding: 'stay#ending-stay' }]
async function fixture(candidate = false) {
  const files = structuredClone(frozen.files)
  const broken = '# 车站 {#arrival}\n\n- [悬空引用](missing#ending)'
  if (!candidate)
    files[path] = broken
  const project = { id: 'station', files, revision: await computeAgentProjectRevision(files) }
  const plan = creativePlan()
  plan.projectRevision = project.revision
  plan.tasks = [{ ...plan.tasks[1], dependsOn: [] }]
  const run = createCreativeTeamRun({ id: 'run1', accountId: 'author1', plan, now: 0 })
  run.status = 'awaiting_review'
  run.tasks = [{ taskId: 'script', status: 'completed', attempt: 1, artifactIds: ['script1'] }]
  run.artifacts = [creativeArtifact({ id: 'script1', taskId: 'script', partner: 'writer', kind: 'chapter', reviewCapabilities: ['modify-source', 'candidate-preview'], source: { projectId: 'station', revision: project.revision, files: project.files, upstream: [] }, changes: [{ path, before: files[path], after: candidate ? broken : files[path] }] })]
  const report = await runCreativePlaytest({ project, scenarios, ...(candidate ? { candidate: { run, artifacts: [{ artifactId: 'script1', fingerprint: run.artifacts[0].fingerprint }] } } : {}) })
  run.playtests = [summary(report)]
  const reference = { reportId: 'report1', snapshotRevision: report.snapshotRevision, findingId: creativePlaytestFindings(report).find(item => item.code === 'ADV_RUNTIME_UNKNOWN_TARGET')!.id }
  return { run, project, report, reference, broken }
}
function summary(report: CreativePlaytestReport): NonNullable<CreativeTeamRun['playtests']>[number] {
  return { id: 'report1', projectId: report.projectId, baselineRevision: report.baselineRevision, snapshotRevision: report.snapshotRevision, artifacts: report.artifacts, scope: report.scope, runnerVersion: report.runnerVersion, verification: 'author-host', passed: 0, failed: 0, blocked: 1, cancelled: 0, createdAt: 0 }
}

describe('report-backed owner repair handoff', () => {
  it('extracts a real compiler finding and restores owner-written files omitted by original sourcePaths', async () => {
    const f = await fixture()
    const handoff = prepareCreativePlaytestRepair({ ...f, taskId: 'script' })
    expect(handoff.repair?.finding).toMatchObject({ code: 'ADV_RUNTIME_UNKNOWN_TARGET', source: { path, line: 3 } })
    expect(handoff.facts.files[path]).toBe(f.broken)
    expect(handoff.repair?.files).toEqual({})
    expect(f.run.tasks[0].status).toBe('completed')
  })

  it('freezes the exact tested candidate before rework makes that version stale and keeps saved facts separate', async () => {
    const f = await fixture(true)
    const handoff = prepareCreativePlaytestRepair({ ...f, taskId: 'script' })
    expect(handoff.facts.files[path]).toBe(frozen.files[path])
    expect(handoff.repair?.files[path]).toBe(f.broken)
    const action = parseCreativeTeamPublicDecision({ type: 'request-rework', taskId: 'script', reason: '修复此悬空引用', playtestRepair: f.reference }, 'repair1')
    const next = reduceCreativeTeamRun(f.run, action, 1)
    expect(next.tasks[0]).toMatchObject({ status: 'pending', playtestRepair: { decisionId: 'repair1', reference: f.reference } })
    expect(next.artifacts[0].status).toBe('stale')
    expect(next.decisions[0].playtestRepair).toEqual({ taskId: 'script', reference: f.reference })
    expect(parseCreativeTeamRun(next, { accountId: 'author1', projectId: 'station' }).tasks[0].playtestRepair).toEqual(next.tasks[0].playtestRepair)
    expect(next.chargedMicroPoints).toBe(0)
    expect(next.reservedMicroPoints).toBe(0)
    expect(f.project.files[path]).toBe(frozen.files[path])
  })

  it('rejects missing reports, findings, old sources and candidate versions without granting model authority', async () => {
    const f = await fixture(true)
    const prepare = (changes: Partial<Parameters<typeof prepareCreativePlaytestRepair>[0]>) => prepareCreativePlaytestRepair({ ...f, taskId: 'script', ...changes })
    expect(() => prepare({ reference: { ...f.reference, reportId: 'another-report' } })).toThrow('CREATIVE_REPAIR_SOURCE_CONFLICT')
    expect(() => prepare({ reference: { ...f.reference, findingId: 'diagnostic:127' } })).toThrow('CREATIVE_REPAIR_SOURCE_CONFLICT')
    expect(() => prepare({ project: { ...f.project, revision: 'changed' } })).toThrow('CREATIVE_REPAIR_SOURCE_CONFLICT')
    expect(() => prepare({ run: { ...f.run, artifacts: f.run.artifacts.map(item => ({ ...item, status: 'stale' })) } })).toThrow('CREATIVE_REBASE_REQUIRED')
    expect(() => parseCreativeTeamPublicDecision({ type: 'request-rework', taskId: 'script', reason: 'repair', playtestRepair: { ...f.reference, chargedMicroPoints: 0 } }, 'key')).toThrow()
    expect(() => parseCreativeTeamPublicDecision({ type: 'select', taskId: 'script', artifactIds: ['script1'], reason: 'select', playtestRepair: f.reference }, 'key')).toThrow()
  })

  it('does not offer passed paths, cancelled execution or author input and capacity failures as source repair evidence', async () => {
    const project = { id: 'station', files: frozen.files, revision: await computeAgentProjectRevision(frozen.files) }
    const passed = await runCreativePlaytest({ project, scenarios })
    expect(creativePlaytestFindings(passed).filter(item => item.kind === 'execution')).toHaveLength(0)
    const input = await runCreativePlaytest({ project, scenarios: [{ ...scenarios[0], choices: [] }] })
    expect(input.executions[0].code).toBe('choice_required')
    expect(creativePlaytestFindings(input).filter(item => item.kind === 'execution')).toHaveLength(0)
    const wrong = await runCreativePlaytest({ project, scenarios: [{ ...scenarios[0], choices: [1] }] })
    expect(creativePlaytestFindings(wrong)).toContainEqual(expect.objectContaining({ id: 'execution:0', code: 'ending_mismatch', scenario: { ...scenarios[0], choices: [1] } }))
  })
})
