import type { CreativeDeliveryRequest, CreativePlaytestReport } from '../src'
import { describe, expect, it } from 'vitest'
import { createCreativeTeamRun, parseCreativeDeliveryRequest, parseCreativeTeamRun, prepareCreativeDelivery, prepareCreativeMilestone, reduceCreativeTeamRun } from '../src'
import { creativeArtifact, creativePlan } from './helpers/creative-team'

function fixture() {
  const plan = creativePlan()
  plan.tasks = plan.tasks.slice(0, 1)
  const run = createCreativeTeamRun({ id: 'run1', accountId: 'author', plan, now: 0 })
  run.status = 'awaiting_review'
  run.tasks = [{ taskId: 'cast', status: 'completed', attempt: 1, artifactIds: ['people'] }]
  run.artifacts = [creativeArtifact()]
  run.chargedMicroPoints = 123
  const request: CreativeDeliveryRequest = { project: { id: 'station', revision: 'r1', files: { 'adv/world.md': 'saved world' } }, runRevision: run.revision, reason: '仅结束本次设计，人物初稿暂不写入', dispositions: [{ artifactId: 'people', fingerprint: 'people-v1', disposition: 'excluded', reason: '人物动机仍需后续打磨' }], acknowledgeUnverified: true }
  return { run, request }
}

