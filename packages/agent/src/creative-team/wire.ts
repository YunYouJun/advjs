import type { CreativePartnerId, CreativeTeamAvailability, CreativeTeamLimits, CreativeTeamPlan } from './contracts'
import type { CreativeTeamAction } from './orchestration'
import { AGENT_CAPABILITY_IDS } from '../core/contracts'
import { CREATIVE_PARTNER_DEFAULT_CAPABILITY, CREATIVE_PARTNER_IDS, CREATIVE_TEAM_CAPABILITIES } from './contracts'
import { parseCreativePlaytestRepairReference } from './playtest-repair'
import { assertCreativeSourcePath, parseCreativeTeamPlan } from './validation'

/** A finite request contains project data and author ceilings, never model or provider settings. */
export interface CreativeTeamStartRequest {
  protocolVersion: 1
  project: { id: string, revision: string, files: Readonly<Record<string, string>> }
  goal: string
  partner: CreativePartnerId
  limits: CreativeTeamLimits
  locale: string
}

/** Only author decisions cross the public API; dispatch/settlement are server-only. */
export type CreativeTeamPublicDecision = Extract<CreativeTeamAction, { type: 'approve-plan' | 'accept-production-plan' | 'select' | 'request-rework' | 'cancel' }>

export interface CreativeTeamRunSummary {
  id: string
  projectId: string
  goal: string
  status: string
  revision: number
  chargedMicroPoints: number
  reservedMicroPoints: number
  updatedAt: number
}

/** Runtime, worker and sweeper must opt in together; malformed flags never enable billing. */
export function parseCreativeTeamFeatureGate(value: string | undefined): boolean {
  if (value === undefined || value.trim() === '' || value.trim() === 'false')
    return false
  if (value.trim() !== 'true')
    throw new TypeError('YUNLEFUN_AI_CREATIVE_TEAM_ENABLED must be true or false')
  return true
}

function record(value: unknown, keys?: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new TypeError('Creative request must be an object')
  if (keys && Object.keys(value).some(key => !keys.includes(key)))
    throw new TypeError('Unknown creative request field')
  return value as Record<string, unknown>
}
function text(value: unknown, maximum = 4000): string {
  if (typeof value !== 'string' || !value.trim() || value.length > maximum)
    throw new TypeError('Invalid creative request text')
  return value
}
function integer(value: unknown, maximum = Number.MAX_SAFE_INTEGER): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0 || Number(value) > maximum)
    throw new TypeError('Invalid creative request limit')
  return Number(value)
}

/** Match the same portable source scope for request hashes, review and conditional undo. */
export function selectCreativeProjectFiles(files: Readonly<Record<string, string>>): Record<string, string> {
  return Object.fromEntries(Object.entries(files).filter(([path]) => {
    if (/^(?:README|ASSETS|LICENSE)\.md$/.test(path))
      return true
    try {
      assertCreativeSourcePath(path)
      return true
    }
    catch { return false }
  }))
}

/** Project snapshots may retain documentation but may not carry executable host code or secrets. */
export function parseCreativeProject(value: unknown): CreativeTeamStartRequest['project'] {
  const project = record(value, ['id', 'revision', 'files'])
  const source = record(project.files)
  if (Object.keys(source).length > 256)
    throw new TypeError('Creative project has too many text files')
  const files: Record<string, string> = {}
  let bytes = 0
  for (const [path, content] of Object.entries(source)) {
    if (!/^(?:adv\.config\.json|(?:README|ASSETS|LICENSE)\.md|adv\/[\w/-][\w./-]*\.(?:md|json))$/.test(path)
      || path.split('/').some(segment => segment === '..' || segment === '.' || !segment)
      || typeof content !== 'string') {
      throw new TypeError('Unsupported creative project source')
    }
    bytes += new TextEncoder().encode(content).byteLength
    if (bytes > 48 * 1024)
      throw new TypeError('Creative project exceeds the first-release source budget')
    files[path] = content
  }
  return { id: text(project.id, 200), revision: text(project.revision, 200), files }
}

/** Parse exact public fields and prevent client-side execution-policy overrides. */
export function parseCreativeTeamStartRequest(value: unknown): CreativeTeamStartRequest {
  const source = record(value, ['protocolVersion', 'project', 'goal', 'partner', 'limits', 'locale'])
  if (source.protocolVersion !== 1)
    throw new TypeError('Unsupported creative team protocol')
  const partner = source.partner ?? 'director'
  if (typeof partner !== 'string' || !CREATIVE_PARTNER_IDS.includes(partner as CreativePartnerId))
    throw new TypeError('Unknown creative partner')
  const limits = record(source.limits, ['maxTasks', 'maxToolCalls', 'maxReworkRounds', 'maxMicroPoints'])
  return {
    protocolVersion: 1,
    project: parseCreativeProject(source.project),
    goal: text(source.goal),
    partner: partner as CreativePartnerId,
    locale: text(source.locale, 32),
    limits: {
      maxTasks: integer(limits.maxTasks, 24),
      maxToolCalls: integer(limits.maxToolCalls, 128),
      maxReworkRounds: integer(limits.maxReworkRounds, 2),
      maxMicroPoints: integer(limits.maxMicroPoints),
    },
  }
}

