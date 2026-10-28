import type { CreativeArtifact, CreativeFileChange, CreativeTeamHandoff, CreativeTeamRun, CreativeTeamTask } from './contracts'
import type { CreativeDeliveryReceipt } from './delivery'
import type { CreativePlaytestReport, CreativePlaytestSummary } from './playtest-contracts'
import { CREATIVE_ARTIFACT_KINDS, CREATIVE_PARTNER_CAPABILITIES, CREATIVE_PARTNER_IDS } from './contracts'
import { creativeDeliveryPendingMedia } from './delivery'
import { creativeMediaCanonical } from './media'
import { parseCreativePlaytestScenarios } from './outputs'
import { parseCreativePlaytestReport, parseCreativePlaytestSummary } from './playtest-contracts'
import { parseCreativePlaytestVoiceCoverage } from './playtest-voice'
import { assertCreativeSourcePath } from './validation'

interface SummaryState {
  tasks: Array<Pick<CreativeTeamTask, 'partner' | 'capability' | 'instruction' | 'expectedOutput' | 'dependsOn'> & { taskId: string, status: string, attempt: number, chargedMicroPoints: number, error?: { code: string, message: string } }>
  artifacts: Array<{ artifactId: string, taskId: string, fingerprint: string, partner: typeof CREATIVE_PARTNER_IDS[number], kind: typeof CREATIVE_ARTIFACT_KINDS[number], status: 'selected' | 'adopted', summary: string }>
  pendingArtifacts: Array<{ artifactId: string, fingerprint: string }>
  milestones: Array<{ id: string, operation: 'adopt' | 'undo', status: 'prepared' | 'confirmed' | 'abandoned' }>
  playtests: CreativePlaytestSummary[]
  chargedBeforeSummary: number
}
interface SummaryReport {
  id: string
  available: boolean
  diagnostics: CreativePlaytestReport['diagnostics']
  diagnosticsOmitted: number
  voiceCoverage?: CreativePlaytestReport['voiceCoverage']
  executions: Array<Pick<CreativePlaytestReport['executions'][number], 'scenario' | 'status' | 'code' | 'actualEnding' | 'terminalAddress' | 'reachedExpected' | 'commands'>>
}
export interface CreativeDirectorSummaryEvidence {
  schemaVersion: 1
  taskId: string
  attempt: number
  projectRevision: string
  snapshotRevision: string
  scope: 'saved' | 'candidate'
  state: SummaryState
  toolCallsBeforeSummary: number
  pendingMedia: CreativeDeliveryReceipt['pendingMedia']
  reports: SummaryReport[]
  verification: 'stored-records-and-author-host-reports'
}
/** Advisory content only; actual source appears once in the effective project snapshot. */
export interface CreativeDirectorSummaryBrief { artifactId: string, fingerprint: string, kind: CreativeArtifact['kind'], content: string }
export interface CreativeDirectorSummaryContext { evidence: CreativeDirectorSummaryEvidence, changes: readonly CreativeFileChange[], briefs?: readonly CreativeDirectorSummaryBrief[] }
export interface CreativeDirectorSummaryOutput {
  kind: 'delivery-summary'
  summary: string
  overview: string
  deliverables: Array<{ artifactId: string, fingerprint: string, assessment: string }>
  risks: string[]
  nextSteps: string[]
  recommendation: 'continue-creation' | 'review-current-scope'
  evidence: CreativeDirectorSummaryEvidence
}

function object(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !keys.includes(key)))
    throw new TypeError('Invalid director summary authority')
  return value as Record<string, unknown>
}
function text(value: unknown, max = 200): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max)
    throw new TypeError('Invalid director summary text')
  return value
}
function integer(value: unknown): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0)
    throw new TypeError('Invalid director summary count')
  return Number(value)
}
function array(value: unknown, max = 256): unknown[] {
  if (!Array.isArray(value) || value.length > max)
    throw new TypeError('Invalid director summary collection')
  return value
}
function member<const T extends string>(value: unknown, choices: readonly T[]): T {
  if (!choices.includes(value as T))
    throw new TypeError('Invalid director summary state')
  return value as T
}
function unique(items: readonly { id?: string, artifactId?: string, taskId?: string }[]) {
  if (new Set(items.map(item => item.id ?? item.artifactId ?? item.taskId)).size !== items.length)
    throw new TypeError('Duplicate director summary reference')
}

