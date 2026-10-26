import type { ManagedAgentTransportOptions } from '../managed/transport'
import type { CreativeTeamAvailability, CreativeTeamRun } from './contracts'
import type { CreativeTeamPublicDecision, CreativeTeamRunSummary, CreativeTeamStartRequest } from './wire'
import { ManagedAgentTransport } from '../managed/transport'
import { parseCreativeTeamRun, parseCreativeTeamRunSummary } from './responses'
import { parseCreativeProject, parseCreativeTeamAvailability, parseCreativeTeamPublicDecision, parseCreativeTeamStartRequest } from './wire'

export type CreativeTeamDecisionInput = CreativeTeamPublicDecision extends infer T ? T extends CreativeTeamPublicDecision ? Omit<T, 'decisionId'> : never : never
export interface CreativeTeamClient {
  availability: () => Promise<CreativeTeamAvailability>
  list: (projectId: string) => Promise<readonly CreativeTeamRunSummary[]>
  get: (projectId: string, runId: string) => Promise<CreativeTeamRun>
  start: (request: CreativeTeamStartRequest, idempotencyKey: string) => Promise<CreativeTeamRun>
  decide: (projectId: string, runId: string, decision: CreativeTeamDecisionInput, idempotencyKey: string) => Promise<CreativeTeamRun>
  refreshFacts: (project: CreativeTeamStartRequest['project'], runId: string, idempotencyKey: string) => Promise<CreativeTeamRun>
}
function envelope(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || !('protocolVersion' in value) || value.protocolVersion !== 1)
    throw new TypeError('Unsupported creative team response protocol')
  return value as Record<string, unknown>
}
function key(value: string): string {
  if (!/^[\w.:-]{1,128}$/.test(value))
    throw new TypeError('Invalid creative idempotency key')
  return value
}

/** Reads never dispatch; POSTs require the caller's stable intent key and are never auto-retried. */
export class ManagedCreativeTeamClient implements CreativeTeamClient {
  readonly #transport: ManagedAgentTransport
  readonly #accountId: string
  readonly #root = '/ai/v2/apps/advjs-studio-web/creative-team'

  constructor(options: ManagedAgentTransportOptions & { accountId: string }) {
    if (!options.accountId.trim())
      throw new TypeError('Creative team account identity is required')
    this.#accountId = options.accountId
    this.#transport = new ManagedAgentTransport(options)
  }

  availability(): Promise<CreativeTeamAvailability> {
    return this.#transport.requestRaw(`${this.#root}/capabilities`, parseCreativeTeamAvailability)
  }

  list(projectId: string): Promise<readonly CreativeTeamRunSummary[]> {
    return this.#transport.requestRaw(`${this.#root}/runs?projectId=${encodeURIComponent(projectId)}`, (value) => {
      const items = envelope(value).items
      if (!Array.isArray(items) || items.length > 20)
        throw new TypeError('Invalid creative run history')
      return items.map(item => parseCreativeTeamRunSummary(item, projectId))
    })
  }

  #parse(value: unknown, projectId: string, runId?: string): CreativeTeamRun {
    return parseCreativeTeamRun(envelope(value).run, { accountId: this.#accountId, projectId, runId })
  }

  #path(projectId: string, runId: string, action = ''): string {
    if (!/^[\w-]{1,120}$/.test(runId))
      throw new TypeError('Invalid creative run identity')
    return `${this.#root}/runs/${runId}${action}?projectId=${encodeURIComponent(projectId)}`
  }

  get(projectId: string, runId: string): Promise<CreativeTeamRun> {
    return this.#transport.requestRaw(this.#path(projectId, runId), value => this.#parse(value, projectId, runId))
  }

  start(request: CreativeTeamStartRequest, idempotencyKey: string): Promise<CreativeTeamRun> {
    const body = parseCreativeTeamStartRequest(request)
    return this.#transport.requestRaw(`${this.#root}/runs`, value => this.#parse(value, body.project.id), { method: 'POST', body, headers: { 'idempotency-key': key(idempotencyKey) } })
  }

  decide(projectId: string, runId: string, decision: CreativeTeamDecisionInput, idempotencyKey: string): Promise<CreativeTeamRun> {
    const { decisionId: _, ...body } = parseCreativeTeamPublicDecision(decision, key(idempotencyKey))
    return this.#transport.requestRaw(this.#path(projectId, runId, '/decisions'), value => this.#parse(value, projectId, runId), { method: 'POST', body, headers: { 'idempotency-key': idempotencyKey } })
  }

  refreshFacts(project: CreativeTeamStartRequest['project'], runId: string, idempotencyKey: string): Promise<CreativeTeamRun> {
    const body = parseCreativeProject(project)
    return this.#transport.requestRaw(this.#path(project.id, runId, '/facts'), value => this.#parse(value, project.id, runId), { method: 'POST', body, headers: { 'idempotency-key': key(idempotencyKey) } })
  }
}