/** First billable step is explicit: a director brief or one requested specialist. */
export function createCreativeBootstrapPlan(request: CreativeTeamStartRequest): CreativeTeamPlan {
  const sourcePaths = Object.keys(request.project.files).filter((path) => {
    try {
      assertCreativeSourcePath(path)
    }
    catch {
      return false
    }
    if (request.partner === 'character-designer')
      return /world\.md$|outline\.md$|\/characters\/|\/locations\//.test(path)
    if (request.partner === 'art-director')
      return /world\.md$|outline\.md$|\/characters\/|\/scenes\/|\/locations\/|\/assets(?:\/|\.json$)/.test(path)
    if (request.partner === 'voice-director')
      return /\/characters\/|\/chapters\/|\/audio\/|\/assets(?:\/|\.json$)/.test(path)
    return true
  }).sort()
  return parseCreativeTeamPlan({
    protocolVersion: 1,
    projectId: request.project.id,
    projectRevision: request.project.revision,
    goal: request.goal,
    limits: request.limits,
    tasks: [{ id: 'initial', partner: request.partner, capability: CREATIVE_PARTNER_DEFAULT_CAPABILITY[request.partner], dependsOn: [], sourcePaths, instruction: request.goal, expectedOutput: request.partner === 'director' ? '有限制作计划，后续任务不重复当前 initial 任务；保留原始目标与总预算，等待作者审阅' : '可审阅的结构化创作产物；缺失媒体与未执行试玩如实列出' }],
  }, { projectId: request.project.id, projectRevision: request.project.revision })
}

/** Reject runtime mutations even when the caller has a valid account token. */
export function parseCreativeTeamPublicDecision(value: unknown, idempotencyKey: string): CreativeTeamPublicDecision {
  const source = record(value, ['type', 'artifactId', 'taskId', 'artifactIds', 'reason', 'playtestRepair'])
  if (source.playtestRepair !== undefined && source.type !== 'request-rework')
    throw new TypeError('Playtest repair requires a rework decision')
  const decisionId = text(idempotencyKey, 128)
  switch (source.type) {
    case 'approve-plan': return { type: source.type, decisionId }
    case 'accept-production-plan': return { type: source.type, artifactId: text(source.artifactId, 200), decisionId }
    case 'select':
      if (!Array.isArray(source.artifactIds) || !source.artifactIds.length || source.artifactIds.length > 64)
        throw new TypeError('Invalid selected artifacts')
      return { type: source.type, taskId: text(source.taskId, 64), artifactIds: source.artifactIds.map(value => text(value, 200)), decisionId, reason: text(source.reason) }
    case 'request-rework': return { type: source.type, taskId: text(source.taskId, 64), reason: text(source.reason), decisionId, ...(source.playtestRepair === undefined ? {} : { playtestRepair: parseCreativePlaytestRepairReference(source.playtestRepair) }) }
    case 'cancel': return { type: source.type, decisionId, reason: text(source.reason) }
    default: throw new TypeError('This creative team mutation is not an author decision')
  }
}

/** Capability discovery fails closed when a server reports an unknown protocol or media state. */
export function parseCreativeTeamAvailability(value: unknown): CreativeTeamAvailability {
  const source = record(value)
  if (source.protocolVersion !== 1 || typeof source.enabled !== 'boolean' || source.maxConcurrentTasks !== 1 || !Array.isArray(source.capabilities))
    throw new TypeError('Unsupported creative team availability')
  const capabilities = source.capabilities.map((value) => {
    if (typeof value !== 'string' || ![...AGENT_CAPABILITY_IDS, ...CREATIVE_TEAM_CAPABILITIES].includes(value as typeof CREATIVE_TEAM_CAPABILITIES[number]))
      throw new TypeError('Unknown creative team capability')
    return value as CreativeTeamAvailability['capabilities'][number]
  })
  const media = record(source.media)
  const authoring = source.authoring === undefined ? undefined : record(source.authoring, ['candidateEdits', 'milestoneAdoption', 'playtestReports', 'playtestRepair'])
  if (authoring && (typeof authoring.candidateEdits !== 'boolean' || typeof authoring.milestoneAdoption !== 'boolean' || (authoring.playtestReports !== undefined && typeof authoring.playtestReports !== 'boolean') || (authoring.playtestRepair !== undefined && typeof authoring.playtestRepair !== 'boolean')))
    throw new TypeError('Unknown creative authoring availability')
  if (!['unavailable', 'manual-import', 'verified-managed'].includes(String(media.image))
    || !['unavailable', 'manual-import', 'verified-author-host', 'verified-managed'].includes(String(media.voice))) {
    throw new TypeError('Unknown creative media availability')
  }
  return { protocolVersion: 1, enabled: source.enabled, serviceVersion: text(source.serviceVersion, 200), capabilities, maxConcurrentTasks: 1, media: { image: media.image as CreativeTeamAvailability['media']['image'], voice: media.voice as CreativeTeamAvailability['media']['voice'] }, ...(authoring ? { authoring: { candidateEdits: authoring.candidateEdits as boolean, milestoneAdoption: authoring.milestoneAdoption as boolean, ...(authoring.playtestReports === undefined ? {} : { playtestReports: authoring.playtestReports as boolean }), ...(authoring.playtestRepair === undefined ? {} : { playtestRepair: authoring.playtestRepair as boolean }) } } : {}) }
}
