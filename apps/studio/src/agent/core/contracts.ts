import type { ProjectSourcePatch } from '@advjs/core'
import type { JsonValue } from '@advjs/types'

export const AGENT_PROTOCOL_VERSION = 1 as const

export const AGENT_CAPABILITY_IDS = [
  'generate-outline',
  'generate-chapter-draft',
  'suggest-plot',
  'simulate-roleplay',
  'check-consistency',
] as const

export const AGENT_TASK_STATUSES = [
  'authorizing',
  'queued',
  'running',
  'settling',
  'completed',
  'cancelled',
  'blocked',
  'failed',
  'reconcile_required',
] as const

export const AGENT_BILLING_STATUSES = [
  'none',
  'reserved',
  'settled',
  'released',
  'reconcile_required',
] as const

export type AgentProtocolVersion = typeof AGENT_PROTOCOL_VERSION
export type AgentCapabilityId = typeof AGENT_CAPABILITY_IDS[number]
export type AgentTaskStatus = typeof AGENT_TASK_STATUSES[number]
export type AgentBillingStatus = typeof AGENT_BILLING_STATUSES[number]
export type AgentProjectPatch = ProjectSourcePatch

export type AgentErrorCode
  = | 'unauthenticated'
    | 'forbidden'
    | 'beta_access_required'
    | 'invalid_request'
    | 'quota_exceeded'
    | 'balance_insufficient'
    | 'concurrency_limit'
    | 'platform_budget_exceeded'
    | 'capability_disabled'
    | 'content_blocked'
    | 'upstream_error'
    | 'parse_error'
    | 'cancelled'
    | 'conflict'
    | 'reconcile_required'
    | 'protocol_unsupported'
    | 'internal_error'

export interface AgentDiagnostic {
  code: string
  message: string
  severity: 'info' | 'warning' | 'error'
  path?: string
}

export interface AgentProposal {
  summary: string
  projectRevision: string
  patches: readonly AgentProjectPatch[]
  diagnostics: readonly AgentDiagnostic[]
}

export interface AgentUsageSummary {
  inputTokens: number
  outputTokens: number
  cachedInputTokens?: number
  reasoningTokens?: number
  totalTokens: number
  providerCostMicroCny: number
  chargedMicroPoints: number
}

export interface AgentPointsSummary {
  reservedMicroPoints: number
  chargedMicroPoints: number
}

export interface AgentError {
  code: AgentErrorCode
  message: string
  retryable: boolean
  requestId?: string
}

export interface AgentTaskSnapshot {
  protocolVersion: AgentProtocolVersion
  taskId: string
  capability: AgentCapabilityId
  status: AgentTaskStatus
  billingStatus: AgentBillingStatus
  projectId: string
  projectRevision: string
  streamText: string
  streamRevision: number
  reservedMicroPoints: number
  proposal?: AgentProposal
  usage?: AgentUsageSummary
  points: AgentPointsSummary
  error?: AgentError
  createdAt: number
  updatedAt: number
}

export type AgentEvent
  = | { type: 'run.started', taskId: string }
    | { type: 'text.delta', taskId: string, delta: string, offset: number }
    | { type: 'state.snapshot', task: AgentTaskSnapshot }
    | { type: 'proposal.ready', taskId: string, proposal: AgentProposal }
    | { type: 'usage.settled', taskId: string, usage: AgentUsageSummary }
    | { type: 'run.finished', taskId: string }
    | { type: 'run.failed', taskId: string, error: AgentError }
    | { type: 'heartbeat', at: number }

export interface AgentEventEnvelope {
  protocolVersion: AgentProtocolVersion
  id: string
  cursor: string
  event: AgentEvent
}

export interface AgentProjectContext {
  id: string
  revision: string
  files: Readonly<Record<string, string>>
}

export interface AgentRequest<TInput = unknown> {
  capability: AgentCapabilityId
  clientRequestId: string
  input: TInput
  locale: string
  project: AgentProjectContext
}

