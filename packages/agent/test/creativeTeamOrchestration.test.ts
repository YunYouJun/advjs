import type { AgentUsageSummary, CreativeTeamAction, CreativeTeamRun } from '../src'
import { describe, expect, it } from 'vitest'
import { createCreativeTeamRun, nextCreativeTeamTask, reduceCreativeTeamRun } from '../src'
import { creativeArtifact, creativePlan } from './helpers/creative-team'

const usage: AgentUsageSummary = { inputTokens: 50, outputTokens: 50, totalTokens: 100, providerCostMicroCny: 30, chargedMicroPoints: 40 }
function createRun(): CreativeTeamRun {
  return createCreativeTeamRun({ id: 'run1', accountId: 'author1', plan: creativePlan(), now: 0 })
}
function act(run: CreativeTeamRun, action: CreativeTeamAction): CreativeTeamRun {
  return reduceCreativeTeamRun(run, action, run.updatedAt + 1)
}
function running(): CreativeTeamRun {
  return act(act(createRun(), { type: 'approve-plan', decisionId: 'approval' }), { type: 'reserve-next', taskId: 'cast', inputFingerprint: 'input1', quotedMicroPoints: 100, toolCalls: 1 })
}
function completedCast(): CreativeTeamRun {
  return act(running(), { type: 'settle-task', taskId: 'cast', dispatchKey: 'run1:cast:1', status: 'completed', usage, artifacts: [creativeArtifact({ status: 'candidate' })] })
}

