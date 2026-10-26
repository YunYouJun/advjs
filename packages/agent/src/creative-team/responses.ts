import type { AgentUsageSummary } from '../core/contracts'
import type { CreativeArtifact, CreativeTeamAttempt, CreativeTeamRun, CreativeTeamTaskState } from './contracts'
import type { CreativeTeamRunSummary } from './wire'
import { AGENT_CAPABILITY_IDS } from '../core/contracts'
import { CREATIVE_ARTIFACT_KINDS, CREATIVE_PARTNER_IDS } from './contracts'
import { parseCreativePartnerOutputSnapshot } from './outputs'
import { assertCreativeArtifactBoundary, assertCreativeSourcePath, parseCreativeTeamPlan, requiredCreativeReviewCapabilities } from './validation'

const RUN_STATUSES = ['awaiting_plan_review', 'ready', 'running', 'awaiting_review', 'blocked', 'cancel_requested', 'cancelled', 'completed', 'reconcile_required'] as const
const TASK_STATUSES = ['pending', 'running', 'awaiting_review', 'completed', 'stale', 'blocked', 'failed', 'cancelled', 'reconcile_required'] as const
const REVIEW_CAPABILITIES = ['create-source', 'modify-source', 'delete-source', 'catalog-media', 'voice-take', 'candidate-preview'] as const
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new TypeError('Invalid creative team response object')
  return value as Record<string, unknown>
}
function text(value: unknown, maximum = 4000, empty = false): string {
  if (typeof value !== 'string' || (!empty && !value.trim()) || value.length > maximum)
    throw new TypeError('Invalid creative team response text')
  return value
}
function integer(value: unknown): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0)
    throw new TypeError('Invalid creative team response number')
  return Number(value)
}
function array(value: unknown, maximum: number): unknown[] {
  if (!Array.isArray(value) || value.length > maximum)
    throw new TypeError('Invalid creative team response collection')
  return value
}
function member<const T extends string>(value: unknown, allowed: readonly T[]): T {
  if (typeof value !== 'string' || !allowed.includes(value as T))
    throw new TypeError('Unknown creative team response value')
  return value as T
}
function identity(value: unknown): string {
  return text(value, 200)
}
function ids(value: unknown): string[] {
  return array(value, 256).map(identity)
}
function usage(value: unknown): AgentUsageSummary {
  const source = object(value)
  return {
    inputTokens: integer(source.inputTokens),
    outputTokens: integer(source.outputTokens),
    totalTokens: integer(source.totalTokens),
    providerCostMicroCny: integer(source.providerCostMicroCny),
    chargedMicroPoints: integer(source.chargedMicroPoints),
    ...(source.cachedInputTokens === undefined ? {} : { cachedInputTokens: integer(source.cachedInputTokens) }),
    ...(source.reasoningTokens === undefined ? {} : { reasoningTokens: integer(source.reasoningTokens) }),
  }
}
function error(value: unknown): { code: string, message: string } {
  const source = object(value)
  return { code: text(source.code, 128), message: text(source.message) }
}
function attempt(value: unknown): CreativeTeamAttempt {
  const source = object(value)
  return {
    attempt: integer(source.attempt),
    dispatchKey: identity(source.dispatchKey),
    ...(source.runtimeTaskId === undefined ? {} : { runtimeTaskId: identity(source.runtimeTaskId) }),
    ...(source.inputFingerprint === undefined ? {} : { inputFingerprint: identity(source.inputFingerprint) }),
    status: member(source.status, ['completed', 'failed', 'cancelled']),
    usage: usage(source.usage),
    artifactIds: ids(source.artifactIds),
    ...(source.error === undefined ? {} : { error: error(source.error) }),
  }
}
function taskState(value: unknown): CreativeTeamTaskState {
  const source = object(value)
  if (source.dispatchStarted !== undefined && typeof source.dispatchStarted !== 'boolean')
    throw new TypeError('Invalid dispatch marker')
  return {
    taskId: identity(source.taskId),
    status: member(source.status, TASK_STATUSES),
    attempt: integer(source.attempt),
    artifactIds: ids(source.artifactIds),
    ...(source.inputFingerprint === undefined ? {} : { inputFingerprint: identity(source.inputFingerprint) }),
    ...(source.runtimeTaskId === undefined ? {} : { runtimeTaskId: identity(source.runtimeTaskId) }),
    ...(source.dispatchKey === undefined ? {} : { dispatchKey: identity(source.dispatchKey) }),
    ...(source.dispatchStarted === undefined ? {} : { dispatchStarted: source.dispatchStarted }),
    ...(source.reservedMicroPoints === undefined ? {} : { reservedMicroPoints: integer(source.reservedMicroPoints) }),
    ...(source.usage === undefined ? {} : { usage: usage(source.usage) }),
    ...(source.history === undefined ? {} : { history: array(source.history, 3).map(attempt) }),
    ...(source.error === undefined ? {} : { error: error(source.error) }),
  }
}
function artifact(value: unknown, run: Pick<CreativeTeamRun, 'id' | 'plan'>): CreativeArtifact {
  const source = object(value)
  const provenance = object(source.source)
  const files = Object.fromEntries(Object.entries(object(provenance.files)).map(([path, content]) => {
    assertCreativeSourcePath(path)
    return [path, text(content, 512000, true)]
  }))
  if (Object.keys(files).length > 256)
    throw new TypeError('Invalid creative source collection')
  const changes = array(source.changes, 256).map((item) => {
    const change = object(item)
    const path = text(change.path, 200)
    assertCreativeSourcePath(path)
    return { path, before: change.before === null ? null : text(change.before, 512000, true), after: change.after === null ? null : text(change.after, 512000, true) }
  })
  const legacy = source.legacyResult === undefined ? undefined : object(source.legacyResult)
  const result: CreativeArtifact = {
    id: identity(source.id),
    runId: identity(source.runId),
    taskId: identity(source.taskId),
    partner: member(source.partner, CREATIVE_PARTNER_IDS),
    projectId: identity(source.projectId),
    kind: member(source.kind, CREATIVE_ARTIFACT_KINDS),
    fingerprint: identity(source.fingerprint),
    summary: text(source.summary),
    ...(source.editedFrom === undefined ? {} : { editedFrom: { artifactId: identity(object(source.editedFrom).artifactId), fingerprint: identity(object(source.editedFrom).fingerprint) } }),
    source: {
      projectId: identity(provenance.projectId),
      revision: identity(provenance.revision),
      files,
      upstream: array(provenance.upstream, 256).map(item => ({ artifactId: identity(object(item).artifactId), fingerprint: identity(object(item).fingerprint) })),
    },
    changes,
    reviewCapabilities: array(source.reviewCapabilities, 6).map(item => member(item, REVIEW_CAPABILITIES)),
    status: member(source.status, ['candidate', 'selected', 'adopted', 'rejected', 'stale']),
    ...(legacy ? { legacyResult: { capability: member(legacy.capability, AGENT_CAPABILITY_IDS), streamText: text(legacy.streamText, 512000, true) } } : {}),
  }
  if (source.output !== undefined) {
    result.output = parseCreativePartnerOutputSnapshot(source.output, {
      projectId: result.projectId,
      projectRevision: result.source.revision,
      files,
      characterIds: [],
      limits: run.plan.limits,
    })
  }
  requiredCreativeReviewCapabilities(result).forEach((capability) => {
    if (!result.reviewCapabilities.includes(capability))
      throw new TypeError('Creative response omits required review authority')
  })
  return result
}