export interface CreateTaskRequest<TInput = unknown> {
  capability: AgentCapabilityId
  protocolVersion: AgentProtocolVersion
  input: TInput
  locale: string
  project: AgentProjectContext
}

export interface CreateTaskResponse {
  taskId: string
  status: 'authorizing' | 'queued'
  reservedMicroPoints: number
  eventsUrl: string
}

export interface AgentResult {
  taskId: string
  proposal?: AgentProposal
  usage: AgentUsageSummary
}

export interface AgentRun {
  taskId: string
  events: AsyncIterable<AgentEventEnvelope>
  result: Promise<AgentResult>
}

export interface AgentRuntime {
  start: <TInput>(request: AgentRequest<TInput>) => Promise<AgentRun>
  resume: (taskId: string, cursor?: string) => Promise<AgentRun>
  getTask: (taskId: string) => Promise<AgentTaskSnapshot>
  cancel: (taskId: string) => Promise<void>
}

type UnknownRecord = Record<string, unknown>

const AGENT_ERROR_CODES = new Set<AgentErrorCode>([
  'unauthenticated',
  'forbidden',
  'beta_access_required',
  'invalid_request',
  'quota_exceeded',
  'balance_insufficient',
  'concurrency_limit',
  'platform_budget_exceeded',
  'capability_disabled',
  'content_blocked',
  'upstream_error',
  'parse_error',
  'cancelled',
  'conflict',
  'reconcile_required',
  'protocol_unsupported',
  'internal_error',
])

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function expectRecord(value: unknown, field: string): UnknownRecord {
  if (!isRecord(value))
    throw new TypeError(`${field} must be an object`)
  return value
}

function expectString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value)
    throw new TypeError(`${field} must be a non-empty string`)
  return value
}

function expectText(value: unknown, field: string): string {
  if (typeof value !== 'string')
    throw new TypeError(`${field} must be a string`)
  return value
}

function expectBoolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean')
    throw new TypeError(`${field} must be a boolean`)
  return value
}

function expectSafeInteger(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0)
    throw new TypeError(`${field} must be a non-negative safe integer`)
  return Number(value)
}

function expectProtocolVersion(value: unknown): AgentProtocolVersion {
  if (value !== AGENT_PROTOCOL_VERSION)
    throw new TypeError(`Unsupported protocol version: ${String(value)}`)
  return AGENT_PROTOCOL_VERSION
}

function expectEnum<T extends string>(value: unknown, values: readonly T[], field: string): T {
  if (typeof value !== 'string' || !values.includes(value as T))
    throw new TypeError(`${field} is invalid`)
  return value as T
}

function expectFiles(value: unknown): Record<string, string> {
  const source = expectRecord(value, 'project.files')
  const files: Record<string, string> = {}
  for (const [path, content] of Object.entries(source))
    files[expectString(path, 'project.files path')] = expectText(content, `project.files.${path}`)
  return files
}

function isJsonValue(value: unknown): value is JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean')
    return true
  if (typeof value === 'number')
    return Number.isFinite(value)
  if (Array.isArray(value))
    return value.every(isJsonValue)
  if (isRecord(value))
    return Object.values(value).every(isJsonValue)
  return false
}

function parseProjectPatch(value: unknown, index: number): AgentProjectPatch {
  const source = expectRecord(value, `proposal.patches.${index}`)
  const kind = expectEnum(source.kind, ['json-set', 'frontmatter-set', 'raw-text'] as const, `proposal.patches.${index}.kind`)
  const path = expectString(source.path, `proposal.patches.${index}.path`)
  if (kind === 'raw-text') {
    return {
      kind,
      path,
      content: expectText(source.content, `proposal.patches.${index}.content`),
    }
  }

  const key = expectString(source.key, `proposal.patches.${index}.key`)
  const patchValue = source.value
  if (patchValue !== undefined && !isJsonValue(patchValue))
    throw new TypeError(`proposal.patches.${index}.value must be JSON-compatible`)
  if (kind === 'json-set') {
    if (patchValue === undefined)
      throw new TypeError(`proposal.patches.${index}.value is required`)
    return { kind, path, key, value: patchValue }
  }
  return { kind, path, key, value: patchValue }
}