/** Exclude this attempt's own execution and fee, so settlement cannot stale its own report. */
export function creativeDirectorSummaryState(run: CreativeTeamRun, taskId: string, attempt: number): SummaryState {
  const own = run.tasks.find(task => task.taskId === taskId)
  const ownCharge = (own?.history ?? []).filter(item => item.attempt >= attempt).reduce((sum, item) => sum + item.usage.chargedMicroPoints, 0)
  return {
    tasks: run.tasks.filter(task => task.taskId !== taskId).map((task) => {
      const plan = run.plan.tasks.find(item => item.id === task.taskId)!
      return { taskId: task.taskId, partner: plan.partner, capability: plan.capability, instruction: plan.instruction, expectedOutput: plan.expectedOutput, dependsOn: [...plan.dependsOn], status: task.status, attempt: task.attempt, chargedMicroPoints: (task.history ?? []).reduce((sum, item) => sum + item.usage.chargedMicroPoints, 0) || task.usage?.chargedMicroPoints || 0, ...(task.error ? { error: { ...task.error } } : {}) }
    }),
    artifacts: run.artifacts.filter(item => item.kind !== 'delivery-summary' && ['selected', 'adopted'].includes(item.status)).map(item => ({ artifactId: item.id, taskId: item.taskId, fingerprint: item.fingerprint, partner: item.partner, kind: item.kind, status: item.status as 'selected' | 'adopted', summary: item.summary })),
    pendingArtifacts: run.artifacts.filter(item => item.kind !== 'delivery-summary' && item.status === 'candidate').map(item => ({ artifactId: item.id, fingerprint: item.fingerprint })),
    milestones: (run.milestones ?? []).map(item => ({ id: item.id, operation: item.operation, status: item.status })),
    playtests: [...(run.playtests ?? [])],
    chargedBeforeSummary: run.chargedMicroPoints - ownCharge,
  }
}

/** Preserve selected specialist advice without copying chapters or complete dialogue blocks again. */
export function creativeDirectorSummaryBriefs(run: Pick<CreativeTeamRun, 'artifacts'>): CreativeDirectorSummaryBrief[] {
  return run.artifacts.flatMap((artifact) => {
    if (!['selected', 'adopted'].includes(artifact.status) || artifact.kind === 'delivery-summary')
      return []
    const output = artifact.output
    let content: unknown
    if (output?.kind === 'voice-direction') {
      content = { ...output, lines: output.lines.map(({ path, speakerId, instruction, line, lineId, source }) => ({ path, speakerId, instruction, ...(line === undefined ? {} : { line }), ...(lineId === undefined ? {} : { lineId }), ...(source ? { source: { line: source.line, endLine: source.endLine } } : {}) })) }
    }
    else if (output && ['production-plan', 'art-direction', 'playtest-plan'].includes(output.kind)) {
      content = output
    }
    else if (artifact.legacyResult?.streamText && !artifact.changes.length) {
      content = artifact.legacyResult
    }
    return content === undefined ? [] : [{ artifactId: artifact.id, fingerprint: artifact.fingerprint, kind: artifact.kind, content: JSON.stringify(content) }]
  })
}