/** Decode only within the current account/project boundary, including retained stale candidates. */
export function parseCreativeTeamRun(value: unknown, boundary: { accountId: string, projectId: string, runId?: string }): CreativeTeamRun {
  const source = object(value)
  const plan = object(source.plan)
  if (source.accountId !== boundary.accountId || plan.projectId !== boundary.projectId || (boundary.runId && source.id !== boundary.runId))
    throw new TypeError('Creative response account/project boundary mismatch')
  const run: CreativeTeamRun = {
    id: identity(source.id),
    accountId: boundary.accountId,
    plan: parseCreativeTeamPlan(plan, { projectId: boundary.projectId, projectRevision: identity(plan.projectRevision) }),
    status: member(source.status, RUN_STATUSES),
    revision: integer(source.revision),
    tasks: array(source.tasks, 24).map(taskState),
    artifacts: [],
    decisions: array(source.decisions, 512).map((item) => {
      const decision = object(item)
      return {
        id: identity(decision.id),
        artifactIds: ids(decision.artifactIds),
        action: member(decision.action, ['approve-plan', 'select', 'reject', 'adopt', 'undo', 'stop', 'rework', 'edit']),
        reason: text(decision.reason),
        projectRevision: identity(decision.projectRevision),
        at: integer(decision.at),
        ...(decision.requestFingerprint === undefined ? {} : { requestFingerprint: identity(decision.requestFingerprint) }),
      }
    }),
    chargedMicroPoints: integer(source.chargedMicroPoints),
    reservedMicroPoints: integer(source.reservedMicroPoints),
    toolCalls: integer(source.toolCalls),
    createdAt: integer(source.createdAt),
    updatedAt: integer(source.updatedAt),
  }
  run.artifacts = array(source.artifacts, 256).map(item => artifact(item, run))
  if (new Set(run.tasks.map(task => task.taskId)).size !== run.tasks.length || run.tasks.length !== run.plan.tasks.length
    || run.tasks.some(task => !run.plan.tasks.some(definition => definition.id === task.taskId))
    || new Set(run.artifacts.map(item => item.id)).size !== run.artifacts.length) {
    throw new TypeError('Creative response contains duplicate or unknown identities')
  }
  for (const item of run.artifacts)
    assertCreativeArtifactBoundary(item, run, { allowStaleUpstream: true })
  for (const task of run.tasks) {
    if (task.artifactIds.some(id => !run.artifacts.some(item => item.id === id && item.taskId === task.taskId)))
      throw new TypeError('Creative task references an unavailable candidate')
  }
  return run
}

export function parseCreativeTeamRunSummary(value: unknown, projectId: string): CreativeTeamRunSummary {
  const source = object(value)
  if (source.projectId !== projectId)
    throw new TypeError('Creative history project boundary mismatch')
  return {
    id: identity(source.id),
    projectId,
    goal: text(source.goal),
    status: member(source.status, RUN_STATUSES),
    revision: integer(source.revision),
    chargedMicroPoints: integer(source.chargedMicroPoints),
    reservedMicroPoints: integer(source.reservedMicroPoints),
    updatedAt: integer(source.updatedAt),
  }
}