describe('independent author delivery decision', () => {
  it('never finishes on selection, and retains explicit exclusions, settled costs and unverified limits on closure', () => {
    const { run, request } = fixture()
    expect(run.status).toBe('awaiting_review')
    const action = { type: 'finish' as const, request, decisionId: 'finish1', requestFingerprint: 'request-v1' }
    const completed = reduceCreativeTeamRun(run, action, 100)
    expect(completed.status).toBe('completed')
    expect(completed.artifacts).toEqual(run.artifacts)
    expect(completed.delivery).toMatchObject({ chargedMicroPoints: 123, dispositions: request.dispositions, playtestIds: [], verification: 'author-host' })
    expect(completed.delivery?.unverified).toContain('audio-playback')
    expect(parseCreativeTeamRun(completed, { accountId: 'author', projectId: 'station', runId: 'run1' })).toEqual(completed)
    expect(reduceCreativeTeamRun(completed, action, 101)).toBe(completed)
    expect(run.delivery).toBeUndefined()
  })
  it.each(['pending', 'running', 'awaiting_review', 'stale', 'failed', 'blocked', 'reconcile_required'] as const)('rejects %s tasks rather than declaring them finished', (status) => {
    const { run, request } = fixture()
    run.tasks = [{ ...run.tasks[0], status }]
    expect(() => prepareCreativeDelivery(run, request, 'finish1', 100)).toThrow('DELIVERY_PENDING')
  })
  it('rejects pending fees, two-store adoption and changed run/source revisions', () => {
    const { run, request } = fixture()
    expect(() => prepareCreativeDelivery({ ...run, reservedMicroPoints: 1 }, request, 'f', 0)).toThrow('PENDING')
    expect(() => prepareCreativeDelivery({ ...run, revision: 2 }, request, 'f', 0)).toThrow('CONFLICT')
    expect(() => prepareCreativeDelivery(run, { ...request, project: { ...request.project, files: { 'adv/world.md': 'changed' } } }, 'f', 0)).toThrow('CONFLICT')
    expect(() => prepareCreativeDelivery({ ...run, milestones: [{ id: 'm', status: 'prepared' } as never] }, request, 'f', 0)).toThrow('PENDING')
  })
  it('requires every selected artifact and refuses to pass unapplied edits off as references or adoptions', () => {
    const { run, request } = fixture()
    expect(() => prepareCreativeDelivery(run, { ...request, dispositions: [] }, 'f', 0)).toThrow('CONFLICT')
    for (const disposition of ['reference', 'adopted'] as const)
      expect(() => prepareCreativeDelivery(run, { ...request, dispositions: [{ ...request.dispositions[0], disposition }] }, 'f', 0)).toThrow('DISPOSITION_REQUIRED')
    expect(() => parseCreativeDeliveryRequest({ ...request, chargedMicroPoints: 0 })).toThrow()
    expect(() => parseCreativeDeliveryRequest({ ...request, acknowledgeUnverified: false })).toThrow()
    expect(() => parseCreativeDeliveryRequest({ ...request, dispositions: [...request.dispositions, ...request.dispositions] })).toThrow()
  })
  it('requires a confirmed non-undone milestone for an adopted output', () => {
    const { run, request } = fixture()
    run.artifacts = [{ ...run.artifacts[0], status: 'adopted', source: { ...run.artifacts[0].source, files: {} } }]
    request.dispositions = [{ ...request.dispositions[0], disposition: 'adopted' }]
    expect(() => prepareCreativeDelivery(run, request, 'f', 0)).toThrow('CONFLICT')
  })
  it('requires actual current saved-project execution when retaining a playtest plan', () => {
    const { run, request } = fixture()
    run.artifacts = [creativeArtifact({ changes: [], kind: 'playtest-plan', output: { kind: 'playtest-plan', summary: '路径计划', scenarios: [{ id: 'path1', choices: [], expectedEnding: 'intro#end' }], concerns: [] }, reviewCapabilities: [] })]
    request.dispositions = [{ ...request.dispositions[0], disposition: 'reference' }]
    expect(() => prepareCreativeDelivery(run, request, 'f', 0)).toThrow('PLAYTEST_REQUIRED')
    run.playtests = [{ id: 'report1', projectId: 'station', baselineRevision: 'r1', snapshotRevision: 'r1', scope: 'saved', artifacts: [], runnerVersion: 'creative-headless-v1', verification: 'author-host', passed: 1, failed: 0, blocked: 0, cancelled: 0, createdAt: 5 }]
    const report: CreativePlaytestReport = {
      schemaVersion: 1,
      producer: 'advjs-author-host',
      runnerVersion: 'creative-headless-v1',
      projectId: 'station',
      baselineRevision: 'r1',
      scope: 'saved',
      snapshotRevision: 'r1',
      artifacts: [],
      startedAt: 3,
      finishedAt: 4,
      limits: { maxCommandsPerScenario: 1, maxTotalCommands: 1, maxEvidenceBytes: 1000 },
      diagnostics: [],
      diagnosticsOmitted: 0,
      unverified: ['visual-rendering', 'audio-playback', 'host-activities', 'narrative-consistency', 'unspecified-paths'],
      executions: [{ status: 'passed', code: 'completed', reachedExpected: true, commands: 1, scenario: { id: 'path1', choices: [], expectedEnding: 'intro#end' }, trace: [{ sequence: 1, command: 'start', address: 'intro#end', status: 'ended', effects: [], variablesChanged: [], entered: ['intro#end'] }], terminalAddress: 'intro#end', actualEnding: 'intro#end' }],
    }
    expect(() => prepareCreativeDelivery(run, request, 'f', 10)).toThrow('PLAYTEST_REQUIRED')
    expect(prepareCreativeDelivery(run, request, 'f', 10, [report]).playtestIds).toEqual(['report1'])
    expect(() => prepareCreativeDelivery({ ...run, playtests: [{ ...run.playtests![0], scope: 'candidate' }] }, request, 'f', 0)).toThrow('PLAYTEST_REQUIRED')
    expect(() => prepareCreativeDelivery({ ...run, playtests: [{ ...run.playtests![0], failed: 1 }] }, request, 'f', 0, [report])).toThrow('PLAYTEST_REQUIRED')
    expect(() => prepareCreativeDelivery(run, request, 'f', 0, [{ ...report, executions: [{ ...report.executions[0], scenario: { id: 'unrelated', choices: [], expectedEnding: 'intro#end' } }] }])).toThrow('PLAYTEST_REQUIRED')
  })
  it('freezes subsequent mutations and rejects a forged receipt on read', () => {
    const { run, request } = fixture()
    const completed = reduceCreativeTeamRun(run, { type: 'finish', request, decisionId: 'f', requestFingerprint: 'request-v1' }, 10)
    for (const action of [{ type: 'refresh-facts' as const, files: {} }, { type: 'request-rework' as const, taskId: 'cast', reason: 'redo' }, { type: 'cancel' as const, decisionId: 'stop', reason: 'stop' }])
      expect(() => reduceCreativeTeamRun(completed, action, 20)).toThrow('RUN_FINISHED')
    expect(() => prepareCreativeMilestone(completed, { operation: 'adopt', project: request.project, artifacts: [{ artifactId: 'people', fingerprint: 'people-v1' }], reason: 'late adoption' })).toThrow('MILESTONE_CONFLICT')
    expect(() => parseCreativeTeamRun({ ...completed, delivery: { ...completed.delivery, chargedMicroPoints: 0 } }, { accountId: 'author', projectId: 'station' })).toThrow('provenance')
  })
})