function parseDiagnostic(value: unknown, index: number): AgentDiagnostic {
  const source = expectRecord(value, `proposal.diagnostics.${index}`)
  return {
    code: expectString(source.code, `proposal.diagnostics.${index}.code`),
    message: expectString(source.message, `proposal.diagnostics.${index}.message`),
    severity: expectEnum(source.severity, ['info', 'warning', 'error'] as const, `proposal.diagnostics.${index}.severity`),
    ...(source.path === undefined ? {} : { path: expectString(source.path, `proposal.diagnostics.${index}.path`) }),
  }
}

function parseProposal(value: unknown): AgentProposal {
  const source = expectRecord(value, 'proposal')
  if (!Array.isArray(source.patches))
    throw new TypeError('proposal.patches must be an array')
  if (!Array.isArray(source.diagnostics))
    throw new TypeError('proposal.diagnostics must be an array')
  return {
    summary: expectString(source.summary, 'proposal.summary'),
    projectRevision: expectString(source.projectRevision, 'proposal.projectRevision'),
    patches: source.patches.map(parseProjectPatch),
    diagnostics: source.diagnostics.map(parseDiagnostic),
  }
}

function parseUsage(value: unknown): AgentUsageSummary {
  const source = expectRecord(value, 'usage')
  return {
    inputTokens: expectSafeInteger(source.inputTokens, 'usage.inputTokens'),
    outputTokens: expectSafeInteger(source.outputTokens, 'usage.outputTokens'),
    ...(source.cachedInputTokens === undefined ? {} : { cachedInputTokens: expectSafeInteger(source.cachedInputTokens, 'usage.cachedInputTokens') }),
    ...(source.reasoningTokens === undefined ? {} : { reasoningTokens: expectSafeInteger(source.reasoningTokens, 'usage.reasoningTokens') }),
    totalTokens: expectSafeInteger(source.totalTokens, 'usage.totalTokens'),
    providerCostMicroCny: expectSafeInteger(source.providerCostMicroCny, 'usage.providerCostMicroCny'),
    chargedMicroPoints: expectSafeInteger(source.chargedMicroPoints, 'usage.chargedMicroPoints'),
  }
}

function parsePoints(value: unknown): AgentPointsSummary {
  const source = expectRecord(value, 'points')
  return {
    reservedMicroPoints: expectSafeInteger(source.reservedMicroPoints, 'points.reservedMicroPoints'),
    chargedMicroPoints: expectSafeInteger(source.chargedMicroPoints, 'points.chargedMicroPoints'),
  }
}

function parseError(value: unknown): AgentError {
  const source = expectRecord(value, 'error')
  const code = expectString(source.code, 'error.code')
  if (!AGENT_ERROR_CODES.has(code as AgentErrorCode))
    throw new TypeError('error.code is invalid')
  return {
    code: code as AgentErrorCode,
    message: expectString(source.message, 'error.message'),
    retryable: expectBoolean(source.retryable, 'error.retryable'),
    ...(source.requestId === undefined ? {} : { requestId: expectString(source.requestId, 'error.requestId') }),
  }
}

export function parseCreateTaskRequest(value: unknown): CreateTaskRequest {
  const source = expectRecord(value, 'create task request')
  const project = expectRecord(source.project, 'project')
  return {
    capability: expectEnum(source.capability, AGENT_CAPABILITY_IDS, 'capability'),
    protocolVersion: expectProtocolVersion(source.protocolVersion),
    locale: expectString(source.locale, 'locale'),
    input: source.input,
    project: {
      id: expectString(project.id, 'project.id'),
      revision: expectString(project.revision, 'project.revision'),
      files: expectFiles(project.files),
    },
  }
}

