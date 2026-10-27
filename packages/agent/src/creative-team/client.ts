import type { ManagedAgentTransportOptions } from '../managed/transport'
import type { CreativeTeamAvailability, CreativeTeamRun } from './contracts'
import type { CreativeDeliveryRequest } from './delivery'
import type { CreativeCandidateEditRequest } from './edits'
import type { CreativeMediaCandidateRequest } from './media'
import type { CreativeMilestoneCommand } from './milestones'
import type { CreativePlaytestReport } from './playtest-contracts'
import type { CreativeTeamPublicDecision, CreativeTeamRunSummary, CreativeTeamStartRequest } from './wire'
import { ManagedAgentTransport } from '../managed/transport'
import { parseCreativeDeliveryRequest } from './delivery'
import { parseCreativeCandidateEditRequest } from './edits'
import { parseCreativeMediaCandidateRequest } from './media'
import { parseCreativeMilestoneCommand } from './milestones'
import { parseCreativePlaytestReport } from './playtest-contracts'
import { parseCreativeTeamRun, parseCreativeTeamRunSummary } from './responses'
import { parseCreativeProject, parseCreativeTeamAvailability, parseCreativeTeamPublicDecision, parseCreativeTeamStartRequest } from './wire'

export type CreativeTeamDecisionInput = CreativeTeamPublicDecision extends infer T ? T extends CreativeTeamPublicDecision ? Omit<T, 'decisionId'> : never : never
export interface CreativeTeamClient {
  availability: () => Promise<CreativeTeamAvailability>
  list: (projectId: string) => Promise<readonly CreativeTeamRunSummary[]>
  get: (projectId: string, runId: string) => Promise<CreativeTeamRun>
  start: (request: CreativeTeamStartRequest, idempotencyKey: string) => Promise<CreativeTeamRun>
  decide: (projectId: string, runId: string, decision: CreativeTeamDecisionInput, idempotencyKey: string) => Promise<CreativeTeamRun>
  finish?: (projectId: string, runId: string, request: CreativeDeliveryRequest, idempotencyKey: string) => Promise<CreativeTeamRun>
  refreshFacts: (project: CreativeTeamStartRequest['project'], runId: string, idempotencyKey: string) => Promise<CreativeTeamRun>
  editCandidate: (projectId: string, runId: string, request: CreativeCandidateEditRequest, idempotencyKey: string) => Promise<CreativeTeamRun>
  registerMediaCandidate?: (projectId: string, runId: string, request: CreativeMediaCandidateRequest, idempotencyKey: string) => Promise<CreativeTeamRun>
  milestone: (projectId: string, runId: string, command: CreativeMilestoneCommand, idempotencyKey: string) => Promise<CreativeTeamRun>
  recordPlaytest: (project: CreativeTeamStartRequest['project'], runId: string, report: CreativePlaytestReport, idempotencyKey: string) => Promise<CreativeTeamRun>
  getPlaytest: (projectId: string, runId: string, reportId: string) => Promise<CreativePlaytestReport>
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

  finish(projectId: string, runId: string, request: CreativeDeliveryRequest, idempotencyKey: string): Promise<CreativeTeamRun> {
    const body = parseCreativeDeliveryRequest(request)
    return this.#transport.requestRaw(this.#path(projectId, runId, '/delivery'), value => this.#parse(value, projectId, runId), { method: 'POST', body, headers: { 'idempotency-key': key(idempotencyKey) } })
  }

  refreshFacts(project: CreativeTeamStartRequest['project'], runId: string, idempotencyKey: string): Promise<CreativeTeamRun> {
    const body = parseCreativeProject(project)
    return this.#transport.requestRaw(this.#path(project.id, runId, '/facts'), value => this.#parse(value, project.id, runId), { method: 'POST', body, headers: { 'idempotency-key': key(idempotencyKey) } })
  }

  editCandidate(projectId: string, runId: string, request: CreativeCandidateEditRequest, idempotencyKey: string): Promise<CreativeTeamRun> {
    const body = parseCreativeCandidateEditRequest(request)
    return this.#transport.requestRaw(this.#path(projectId, runId, '/candidate-edits'), value => this.#parse(value, projectId, runId), { method: 'POST', body, headers: { 'idempotency-key': key(idempotencyKey) } })
  }

  registerMediaCandidate(projectId: string, runId: string, request: CreativeMediaCandidateRequest, idempotencyKey: string): Promise<CreativeTeamRun> {
    const body = parseCreativeMediaCandidateRequest(request)
    return this.#transport.requestRaw(this.#path(projectId, runId, '/media-candidates'), value => this.#parse(value, projectId, runId), { method: 'POST', body, headers: { 'idempotency-key': key(idempotencyKey) } })
  }

  milestone(projectId: string, runId: string, command: CreativeMilestoneCommand, idempotencyKey: string): Promise<CreativeTeamRun> {
    const body = parseCreativeMilestoneCommand(command)
    return this.#transport.requestRaw(this.#path(projectId, runId, '/milestones'), value => this.#parse(value, projectId, runId), { method: 'POST', body, headers: { 'idempotency-key': key(idempotencyKey) } })
  }

  recordPlaytest(project: CreativeTeamStartRequest['project'], runId: string, report: CreativePlaytestReport, idempotencyKey: string): Promise<CreativeTeamRun> {
    const body = { project: parseCreativeProject(project), report: parseCreativePlaytestReport(report) }
    return this.#transport.requestRaw(this.#path(project.id, runId, '/playtests'), value => this.#parse(value, project.id, runId), { method: 'POST', body, headers: { 'idempotency-key': key(idempotencyKey) } })
  }

  getPlaytest(projectId: string, runId: string, reportId: string): Promise<CreativePlaytestReport> {
    if (!/^[\w-]{1,120}$/.test(reportId))
      throw new TypeError('Invalid playtest report identity')
    return this.#transport.requestRaw(this.#path(projectId, runId, `/playtests/${reportId}`), (value) => {
      const report = parseCreativePlaytestReport(envelope(value).report)
      if (report.projectId !== projectId)
        throw new TypeError('Playtest report project mismatch')
      return report
    })
  }
}