/** All facts come from the persisted run and actual stored reports, never a model's claims. */
export function prepareCreativeDirectorSummaryEvidence(run: CreativeTeamRun, taskId: string, facts: CreativeTeamHandoff['facts'], reports: Readonly<Record<string, CreativePlaytestReport>>, snapshotRevision: string): CreativeDirectorSummaryEvidence {
  const task = run.plan.tasks.find(task => task.id === taskId)
  const state = run.tasks.find(task => task.taskId === taskId)
  if (task?.capability !== 'summarize-production' || !state)
    throw new Error('CREATIVE_SUMMARY_TASK_INVALID')
  const evidence: CreativeDirectorSummaryEvidence = {
    schemaVersion: 1,
    taskId,
    attempt: state.attempt + 1,
    projectRevision: facts.revision,
    snapshotRevision,
    scope: snapshotRevision !== facts.revision ? 'candidate' : 'saved',
    state: creativeDirectorSummaryState(run, taskId, state.attempt + 1),
    toolCallsBeforeSummary: run.toolCalls,
    pendingMedia: creativeDeliveryPendingMedia(run, facts.files),
    verification: 'stored-records-and-author-host-reports',
    reports: (run.playtests ?? []).map((summary): SummaryReport => {
      const stored = reports[summary.id]
      if (!stored)
        return { id: summary.id, available: false, diagnostics: [], diagnosticsOmitted: 0, executions: [] }
      const report = parseCreativePlaytestReport(stored)
      if (report.projectId !== run.plan.projectId || report.baselineRevision !== summary.baselineRevision || report.snapshotRevision !== summary.snapshotRevision || report.scope !== summary.scope
        || JSON.stringify(report.artifacts) !== JSON.stringify(summary.artifacts)
        || ['passed', 'failed', 'blocked', 'cancelled'].some(status => report.executions.filter(item => item.status === status).length !== summary[status as 'passed'])) {
        throw new Error('CREATIVE_SUMMARY_REPORT_CONFLICT')
      }
      return { id: summary.id, available: true, diagnostics: report.diagnostics, diagnosticsOmitted: report.diagnosticsOmitted, ...(report.voiceCoverage ? { voiceCoverage: report.voiceCoverage } : {}), executions: report.executions.map(({ scenario, status, code, actualEnding, terminalAddress, reachedExpected, commands }) => ({ scenario, status, code, ...(actualEnding ? { actualEnding } : {}), ...(terminalAddress ? { terminalAddress } : {}), reachedExpected, commands })) }
    }),
  }
  return parseCreativeDirectorSummaryEvidence(evidence)
}

