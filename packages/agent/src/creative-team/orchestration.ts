import type { AgentUsageSummary } from '../core/contracts'
import type { CreativeArtifact, CreativeMilestoneIntent, CreativeTeamPlan, CreativeTeamRun } from './contracts'
import type { CreativeDeliveryRequest } from './delivery'
import type { CreativePlaytestReport } from './playtest-contracts'
import type { CreativePlaytestRepairReference } from './playtest-repair'
import { invalidateCreativeArtifacts } from './candidates'
import { prepareCreativeDelivery } from './delivery'
import { creativeMergeInvalidations } from './merges'
import { assertCreativeArtifactBoundary, parseCreativeTeamPlan } from './validation'

/** All mutations are serialized by Runtime's account/project-scoped transaction. */
export type CreativeTeamAction
  = | { type: 'approve-plan', decisionId: string }
    | { type: 'accept-production-plan', artifactId: string, decisionId: string }
    | { type: 'reserve-next', taskId: string, inputFingerprint: string, quotedMicroPoints: number, toolCalls: number }
    | { type: 'begin-dispatch', taskId: string, dispatchKey: string }
    | { type: 'block-task', taskId: string, code: string, message: string }
    | { type: 'attach-runtime-task', taskId: string, dispatchKey: string, runtimeTaskId: string }
    | { type: 'settle-task', taskId: string, dispatchKey: string, status: 'completed' | 'failed' | 'cancelled' | 'reconcile_required', usage?: AgentUsageSummary, artifacts: readonly CreativeArtifact[], error?: { code: string, message: string } }
    | { type: 'select', taskId: string, artifactIds: readonly string[], decisionId: string, reason: string }
    | { type: 'request-rework', taskId: string, reason: string, decisionId?: string, playtestRepair?: CreativePlaytestRepairReference }
    | { type: 'edit-candidate', artifact: CreativeArtifact, decisionId: string, reason: string, requestFingerprint: string }
    | { type: 'register-media', artifact: CreativeArtifact, decisionId: string, reason: string, requestFingerprint: string }
    | { type: 'prepare-milestone', intent: CreativeMilestoneIntent }
    | { type: 'resolve-milestone', milestoneId: string, status: 'confirmed' | 'abandoned', files: Readonly<Record<string, string>> }
    | { type: 'finish', request: CreativeDeliveryRequest, reports?: readonly CreativePlaytestReport[], decisionId: string, requestFingerprint: string }
    | { type: 'refresh-facts', files: Readonly<Record<string, string>> }
    | { type: 'cancel', decisionId: string, reason: string }

function safeInteger(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new TypeError('Invalid budget or usage value')
}

/** Create an unapproved finite run; creating it has no billing side effects. */
export function createCreativeTeamRun(input: { id: string, accountId: string, plan: CreativeTeamPlan, now: number }): CreativeTeamRun {
  const plan = parseCreativeTeamPlan(input.plan, input.plan)
  if (!input.id || !input.accountId)
    throw new TypeError('Run and account identity are required')
  return {
    id: input.id,
    accountId: input.accountId,
    plan,
    status: 'awaiting_plan_review',
    revision: 1,
    tasks: plan.tasks.map(task => ({ taskId: task.id, status: 'pending', attempt: 0, artifactIds: [] })),
    artifacts: [],
    decisions: [],
    chargedMicroPoints: 0,
    reservedMicroPoints: 0,
    toolCalls: 0,
    createdAt: input.now,
    updatedAt: input.now,
  }
}

/** Ready tasks depend on author-selected outputs. The first release dispatches one at a time. */
export function nextCreativeTeamTask(run: CreativeTeamRun): string | undefined {
  if (run.milestones?.some(item => item.status === 'prepared') || !['ready', 'awaiting_review', 'blocked'].includes(run.status) || run.tasks.some(task => task.status === 'running' || task.status === 'reconcile_required'))
    return undefined
  return run.plan.tasks.find(task => run.tasks.find(state => state.taskId === task.id)?.status === 'pending'
    && task.dependsOn.every(id => run.tasks.find(state => state.taskId === id)?.status === 'completed'))?.id
}

