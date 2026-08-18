import type {
  AgentError,
  AgentErrorCode,
  AgentEventEnvelope,
  AgentRequest,
  AgentTaskSnapshot,
  CreateTaskResponse,
} from '../core/contracts'
import {
  AGENT_PROTOCOL_VERSION,
  parseAgentEventEnvelope,
  parseAgentTaskSnapshot,
  parseCreateTaskResponse,
} from '../core/contracts'

const V2_PROTOCOL_VERSION = 2
const ERROR_CODES = new Set<AgentErrorCode>([
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

function record(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new TypeError(`${field} must be an object`)
  return value as Record<string, unknown>
}

function text(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value)
    throw new TypeError(`${field} must be a non-empty string`)
  return value
}

function protocol(value: unknown): void {
  if (value !== V2_PROTOCOL_VERSION)
    throw new TypeError('Unsupported managed Runtime protocol v2 response')
}

function errorCode(source: Record<string, unknown>): AgentErrorCode {
  const normalized = typeof source.code === 'string'
    ? source.code.toLowerCase().replaceAll('-', '_') as AgentErrorCode
    : 'internal_error'
  if (ERROR_CODES.has(normalized))
    return normalized
  if (source.category === 'provider')
    return 'upstream_error'
  if (source.category === 'ledger')
    return 'reconcile_required'
  if (source.category === 'product')
    return 'invalid_request'
  return 'internal_error'
}

function projectError(value: unknown): AgentError {
  const source = record(value, 'task.error')
  return {
    code: errorCode(source),
    message: text(source.message, 'task.error.message'),
    retryable: source.retryable === true,
    ...(typeof source.requestId === 'string' ? { requestId: source.requestId } : {}),
  }
}

function projectContext(value: unknown): { projectId: string, projectRevision: string } {
  const context = record(value, 'task.context')
  const project = context.project && typeof context.project === 'object' && !Array.isArray(context.project)
    ? context.project as Record<string, unknown>
    : {}
  return {
    projectId: typeof context.projectId === 'string'
      ? context.projectId
      : typeof project.id === 'string' ? project.id : 'project_unavailable',
    projectRevision: typeof context.projectRevision === 'string'
      ? context.projectRevision
      : typeof project.revision === 'string' ? project.revision : 'revision_unavailable',
  }
}

export function projectV2TaskSnapshot(value: unknown, applicationId: string): AgentTaskSnapshot {
  const source = record(value, 'task')
  protocol(source.protocolVersion)
  if (source.applicationId !== applicationId)
    throw new TypeError('Managed Runtime application boundary mismatch')
  const context = projectContext(source.context)
  return parseAgentTaskSnapshot({
    protocolVersion: AGENT_PROTOCOL_VERSION,
    taskId: source.taskId,
    capability: source.capability,
    status: source.status,
    billingStatus: source.billingStatus,
    ...context,
    streamText: source.streamText,
    streamRevision: source.streamRevision,
    reservedMicroPoints: source.reservedMicroPoints,
    ...(source.result === undefined ? {} : { proposal: source.result }),
    ...(source.usage === undefined ? {} : { usage: source.usage }),
    points: {
      reservedMicroPoints: source.billingStatus === 'reserved' ? source.reservedMicroPoints : 0,
      chargedMicroPoints: source.chargedMicroPoints,
    },
    ...(source.error === undefined ? {} : { error: projectError(source.error) }),
    createdAt: source.createdAt,
    updatedAt: source.updatedAt,
  })
}

export function projectV2CreateTaskResponse(value: unknown, applicationId: string): CreateTaskResponse {
  const source = record(value, 'task accepted')
  protocol(source.protocolVersion)
  const expectedPrefix = `/ai/v2/apps/${encodeURIComponent(applicationId)}/tasks/`
  const eventsUrl = text(source.eventsUrl, 'task accepted.eventsUrl')
  if (!eventsUrl.startsWith(expectedPrefix) || !eventsUrl.endsWith('/events'))
    throw new TypeError('Managed Runtime returned an event URL outside the application boundary')
  return parseCreateTaskResponse({
    taskId: source.taskId,
    status: source.status,
    reservedMicroPoints: source.reservedMicroPoints,
    eventsUrl,
  })
}

export function projectV2EventEnvelope(value: unknown, applicationId: string): AgentEventEnvelope {
  const source = record(value, 'event envelope')
  protocol(source.protocolVersion)
  const event = record(source.event, 'event')
  const type = text(event.type, 'event.type')
  let projected: unknown
  if (type === 'state.snapshot') {
    projected = { type, task: projectV2TaskSnapshot(event.task, applicationId) }
  }
  else if (type === 'result.ready') {
    projected = { type: 'proposal.ready', taskId: event.taskId, proposal: event.result }
  }
  else if (type === 'run.failed') {
    projected = { type, taskId: event.taskId, error: projectError(event.error) }
  }
  else {
    projected = event
  }
  return parseAgentEventEnvelope({
    protocolVersion: AGENT_PROTOCOL_VERSION,
    id: source.id,
    cursor: source.cursor,
    event: projected,
  })
}

export function createV2TaskRequest<TInput>(request: AgentRequest<TInput>) {
  return {
    protocolVersion: V2_PROTOCOL_VERSION,
    capability: request.capability,
    input: request.input,
    locale: request.locale,
    context: { project: request.project },
  }
}
