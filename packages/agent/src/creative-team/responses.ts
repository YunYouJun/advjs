import type { AgentUsageSummary } from '../core/contracts'
import type { CreativeArtifact, CreativeTeamAttempt, CreativeTeamRun, CreativeTeamTaskState } from './contracts'
import type { CreativeTeamRunSummary } from './wire'
import { AGENT_CAPABILITY_IDS } from '../core/contracts'
import { CREATIVE_ARTIFACT_KINDS, CREATIVE_PARTNER_IDS } from './contracts'
import { parseCreativeDeliveryReceipt } from './delivery'
import { parseCreativeMediaEvidence } from './media'
import { parseCreativeMilestoneMerges } from './merges'
import { creativeMilestoneChanges } from './milestones'
import { parseCreativePartnerOutputSnapshot } from './outputs'
import { parseCreativePlaytestSummary } from './playtest-contracts'
import { parseCreativePlaytestRepairReference } from './playtest-repair'
import { assertCreativeArtifactBoundary, assertCreativeSourcePath, parseCreativeTeamPlan, requiredCreativeReviewCapabilities } from './validation'

const RUN_STATUSES = ['awaiting_plan_review', 'ready', 'running', 'awaiting_review', 'blocked', 'cancel_requested', 'cancelled', 'completed', 'reconcile_required'] as const
const TASK_STATUSES = ['pending', 'running', 'awaiting_review', 'completed', 'stale', 'blocked', 'failed', 'cancelled', 'reconcile_required'] as const
const REVIEW_CAPABILITIES = ['create-source', 'modify-source', 'delete-source', 'catalog-media', 'voice-take', 'voice-settings', 'candidate-preview'] as const
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
    ...(source.delivery === undefined ? {} : { delivery: parseCreativeDeliveryReceipt(source.delivery) }),
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
    ...(source.playtestRepair === undefined ? {} : { playtestRepair: { decisionId: identity(object(source.playtestRepair).decisionId), reference: parseCreativePlaytestRepairReference(object(source.playtestRepair).reference) } }),
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
    ...(source.playtestRepair === undefined ? {} : { playtestRepair: { decisionId: identity(object(source.playtestRepair).decisionId), reference: parseCreativePlaytestRepairReference(object(source.playtestRepair).reference) } }),
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
    ...(source.media === undefined ? {} : { media: parseCreativeMediaEvidence(source.media) }),
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
    if (result.output.kind === 'delivery-summary' && (result.partner !== 'director' || result.kind !== 'delivery-summary'
      || run.plan.tasks.find(task => task.id === result.taskId)?.capability !== 'summarize-production'
      || result.output.evidence.taskId !== result.taskId || result.output.evidence.projectRevision !== result.source.revision
      || result.output.evidence.state.playtests.some(item => item.projectId !== result.projectId) || result.changes.length)) {
      throw new TypeError('Director summary response boundary mismatch')
    }
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
        action: member(decision.action, ['approve-plan', 'select', 'reject', 'adopt', 'undo', 'stop', 'rework', 'edit', 'register-media', 'finish']),
        reason: text(decision.reason),
        projectRevision: identity(decision.projectRevision),
        at: integer(decision.at),
        ...(decision.requestFingerprint === undefined ? {} : { requestFingerprint: identity(decision.requestFingerprint) }),
        ...(decision.playtestRepair === undefined ? {} : { playtestRepair: { taskId: identity(object(decision.playtestRepair).taskId), reference: parseCreativePlaytestRepairReference(object(decision.playtestRepair).reference) } }),
      }
    }),
    ...(source.milestones === undefined
      ? {}
      : { milestones: array(source.milestones, 128).map((item) => {
          const intent = object(item)
          return {
            id: identity(intent.id),
            operation: member(intent.operation, ['adopt', 'undo']),
            status: member(intent.status, ['prepared', 'confirmed', 'abandoned']),
            artifacts: array(intent.artifacts, 256).map(reference => ({ artifactId: identity(object(reference).artifactId), fingerprint: identity(object(reference).fingerprint) })),
            anchors: ids(intent.anchors),
            ...(intent.merges === undefined ? {} : { merges: parseCreativeMilestoneMerges(intent.merges) }),
            ...(intent.targetId === undefined ? {} : { targetId: identity(intent.targetId) }),
            beforeRevision: identity(intent.beforeRevision),
            afterRevision: identity(intent.afterRevision),
            requestFingerprint: identity(intent.requestFingerprint),
            reason: text(intent.reason),
            at: integer(intent.at),
            ...(intent.confirmedAt === undefined ? {} : { confirmedAt: integer(intent.confirmedAt) }),
          }
        }) }),
    ...(source.delivery === undefined ? {} : { delivery: parseCreativeDeliveryReceipt(source.delivery) }),
    chargedMicroPoints: integer(source.chargedMicroPoints),
    reservedMicroPoints: integer(source.reservedMicroPoints),
    toolCalls: integer(source.toolCalls),
    ...(source.playtests === undefined ? {} : { playtests: array(source.playtests, 32).map(parseCreativePlaytestSummary) }),
    createdAt: integer(source.createdAt),
    updatedAt: integer(source.updatedAt),
  }
  run.artifacts = array(source.artifacts, 256).map(item => artifact(item, run))
  if (run.delivery) {
    const receipt = run.delivery
    if (run.status !== 'completed' || run.revision !== receipt.runRevision + 1 || run.tasks.some(task => task.status !== 'completed') || run.reservedMicroPoints
      || receipt.chargedMicroPoints !== run.chargedMicroPoints || receipt.toolCalls !== run.toolCalls
      || !run.decisions.some(item => item.id === receipt.id && item.action === 'finish' && item.projectRevision === receipt.projectRevision && item.reason === receipt.reason && item.at === receipt.at && JSON.stringify([...item.artifactIds].sort()) === JSON.stringify(receipt.dispositions.map(item => item.artifactId).sort()))
      || receipt.dispositions.length !== run.artifacts.filter(item => ['selected', 'adopted'].includes(item.status)).length
      || receipt.dispositions.some(item => !run.artifacts.some(artifact => artifact.id === item.artifactId && artifact.fingerprint === item.fingerprint && (item.disposition === 'adopted' ? artifact.status === 'adopted' : artifact.status === 'selected' && (item.disposition === 'excluded' || !artifact.changes.length))))
      || receipt.pendingMedia.some(item => !run.artifacts.some(artifact => artifact.id === item.artifactId && ['selected', 'adopted'].includes(artifact.status) && ['art-direction', 'voice-direction'].includes(artifact.output?.kind ?? '')))
      || receipt.milestoneIds.some(id => !run.milestones?.some(item => item.id === id && item.status === 'confirmed'))
      || receipt.playtestIds.some(id => !run.playtests?.some(item => item.id === id && item.scope === 'saved' && item.snapshotRevision === receipt.projectRevision))) {
      throw new TypeError('Invalid creative delivery provenance')
    }
  }
  for (const decision of run.decisions) {
    if (decision.playtestRepair && (decision.action !== 'rework' || !run.tasks.some(item => item.taskId === decision.playtestRepair!.taskId)
      || !run.playtests?.some(item => item.id === decision.playtestRepair!.reference.reportId && item.snapshotRevision === decision.playtestRepair!.reference.snapshotRevision))) {
      throw new TypeError('Invalid repair report provenance')
    }
  }
  for (const task of run.tasks) {
    for (const repair of [task.playtestRepair, ...(task.history ?? []).map(item => item.playtestRepair)].filter(item => item !== undefined)) {
      if (!run.decisions.some(item => item.id === repair.decisionId && item.playtestRepair?.taskId === task.taskId && JSON.stringify(item.playtestRepair.reference) === JSON.stringify(repair.reference)))
        throw new TypeError('Invalid repair decision provenance')
    }
  }

  if (new Set(run.tasks.map(task => task.taskId)).size !== run.tasks.length || run.tasks.length !== run.plan.tasks.length
    || run.tasks.some(task => !run.plan.tasks.some(definition => definition.id === task.taskId))
    || new Set(run.artifacts.map(item => item.id)).size !== run.artifacts.length) {
    throw new TypeError('Creative response contains duplicate or unknown identities')
  }
  for (const item of run.artifacts)
    assertCreativeArtifactBoundary(item, run, { allowStaleUpstream: true })
  if (new Set(run.milestones?.map(item => item.id)).size !== (run.milestones?.length ?? 0) || (run.milestones?.filter(item => item.status === 'prepared').length ?? 0) > 1)
    throw new TypeError('Invalid milestone identity or pending count')
  for (const intent of run.milestones ?? []) {
    if ((intent.operation === 'undo' && intent.merges !== undefined) || intent.artifacts.some(reference => !run.artifacts.some(item => item.id === reference.artifactId && item.fingerprint === reference.fingerprint))
      || intent.anchors.some(id => !run.artifacts.some(item => item.id === id))
      || (intent.operation === 'undo' && !run.milestones?.some(item => item.id === intent.targetId && item.operation === 'adopt' && item.status === 'confirmed'))) {
      throw new TypeError('Invalid milestone provenance')
    }
    creativeMilestoneChanges(run, intent)
  }
  for (const task of run.tasks) {
    if (task.artifactIds.some(id => !run.artifacts.some(item => item.id === id && item.taskId === task.taskId)))
      throw new TypeError('Creative task references an unavailable candidate')
  }
  if (run.playtests?.some(item => item.projectId !== run.plan.projectId || item.artifacts.some(reference => !run.artifacts.some(artifact => artifact.id === reference.artifactId && artifact.fingerprint === reference.fingerprint))))
    throw new TypeError('Invalid playtest report provenance')
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
    ...(source.delivery === undefined ? {} : { delivery: parseCreativeDeliveryReceipt(source.delivery) }),
    chargedMicroPoints: integer(source.chargedMicroPoints),
    reservedMicroPoints: integer(source.reservedMicroPoints),
    updatedAt: integer(source.updatedAt),
  }
}