function deriveStatus(run: CreativeTeamRun): CreativeTeamRun['status'] {
  if (run.status === 'completed')
    return 'completed'
  if (run.status === 'cancel_requested' || run.status === 'cancelled')
    return run.tasks.some(task => task.status === 'running' || task.status === 'reconcile_required') ? 'cancel_requested' : 'cancelled'
  if (run.tasks.some(task => task.status === 'reconcile_required'))
    return 'reconcile_required'
  if (run.tasks.some(task => task.status === 'running'))
    return 'running'
  if (run.tasks.some(task => ['blocked', 'failed', 'stale'].includes(task.status)))
    return 'blocked'
  if (run.tasks.some(task => task.status === 'awaiting_review') || run.tasks.every(task => task.status === 'completed'))
    return 'awaiting_review'
  return 'ready'
}

/** Deterministic reducer shared with trusted Runtime; not a client authorization mechanism. */
export function reduceCreativeTeamRun(source: CreativeTeamRun, action: CreativeTeamAction, now: number): CreativeTeamRun {
  const run = structuredClone(source)
  if (run.milestones?.some(item => item.status === 'prepared') && !['resolve-milestone', 'cancel'].includes(action.type))
    throw new Error('CREATIVE_MILESTONE_PENDING')
  if ('decisionId' in action && run.decisions.some(item => item.id === action.decisionId))
    return source
  if (run.status === 'completed')
    throw new Error('CREATIVE_RUN_FINISHED')
  const state = 'taskId' in action ? run.tasks.find(task => task.taskId === action.taskId) : undefined
  if ('taskId' in action && !state)
    throw new TypeError('Unknown task')
  const decision = (id: string, operation: 'approve-plan' | 'select' | 'stop' | 'rework' | 'edit' | 'register-media' | 'finish', artifactIds: readonly string[], reason: string, projectRevision = run.plan.projectRevision): void => {
    run.decisions = [...run.decisions, { id, action: operation, artifactIds, reason, projectRevision, at: now }]
  }

  switch (action.type) {
    case 'finish': {
      const receipt = prepareCreativeDelivery(run, action.request, action.decisionId, now, action.reports)
      run.delivery = receipt
      run.status = 'completed'
      decision(action.decisionId, 'finish', receipt.dispositions.map(item => item.artifactId), receipt.reason, receipt.projectRevision)
      run.decisions = run.decisions.map(item => item.id === action.decisionId ? { ...item, requestFingerprint: action.requestFingerprint } : item)
      break
    }
    case 'prepare-milestone':
      if (action.intent.status !== 'prepared' || run.milestones?.some(item => item.id === action.intent.id) || run.tasks.some(task => ['running', 'reconcile_required'].includes(task.status)))
        throw new Error('CREATIVE_MILESTONE_CONFLICT')
      run.milestones = [...(run.milestones ?? []), action.intent]
      break
    case 'resolve-milestone': {
      const intent = run.milestones?.find(item => item.id === action.milestoneId)
      if (!intent || intent.status !== 'prepared')
        throw new Error('CREATIVE_MILESTONE_CONFLICT')
      run.milestones = run.milestones!.map(item => item.id === intent.id ? { ...item, status: action.status, ...(action.status === 'confirmed' ? { confirmedAt: now } : {}) } : item)
      if (action.status === 'confirmed') {
        const adopted = new Set(intent.artifacts.map(item => item.artifactId))
        run.artifacts = run.artifacts.map(item => adopted.has(item.id) ? { ...item, status: intent.operation === 'adopt' ? 'adopted' : 'selected' } : item)
        run.decisions = [...run.decisions, { id: intent.id, action: intent.operation, artifactIds: [...adopted], reason: intent.reason, projectRevision: intent.afterRevision, at: now, requestFingerprint: intent.requestFingerprint }]
        const mergeStale = intent.operation === 'adopt' ? creativeMergeInvalidations(run, intent.artifacts, intent.merges) : new Set<string>()
        run.artifacts = run.artifacts.map(item => mergeStale.has(item.id) && item.status !== 'rejected' ? { ...item, status: 'stale' } : item)
        run.artifacts = invalidateCreativeArtifacts(run.artifacts, action.files, run)
        const stale = new Set(run.artifacts.filter(item => item.status === 'stale').map(item => item.id))
        for (const task of run.tasks) {
          if (task.artifactIds.some(id => stale.has(id)))
            task.status = 'stale'
        }
      }
      break
    }
    case 'approve-plan':
      if (run.status !== 'awaiting_plan_review')
        throw new TypeError('Plan is not awaiting approval')
      run.status = 'ready'
      decision(action.decisionId, 'approve-plan', [], 'Author approved the production plan')
      break
    case 'accept-production-plan': {
      const artifact = run.artifacts.find(artifact => artifact.id === action.artifactId)
      if (!artifact || artifact.status !== 'candidate' || artifact.output?.kind !== 'production-plan'
        || run.tasks.some(task => task.status === 'running' || task.status === 'reconcile_required')
        || ['cancel_requested', 'cancelled'].includes(run.status)) {
        throw new TypeError('No current director plan is available for approval')
      }
      const proposed = parseCreativeTeamPlan(artifact.output.plan, { projectId: run.plan.projectId, projectRevision: artifact.source.revision })
      if (proposed.goal !== run.plan.goal)
        throw new TypeError('Director cannot replace the original author goal')
      for (const key of ['maxTasks', 'maxToolCalls', 'maxReworkRounds', 'maxMicroPoints'] as const) {
        if (proposed.limits[key] > run.plan.limits[key])
          throw new TypeError('Director cannot increase author-approved limits')
      }
      if (run.chargedMicroPoints > proposed.limits.maxMicroPoints || run.toolCalls > proposed.limits.maxToolCalls)
        throw new TypeError('Revised plan limits exclude already consumed resources')
      const combined = parseCreativeTeamPlan({
        ...proposed,
        tasks: [...run.plan.tasks, ...proposed.tasks.map(task => ({ ...task, dependsOn: [...new Set([...task.dependsOn, artifact.taskId])] }))],
      }, { projectId: run.plan.projectId, projectRevision: artifact.source.revision })
      const owner = run.tasks.find(task => task.taskId === artifact.taskId)
      if (owner?.status !== 'awaiting_review')
        throw new TypeError('Director task is not awaiting review')
      owner.status = 'completed'
      run.plan = combined
      run.tasks = [...run.tasks, ...proposed.tasks.map(task => ({ taskId: task.id, status: 'pending' as const, attempt: 0, artifactIds: [] }))]
      run.artifacts = run.artifacts.map(item => item.taskId === artifact.taskId && item.status === 'candidate'
        ? { ...item, status: item.id === artifact.id ? 'selected' : 'rejected' }
        : item)
      decision(action.decisionId, 'approve-plan', [artifact.id], 'Author approved the director task graph')
      break
    }
    case 'reserve-next': {
      safeInteger(action.quotedMicroPoints)
      safeInteger(action.toolCalls)
      if (nextCreativeTeamTask(run) !== action.taskId)
        throw new TypeError('Task dependencies or single active task limit are not satisfied')
      if (run.toolCalls + action.toolCalls > run.plan.limits.maxToolCalls
        || run.chargedMicroPoints + run.reservedMicroPoints + action.quotedMicroPoints > run.plan.limits.maxMicroPoints) {
        state!.status = 'blocked'
        state!.error = { code: 'budget_exhausted', message: 'Production budget or tool limit is insufficient' }
        break
      }
      state!.status = 'running'
      state!.attempt += 1
      state!.dispatchKey = `${run.id}:${state!.taskId}:${state!.attempt}`
      state!.runtimeTaskId = undefined
      state!.dispatchStarted = false
      state!.inputFingerprint = action.inputFingerprint
      state!.reservedMicroPoints = action.quotedMicroPoints
      state!.error = undefined
      run.reservedMicroPoints += action.quotedMicroPoints
      run.toolCalls += action.toolCalls
      break
    }
    case 'begin-dispatch':
      if (state!.status !== 'running' || state!.dispatchKey !== action.dispatchKey || run.status === 'cancel_requested')
        throw new TypeError('Dispatch is no longer allowed')
      state!.dispatchStarted = true
      break
    case 'block-task':
      if (state!.status !== 'pending')
        throw new TypeError('Only an undispatched task can be blocked')
      state!.status = 'blocked'
      state!.error = { code: action.code, message: action.message }
      break
    case 'attach-runtime-task':
      if (state!.dispatchKey === action.dispatchKey && state!.runtimeTaskId === action.runtimeTaskId)
        return source
      if (state!.status !== 'running' || state!.dispatchKey !== action.dispatchKey)
        throw new TypeError('Dispatch generation mismatch')
      if (state!.runtimeTaskId && state!.runtimeTaskId !== action.runtimeTaskId)
        throw new TypeError('An idempotent dispatch returned another task')
      state!.runtimeTaskId = action.runtimeTaskId
      break
    case 'settle-task': {
      if (state!.dispatchKey !== action.dispatchKey)
        throw new TypeError('Settlement generation mismatch')
      if (!['running', 'reconcile_required'].includes(state!.status))
        return source
      if (action.status === 'reconcile_required') {
        state!.status = 'reconcile_required'
        state!.error = action.error ?? { code: 'reconcile_required', message: 'Unknown billing outcome; reconcile before retrying' }
        break
      }
      if (!action.usage)
        throw new TypeError('Confirmed settlement requires usage, including zero-cost failure')
      Object.values(action.usage).forEach(safeInteger)
      if (action.usage.chargedMicroPoints > (state!.reservedMicroPoints ?? 0))
        throw new TypeError('Settlement exceeds the trusted quote')
      if (action.status === 'completed' && !action.artifacts.length)
        throw new TypeError('A completed creative task requires an actual output')
      const ids = new Set(run.artifacts.map(item => item.id))
      for (const artifact of action.artifacts) {
        if (artifact.taskId !== state!.taskId || artifact.status !== 'candidate' || ids.has(artifact.id))
          throw new TypeError('Invalid or duplicate task output')
        assertCreativeArtifactBoundary(artifact, run, { allowStaleUpstream: true })
        ids.add(artifact.id)
      }
      state!.usage = action.usage
      state!.error = action.error
      state!.history = [...(state!.history ?? []), {
        attempt: state!.attempt,
        dispatchKey: action.dispatchKey,
        runtimeTaskId: state!.runtimeTaskId,
        inputFingerprint: state!.inputFingerprint,
        status: action.status,
        usage: action.usage,
        artifactIds: action.artifacts.map(artifact => artifact.id),
        ...(state!.playtestRepair ? { playtestRepair: state!.playtestRepair } : {}),
        ...(action.error ? { error: action.error } : {}),
      }]
      run.chargedMicroPoints += action.usage.chargedMicroPoints
      run.reservedMicroPoints -= state!.reservedMicroPoints ?? 0
      state!.reservedMicroPoints = 0
      state!.artifactIds = action.artifacts.map(item => item.id)
      const artifacts = structuredClone(action.artifacts).map(artifact => artifact.source.upstream.some(dependency => run.artifacts.some(upstream => upstream.id === dependency.artifactId && upstream.status === 'stale'))
        ? { ...artifact, status: 'stale' as const }
        : artifact)
      run.artifacts = [...run.artifacts, ...artifacts]
      state!.status = action.status === 'completed' ? artifacts.some(artifact => artifact.status === 'stale') ? 'stale' : 'awaiting_review' : action.status
      break
    }
    case 'select': {
      if (state!.status !== 'awaiting_review' || !action.artifactIds.length)
        throw new TypeError('Task has no reviewable output')
      if (action.artifactIds.some(id => !run.artifacts.some(artifact => artifact.id === id && artifact.taskId === state!.taskId && artifact.status === 'candidate')))
        throw new TypeError('Cannot select missing or stale output')
      run.artifacts = run.artifacts.map(artifact => artifact.taskId === state!.taskId && artifact.status === 'candidate'
        ? { ...artifact, status: action.artifactIds.includes(artifact.id) ? 'selected' : 'rejected' }
        : artifact)
      state!.status = 'completed'
      decision(action.decisionId, 'select', action.artifactIds, action.reason)
      break
    }
    case 'request-rework': {
      if (!['failed', 'blocked', 'stale', 'awaiting_review', 'completed'].includes(state!.status)
        || run.tasks.some(task => task.status === 'running' || task.status === 'reconcile_required')
        || ['cancel_requested', 'cancelled', 'reconcile_required'].includes(run.status)
        || state!.attempt >= 1 + run.plan.limits.maxReworkRounds) {
        throw new TypeError('Rework is unavailable; author intervention is required')
      }
      const obsolete = new Set(state!.artifactIds)
      run.artifacts = run.artifacts.map(artifact => obsolete.has(artifact.id) ? { ...artifact, status: 'stale' } : artifact)
      // Propagate changed output versions without comparing saved facts here.
      let changed = true
      while (changed) {
        changed = false
        run.artifacts = run.artifacts.map((artifact) => {
          if (!obsolete.has(artifact.id) && artifact.source.upstream.some(item => obsolete.has(item.artifactId))) {
            obsolete.add(artifact.id)
            changed = true
            return { ...artifact, status: 'stale' }
          }
          return artifact
        })
      }
      for (const task of run.tasks) {
        if (task.taskId !== state!.taskId && task.artifactIds.some(id => obsolete.has(id)))
          task.status = 'stale'
      }
      state!.status = 'pending'
      state!.error = { code: 'rework_requested', message: action.reason }
      if (action.playtestRepair && !action.decisionId)
        throw new TypeError('Repair evidence requires an author decision identity')
      state!.playtestRepair = action.playtestRepair ? { decisionId: action.decisionId!, reference: action.playtestRepair } : undefined
      if (action.decisionId)
        decision(action.decisionId, 'rework', state!.artifactIds, action.reason)
      if (action.playtestRepair)
        run.decisions = run.decisions.map(item => item.id === action.decisionId ? { ...item, playtestRepair: { taskId: state!.taskId, reference: action.playtestRepair! } } : item)
      break
    }
    case 'register-media': {
      const candidate = action.artifact
      const owner = run.tasks.find(item => item.taskId === candidate.taskId)
      if (candidate.kind !== 'media-adoption' || !candidate.media || candidate.status !== 'selected' || !owner || !['completed', 'awaiting_review'].includes(owner.status) || run.artifacts.some(item => item.id === candidate.id) || run.artifacts.length >= 256 || ['completed', 'cancelled', 'cancel_requested'].includes(run.status))
        throw new TypeError('Media candidate cannot be registered')
      assertCreativeArtifactBoundary(candidate, run)
      run.artifacts = [...run.artifacts, candidate]
      owner.artifactIds = [...owner.artifactIds, candidate.id]
      decision(action.decisionId, 'register-media', [candidate.id], action.reason, candidate.source.revision)
      run.decisions = run.decisions.map(item => item.id === action.decisionId ? { ...item, requestFingerprint: action.requestFingerprint } : item)
      break
    }
    case 'edit-candidate': {
      const edited = action.artifact
      const original = run.artifacts.find(item => item.id === edited.editedFrom?.artifactId && item.fingerprint === edited.editedFrom.fingerprint)
      const owner = run.tasks.find(task => task.taskId === original?.taskId)
      if (!original || !['candidate', 'selected'].includes(original.status) || !owner || !['awaiting_review', 'completed'].includes(owner.status)
        || edited.status !== 'candidate' || edited.taskId !== original.taskId || edited.kind !== original.kind
        || run.artifacts.some(item => item.id === edited.id) || run.artifacts.length >= 256) {
        throw new TypeError('Candidate is unavailable for author revision')
      }
      assertCreativeArtifactBoundary(edited, run)
      const obsolete = new Set([original.id])
      let changed = true
      while (changed) {
        changed = false
        for (const artifact of run.artifacts) {
          if (!obsolete.has(artifact.id) && artifact.source.upstream.some(reference => obsolete.has(reference.artifactId))) {
            obsolete.add(artifact.id)
            changed = true
          }
        }
      }
      run.artifacts = [...run.artifacts.map(artifact => obsolete.has(artifact.id) ? { ...artifact, status: 'stale' as const } : artifact), edited]
      for (const task of run.tasks) {
        if (task.taskId !== owner.taskId && !['running', 'reconcile_required'].includes(task.status) && task.artifactIds.some(id => obsolete.has(id)))
          task.status = 'stale'
      }
      owner.artifactIds = owner.artifactIds.map(id => id === original.id ? edited.id : id)
      owner.status = 'awaiting_review'
      decision(action.decisionId, 'edit', [edited.id], action.reason, edited.source.revision)
      run.decisions = run.decisions.map(item => item.id === action.decisionId ? { ...item, requestFingerprint: action.requestFingerprint } : item)
      break
    }
    case 'refresh-facts': {
      run.artifacts = invalidateCreativeArtifacts(run.artifacts, action.files, run)
      const stale = new Set(run.artifacts.filter(item => item.status === 'stale').map(item => item.id))
      for (const task of run.tasks) {
        if (!['running', 'reconcile_required'].includes(task.status) && task.artifactIds.some(id => stale.has(id)))
          task.status = 'stale'
      }
      break
    }
    case 'cancel':
      for (const task of run.tasks) {
        if (task.status === 'pending')
          task.status = 'cancelled'
      }
      run.status = 'cancel_requested'
      decision(action.decisionId, 'stop', [], action.reason)
      break
  }
  if (action.type !== 'approve-plan' && run.status !== 'awaiting_plan_review')
    run.status = deriveStatus(run)
  if (JSON.stringify(run) === JSON.stringify(source))
    return source
  run.revision += 1
  run.updatedAt = now
  return run
}