describe('creative team sequential orchestration', () => {
  it('expands an author-reviewed director plan without losing its cost or original goal', () => {
    const plan = creativePlan()
    const bootstrap = { ...plan, tasks: [{ id: 'director', partner: 'director' as const, capability: 'plan-production' as const, dependsOn: [], sourcePaths: ['adv/world.md'], instruction: '制定有限制作计划', expectedOutput: '待作者审阅的任务图' }] }
    let run = createCreativeTeamRun({ id: 'run1', accountId: 'author1', plan: bootstrap, now: 0 })
    run = act(run, { type: 'approve-plan', decisionId: 'approve-budget' })
    run = act(run, { type: 'reserve-next', taskId: 'director', inputFingerprint: 'director-input', quotedMicroPoints: 100, toolCalls: 1 })
    const artifact = creativeArtifact({ id: 'production-plan', taskId: 'director', partner: 'director', kind: 'production-brief', status: 'candidate', changes: [], reviewCapabilities: [], output: { kind: 'production-plan', summary: '雨夜车站制作计划', plan } })
    run = act(run, { type: 'settle-task', taskId: 'director', dispatchKey: 'run1:director:1', status: 'completed', usage, artifacts: [artifact] })
    expect(nextCreativeTeamTask(run)).toBeUndefined()
    const expanded = act(run, { type: 'accept-production-plan', artifactId: 'production-plan', decisionId: 'accept-plan' })
    expect(expanded.plan.tasks).toHaveLength(5)
    expect(expanded.plan.goal).toBe(bootstrap.goal)
    expect(expanded.chargedMicroPoints).toBe(40)
    expect(nextCreativeTeamTask(expanded)).toBe('cast')
    expect(act(expanded, { type: 'accept-production-plan', artifactId: 'production-plan', decisionId: 'accept-plan' })).toBe(expanded)
  })

  it('does not dispatch before approval or before the dependency is selected', () => {
    expect(nextCreativeTeamTask(createRun())).toBeUndefined()
    const run = completedCast()
    expect(run.status).toBe('awaiting_review')
    expect(nextCreativeTeamTask(run)).toBeUndefined()
    const selected = act(run, { type: 'select', taskId: 'cast', artifactIds: ['people'], decisionId: 'cast-select', reason: '采用两位主要人物' })
    expect(nextCreativeTeamTask(selected)).toBe('script')
    expect(selected.artifacts[0].status).toBe('selected')
    expect(run.artifacts[0].status).toBe('candidate')
  })

  it('persists a stable dispatch key before side effects and recovers with the same identity', () => {
    const run = JSON.parse(JSON.stringify(running())) as CreativeTeamRun
    expect(run.tasks[0].dispatchKey).toBe('run1:cast:1')
    expect(run.reservedMicroPoints).toBe(100)
    expect(() => act(run, { type: 'reserve-next', taskId: 'cast', inputFingerprint: 'another', quotedMicroPoints: 100, toolCalls: 1 })).toThrow(/single active/)
    const attached = act(run, { type: 'attach-runtime-task', taskId: 'cast', dispatchKey: 'run1:cast:1', runtimeTaskId: 'runtime1' })
    expect(() => act(attached, { type: 'attach-runtime-task', taskId: 'cast', dispatchKey: 'run1:cast:1', runtimeTaskId: 'runtime2' })).toThrow(/another task/)
    expect(nextCreativeTeamTask(attached)).toBeUndefined()
  })

  it('settles once, without charging the crew reservation again', () => {
    const run = completedCast()
    const repeated = act(run, { type: 'settle-task', taskId: 'cast', dispatchKey: 'run1:cast:1', status: 'completed', usage, artifacts: [creativeArtifact({ status: 'candidate' })] })
    expect(repeated).toBe(run)
    expect(run.chargedMicroPoints).toBe(40)
    expect(run.reservedMicroPoints).toBe(0)
    expect(run.artifacts).toHaveLength(1)
  })

  it('blocks insufficient budget before dispatch', () => {
    let run = createRun()
    run.plan.limits.maxMicroPoints = 50
    run = act(act(run, { type: 'approve-plan', decisionId: 'approval' }), { type: 'reserve-next', taskId: 'cast', inputFingerprint: 'input1', quotedMicroPoints: 100, toolCalls: 1 })
    expect(run.status).toBe('blocked')
    expect(run.tasks[0].error?.code).toBe('budget_exhausted')
    expect(run.reservedMicroPoints).toBe(0)
    expect(run.tasks[0].dispatchKey).toBeUndefined()
  })

  it('holds unknown billing outcomes for reconciliation and refuses automatic paid retry', () => {
    const unknown = act(running(), { type: 'settle-task', taskId: 'cast', dispatchKey: 'run1:cast:1', status: 'reconcile_required', artifacts: [] })
    expect(unknown.status).toBe('reconcile_required')
    expect(unknown.reservedMicroPoints).toBe(100)
    expect(nextCreativeTeamTask(unknown)).toBeUndefined()
    expect(() => act(unknown, { type: 'request-rework', taskId: 'cast', reason: 'retry' })).toThrow(/intervention/)
    const reconciled = act(unknown, { type: 'settle-task', taskId: 'cast', dispatchKey: 'run1:cast:1', status: 'completed', usage, artifacts: [creativeArtifact({ status: 'candidate' })] })
    expect(reconciled.status).toBe('awaiting_review')
    expect(reconciled.chargedMicroPoints).toBe(40)
  })

  it('keeps in-flight cancellation honest and retains completed candidates', () => {
    const stopping = act(running(), { type: 'cancel', decisionId: 'stop', reason: 'Stop the production' })
    expect(stopping.status).toBe('cancel_requested')
    expect(stopping.tasks[0].status).toBe('running')
    expect(stopping.tasks.slice(1).every(task => task.status === 'cancelled')).toBe(true)
    const done = act(stopping, { type: 'settle-task', taskId: 'cast', dispatchKey: 'run1:cast:1', status: 'completed', usage, artifacts: [creativeArtifact({ status: 'candidate' })] })
    expect(done.status).toBe('cancelled')
    expect(done.artifacts).toHaveLength(1)
    expect(done.chargedMicroPoints).toBe(40)
    expect(nextCreativeTeamTask(done)).toBeUndefined()
  })

  it('limits rework and rejects a missing output or a settlement larger than the quote', () => {
    expect(() => act(running(), { type: 'settle-task', taskId: 'cast', dispatchKey: 'run1:cast:1', status: 'completed', usage, artifacts: [] })).toThrow(/actual output/)
    expect(() => act(running(), { type: 'settle-task', taskId: 'cast', dispatchKey: 'run1:cast:1', status: 'failed', usage: { ...usage, chargedMicroPoints: 101 }, artifacts: [] })).toThrow(/quote/)
    let run = completedCast()
    for (let attempt = 2; attempt <= 3; attempt++) {
      run = act(run, { type: 'request-rework', taskId: 'cast', reason: 'Clarify the motive' })
      run = act(run, { type: 'reserve-next', taskId: 'cast', inputFingerprint: `input${attempt}`, quotedMicroPoints: 100, toolCalls: 1 })
      run = act(run, { type: 'settle-task', taskId: 'cast', dispatchKey: `run1:cast:${attempt}`, status: 'completed', usage, artifacts: [creativeArtifact({ id: `people${attempt}`, status: 'candidate' })] })
    }
    expect(() => act(run, { type: 'request-rework', taskId: 'cast', reason: 'Again' })).toThrow(/intervention/)
    expect(run.toolCalls).toBe(3)
    expect(run.chargedMicroPoints).toBe(120)
  })

  it('accounts for a paid child whose selected upstream became stale while it ran', () => {
    let run = act(completedCast(), { type: 'select', taskId: 'cast', artifactIds: ['people'], decisionId: 'select-cast', reason: 'Use this cast' })
    run = act(run, { type: 'reserve-next', taskId: 'script', inputFingerprint: 'writer-input', quotedMicroPoints: 100, toolCalls: 1 })
    run = act(run, { type: 'refresh-facts', files: { 'adv/world.md': 'author changed the world' } })
    const output = creativeArtifact({ id: 'script-output', taskId: 'script', partner: 'writer', kind: 'chapter', changes: [], reviewCapabilities: ['candidate-preview'], status: 'candidate', source: { projectId: 'station', revision: 'r1', files: {}, upstream: [{ artifactId: 'people', fingerprint: 'people-v1' }] } })
    run = act(run, { type: 'settle-task', taskId: 'script', dispatchKey: 'run1:script:1', status: 'completed', usage, artifacts: [output] })
    expect(run.chargedMicroPoints).toBe(80)
    expect(run.reservedMicroPoints).toBe(0)
    expect(run.artifacts.find(artifact => artifact.id === 'script-output')?.status).toBe('stale')
    expect(run.tasks.find(task => task.taskId === 'script')?.status).toBe('stale')
    expect(run.status).toBe('blocked')
  })
})