/** Historical evidence is data; it never grants author-host or media execution authority. */
export function parseCreativeDirectorSummaryEvidence(value: unknown): CreativeDirectorSummaryEvidence {
  const root = object(value, ['schemaVersion', 'taskId', 'attempt', 'projectRevision', 'snapshotRevision', 'scope', 'state', 'toolCallsBeforeSummary', 'pendingMedia', 'reports', 'verification'])
  if (root.schemaVersion !== 1 || root.verification !== 'stored-records-and-author-host-reports' || integer(root.attempt) < 1 || new TextEncoder().encode(JSON.stringify(value)).length > 98304)
    throw new TypeError('Invalid director summary evidence')
  const raw = object(root.state, ['tasks', 'artifacts', 'pendingArtifacts', 'milestones', 'playtests', 'chargedBeforeSummary'])
  const tasks = array(raw.tasks, 24).map((value) => {
    const item = object(value, ['taskId', 'partner', 'capability', 'instruction', 'expectedOutput', 'dependsOn', 'status', 'attempt', 'chargedMicroPoints', 'error'])
    const error = item.error === undefined ? undefined : object(item.error, ['code', 'message'])
    const partner = member(item.partner, CREATIVE_PARTNER_IDS)
    return { taskId: text(item.taskId), partner, capability: member(item.capability, CREATIVE_PARTNER_CAPABILITIES[partner]), instruction: text(item.instruction, 4000), expectedOutput: text(item.expectedOutput, 4000), dependsOn: array(item.dependsOn, 24).map(item => text(item)), status: member(item.status, ['pending', 'running', 'awaiting_review', 'completed', 'stale', 'blocked', 'failed', 'cancelled', 'reconcile_required']), attempt: integer(item.attempt), chargedMicroPoints: integer(item.chargedMicroPoints), ...(error ? { error: { code: text(error.code), message: text(error.message, 32000) } } : {}) }
  })
  const artifacts = array(raw.artifacts).map((value) => {
    const item = object(value, ['artifactId', 'taskId', 'fingerprint', 'partner', 'kind', 'status', 'summary'])
    if (item.kind === 'delivery-summary')
      throw new TypeError('Director summaries cannot cite themselves')
    return { artifactId: text(item.artifactId), taskId: text(item.taskId), fingerprint: text(item.fingerprint), partner: member(item.partner, CREATIVE_PARTNER_IDS), kind: member(item.kind, CREATIVE_ARTIFACT_KINDS), status: member(item.status, ['selected', 'adopted']), summary: text(item.summary, 32000) }
  })
  const milestones = array(raw.milestones, 128).map((value) => {
    const item = object(value, ['id', 'operation', 'status'])
    return { id: text(item.id), operation: member(item.operation, ['adopt', 'undo']), status: member(item.status, ['prepared', 'confirmed', 'abandoned']) }
  })
  const playtests = array(raw.playtests, 128).map(parseCreativePlaytestSummary)
  const pendingArtifacts = array(raw.pendingArtifacts).map((value) => {
    const item = object(value, ['artifactId', 'fingerprint'])
    return { artifactId: text(item.artifactId), fingerprint: text(item.fingerprint) }
  })
  const pendingMedia = array(root.pendingMedia, 4096).map((value) => {
    const item = object(value, ['artifactId', 'target'])
    return { artifactId: text(item.artifactId), target: text(item.target, 600) }
  })
  const reports = array(root.reports, 128).map((value): SummaryReport => {
    const item = object(value, ['id', 'available', 'diagnostics', 'diagnosticsOmitted', 'executions', 'voiceCoverage'])
    if (typeof item.available !== 'boolean')
      throw new TypeError('Invalid director report availability')
    const summary = playtests.find(summary => summary.id === item.id)
    if (!summary)
      throw new TypeError('Unknown director playtest reference')
    const diagnostics = array(item.diagnostics, 128).map((value): CreativePlaytestReport['diagnostics'][number] => {
      const row = object(value, ['code', 'severity', 'message', 'path', 'line', 'column', 'suggestion', 'certainty'])
      const path = row.path === undefined ? undefined : text(row.path)
      if (path)
        assertCreativeSourcePath(path)
      return { code: text(row.code), severity: member(row.severity, ['error', 'warning']), message: text(row.message, 4000), ...(path ? { path } : {}), ...(row.line === undefined ? {} : { line: integer(row.line) }), ...(row.column === undefined ? {} : { column: integer(row.column) }), ...(row.suggestion === undefined ? {} : { suggestion: text(row.suggestion, 4000) }), ...(row.certainty === undefined ? {} : { certainty: member(row.certainty, ['certain', 'uncertain']) }) }
    })
    const executions = array(item.executions, 12).map((value): SummaryReport['executions'][number] => {
      const row = object(value, ['scenario', 'status', 'code', 'actualEnding', 'terminalAddress', 'reachedExpected', 'commands'])
      const scenario = parseCreativePlaytestScenarios([row.scenario])[0]!
      const address = (value: unknown) => {
        const result = text(value)
        if (!/^[\w.-]+#[\w.$-]+$/.test(result))
          throw new TypeError('Invalid summary ending')
        return result
      }
      if (typeof row.reachedExpected !== 'boolean' || integer(row.commands) > 512)
        throw new TypeError('Invalid director ending projection')
      const status = member(row.status, ['passed', 'failed', 'blocked', 'cancelled'])
      const code = member(row.code, ['completed', 'compile_failed', 'ending_missing', 'ending_mismatch', 'choices_unused', 'choice_required', 'choice_invalid', 'activity_requires_host', 'runtime_error', 'command_limit', 'evidence_limit', 'cancelled'])
      if ((status === 'passed') !== (code === 'completed') || (status === 'cancelled') !== (code === 'cancelled') || (status === 'passed' && (!row.reachedExpected || row.actualEnding !== scenario.expectedEnding)))
        throw new TypeError('Invalid passing director outcome')
      return { scenario, status, code, reachedExpected: row.reachedExpected, commands: integer(row.commands), ...(row.actualEnding === undefined ? {} : { actualEnding: address(row.actualEnding) }), ...(row.terminalAddress === undefined ? {} : { terminalAddress: address(row.terminalAddress) }) }
    })
    const voiceCoverage = item.voiceCoverage === undefined ? undefined : parseCreativePlaytestVoiceCoverage(item.voiceCoverage)
    if (voiceCoverage && (!item.available || voiceCoverage.snapshotRevision !== summary.snapshotRevision))
      throw new TypeError('Invalid director voice evidence boundary')
    const diagnosticsOmitted = integer(item.diagnosticsOmitted)
    if (!item.available && (executions.length || diagnostics.length || diagnosticsOmitted))
      throw new TypeError('Unavailable director reports cannot contain results')
    if (item.available && (!executions.length || ['passed', 'failed', 'blocked', 'cancelled'].some(status => executions.filter(item => item.status === status).length !== summary[status as 'passed'])))
      throw new TypeError('Director report counts do not match')
    unique(executions.map(item => ({ id: item.scenario.id })))
    return { id: text(item.id), available: item.available, diagnostics, diagnosticsOmitted, executions, ...(voiceCoverage ? { voiceCoverage } : {}) }
  })
  for (const items of [tasks, artifacts, pendingArtifacts, milestones, playtests, reports])
    unique(items)
  if (reports.length !== playtests.length || pendingMedia.some(item => !artifacts.some(artifact => artifact.artifactId === item.artifactId)))
    throw new TypeError('Incomplete director evidence references')
  return { schemaVersion: 1, taskId: text(root.taskId), attempt: integer(root.attempt), projectRevision: text(root.projectRevision), snapshotRevision: text(root.snapshotRevision), scope: member(root.scope, ['saved', 'candidate']), state: { tasks, artifacts, pendingArtifacts, milestones, playtests, chargedBeforeSummary: integer(raw.chargedBeforeSummary) }, toolCallsBeforeSummary: integer(root.toolCallsBeforeSummary), pendingMedia, reports, verification: 'stored-records-and-author-host-reports' }
}

export function parseCreativeDirectorSummaryOutput(value: unknown, expected?: CreativeDirectorSummaryEvidence): CreativeDirectorSummaryOutput {
  const root = object(value, ['kind', 'summary', 'overview', 'deliverables', 'risks', 'nextSteps', 'recommendation', 'evidence'])
  if (root.kind !== 'delivery-summary')
    throw new TypeError('Invalid director output kind')
  const evidence = parseCreativeDirectorSummaryEvidence(expected ?? root.evidence)
  if (root.evidence !== undefined && creativeMediaCanonical(parseCreativeDirectorSummaryEvidence(root.evidence)) !== creativeMediaCanonical(evidence))
    throw new TypeError('Director cannot replace frozen execution evidence')
  const deliverables = array(root.deliverables).map((value) => {
    const item = object(value, ['artifactId', 'fingerprint', 'assessment'])
    if (!evidence.state.artifacts.some(artifact => artifact.artifactId === item.artifactId && artifact.fingerprint === item.fingerprint))
      throw new TypeError('Unknown director deliverable reference')
    return { artifactId: text(item.artifactId), fingerprint: text(item.fingerprint), assessment: text(item.assessment, 4000) }
  })
  unique(deliverables)
  if (deliverables.length !== evidence.state.artifacts.length)
    throw new TypeError('Director must account for every selected result')
  return { kind: 'delivery-summary', summary: text(root.summary, 1000), overview: text(root.overview, 4000), deliverables, risks: array(root.risks, 32).map(item => text(item, 4000)), nextSteps: array(root.nextSteps, 32).map(item => text(item, 4000)), recommendation: member(root.recommendation, ['continue-creation', 'review-current-scope']), evidence }
}

export function parseCreativeDirectorSummaryContext(value: unknown): CreativeDirectorSummaryContext {
  const root = object(value, ['evidence', 'changes', 'briefs'])
  const evidence = parseCreativeDirectorSummaryEvidence(root.evidence)
  const briefs = array(root.briefs ?? []).map((value): CreativeDirectorSummaryBrief => {
    const item = object(value, ['artifactId', 'fingerprint', 'kind', 'content'])
    if (!evidence.state.artifacts.some(artifact => artifact.artifactId === item.artifactId && artifact.fingerprint === item.fingerprint && artifact.kind === item.kind))
      throw new TypeError('Unknown director advisory reference')
    return { artifactId: text(item.artifactId), fingerprint: text(item.fingerprint), kind: member(item.kind, CREATIVE_ARTIFACT_KINDS), content: text(item.content, 32000) }
  })
  unique(briefs)
  if (new TextEncoder().encode(JSON.stringify(briefs)).length > 98304)
    throw new TypeError('Director advisory context is too large')
  const changes = array(root.changes).map((value): CreativeFileChange => {
    const item = object(value, ['path', 'before', 'after'])
    const path = text(item.path)
    assertCreativeSourcePath(path)
    if ((item.before !== null && typeof item.before !== 'string') || (item.after !== null && typeof item.after !== 'string'))
      throw new TypeError('Invalid summary source content')
    return { path, before: item.before, after: item.after }
  })
  if (new Set(changes.map(item => item.path)).size !== changes.length)
    throw new TypeError('Duplicate director source change')
  return { evidence, changes, briefs }
}

export function isCreativeDirectorSummaryCurrent(run: CreativeTeamRun, artifact: CreativeArtifact): boolean {
  if (artifact.output?.kind !== 'delivery-summary')
    return true
  const evidence = artifact.output.evidence
  return creativeMediaCanonical(evidence.state) === creativeMediaCanonical(creativeDirectorSummaryState(run, evidence.taskId, evidence.attempt))
}