export function parseCreateTaskResponse(value: unknown): CreateTaskResponse {
  const source = expectRecord(value, 'create task response')
  return {
    taskId: expectString(source.taskId, 'taskId'),
    status: expectEnum(source.status, ['authorizing', 'queued'] as const, 'status'),
    reservedMicroPoints: expectSafeInteger(source.reservedMicroPoints, 'reservedMicroPoints'),
    eventsUrl: expectString(source.eventsUrl, 'eventsUrl'),
  }
}

export function parseAgentTaskSnapshot(value: unknown): AgentTaskSnapshot {
  const source = expectRecord(value, 'task')
  return {
    protocolVersion: expectProtocolVersion(source.protocolVersion),
    taskId: expectString(source.taskId, 'taskId'),
    capability: expectEnum(source.capability, AGENT_CAPABILITY_IDS, 'capability'),
    status: expectEnum(source.status, AGENT_TASK_STATUSES, 'status'),
    billingStatus: expectEnum(source.billingStatus, AGENT_BILLING_STATUSES, 'billingStatus'),
    projectId: expectString(source.projectId, 'projectId'),
    projectRevision: expectString(source.projectRevision, 'projectRevision'),
    streamText: typeof source.streamText === 'string' ? source.streamText : (() => { throw new TypeError('streamText must be a string') })(),
    streamRevision: expectSafeInteger(source.streamRevision, 'streamRevision'),
    reservedMicroPoints: expectSafeInteger(source.reservedMicroPoints, 'reservedMicroPoints'),
    ...(source.proposal === undefined ? {} : { proposal: parseProposal(source.proposal) }),
    ...(source.usage === undefined ? {} : { usage: parseUsage(source.usage) }),
    points: parsePoints(source.points),
    ...(source.error === undefined ? {} : { error: parseError(source.error) }),
    createdAt: expectSafeInteger(source.createdAt, 'createdAt'),
    updatedAt: expectSafeInteger(source.updatedAt, 'updatedAt'),
  }
}

function parseEvent(value: unknown): AgentEvent {
  const source = expectRecord(value, 'event')
  const type = expectString(source.type, 'event.type')
  switch (type) {
    case 'run.started':
    case 'run.finished':
      return { type, taskId: expectString(source.taskId, 'event.taskId') }
    case 'text.delta':
      return {
        type,
        taskId: expectString(source.taskId, 'event.taskId'),
        delta: typeof source.delta === 'string' ? source.delta : (() => { throw new TypeError('event.delta must be a string') })(),
        offset: expectSafeInteger(source.offset, 'event.offset'),
      }
    case 'state.snapshot':
      return { type, task: parseAgentTaskSnapshot(source.task) }
    case 'proposal.ready':
      return {
        type,
        taskId: expectString(source.taskId, 'event.taskId'),
        proposal: parseProposal(source.proposal),
      }
    case 'usage.settled':
      return {
        type,
        taskId: expectString(source.taskId, 'event.taskId'),
        usage: parseUsage(source.usage),
      }
    case 'run.failed':
      return {
        type,
        taskId: expectString(source.taskId, 'event.taskId'),
        error: parseError(source.error),
      }
    case 'heartbeat':
      return { type, at: expectSafeInteger(source.at, 'event.at') }
    default:
      throw new TypeError(`event.type is invalid: ${type}`)
  }
}

export function parseAgentEventEnvelope(value: unknown): AgentEventEnvelope {
  const source = expectRecord(value, 'event envelope')
  return {
    protocolVersion: expectProtocolVersion(source.protocolVersion),
    id: expectString(source.id, 'event envelope id'),
    cursor: expectString(source.cursor, 'event envelope cursor'),
    event: parseEvent(source.event),
  }
}
