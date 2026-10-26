import type { AgentCapabilityId, AgentUsageSummary } from '../core/contracts'

/** Creative partners are not in-game character identities. */
export const CREATIVE_PARTNER_IDS = ['director', 'writer', 'character-designer', 'art-director', 'voice-director', 'playtester'] as const
export type CreativePartnerId = typeof CREATIVE_PARTNER_IDS[number]

/** Additive crew protocol; the existing five-capability v1/v2 API stays unchanged. */
export const CREATIVE_TEAM_PROTOCOL_VERSION = 1 as const
export const CREATIVE_TEAM_CAPABILITIES = ['plan-production', 'write-chapters', 'design-characters', 'direct-art', 'direct-voice', 'playtest-project'] as const
export type CreativeTeamCapability = AgentCapabilityId | typeof CREATIVE_TEAM_CAPABILITIES[number]

/** Server-validated authority, independent of display names and avatars. */
export const CREATIVE_PARTNER_CAPABILITIES: Readonly<Record<CreativePartnerId, readonly CreativeTeamCapability[]>> = {
  'director': ['plan-production', 'generate-outline'],
  'writer': ['write-chapters', 'generate-chapter-draft', 'suggest-plot'],
  'character-designer': ['design-characters', 'simulate-roleplay'],
  'art-director': ['direct-art'],
  'voice-director': ['direct-voice'],
  'playtester': ['playtest-project', 'check-consistency', 'simulate-roleplay'],
}

/** Author-approved ceilings. Reservations and settlement belong to trusted Runtime. */
export interface CreativeTeamLimits {
  maxTasks: number
  maxToolCalls: number
  maxReworkRounds: number
  maxMicroPoints: number
}

/** A finite handoff contains selected context, never every partner's chat history. */
export interface CreativeTeamTask {
  id: string
  partner: CreativePartnerId
  capability: CreativeTeamCapability
  dependsOn: readonly string[]
  sourcePaths: readonly string[]
  instruction: string
  expectedOutput: string
}

/** Reviewable production plan returned before any child task is dispatched. */
export interface CreativeTeamPlan {
  protocolVersion: typeof CREATIVE_TEAM_PROTOCOL_VERSION
  projectId: string
  projectRevision: string
  goal: string
  tasks: readonly CreativeTeamTask[]
  limits: CreativeTeamLimits
}

export type CreativeTeamTaskStatus = 'pending' | 'running' | 'awaiting_review' | 'completed' | 'stale' | 'blocked' | 'failed' | 'cancelled' | 'reconcile_required'
export type CreativeTeamRunStatus = 'awaiting_plan_review' | 'ready' | 'running' | 'awaiting_review' | 'blocked' | 'cancel_requested' | 'cancelled' | 'completed' | 'reconcile_required'

/** Exact source dependencies allow unrelated media to survive upstream edits. */
export interface CreativeArtifactSource {
  projectId: string
  revision: string
  files: Readonly<Record<string, string>>
  upstream: readonly { artifactId: string, fingerprint: string }[]
}

/** Only data files may be proposed; executable host configuration is excluded. */
export interface CreativeFileChange {
  path: string
  before: string | null
  after: string | null
}

export type CreativeArtifactKind = 'production-brief' | 'characters' | 'chapter' | 'art-direction' | 'voice-direction' | 'playtest-report' | 'delivery-summary'
export type CreativeReviewCapability = 'create-source' | 'modify-source' | 'delete-source' | 'catalog-media' | 'voice-take' | 'candidate-preview'

/** All outputs stay in the candidate layer until the author adopts a revision. */
export interface CreativeArtifact {
  id: string
  runId: string
  taskId: string
  partner: CreativePartnerId
  projectId: string
  kind: CreativeArtifactKind
  source: CreativeArtifactSource
  fingerprint: string
  summary: string
  changes: readonly CreativeFileChange[]
  reviewCapabilities: readonly CreativeReviewCapability[]
  status: 'candidate' | 'selected' | 'adopted' | 'rejected' | 'stale'
}

/** Runtime history is execution metadata, not another game script format. */
export interface CreativeTeamTaskState {
  taskId: string
  status: CreativeTeamTaskStatus
  attempt: number
  inputFingerprint?: string
  runtimeTaskId?: string
  dispatchKey?: string
  dispatchStarted?: boolean
  reservedMicroPoints?: number
  artifactIds: readonly string[]
  usage?: AgentUsageSummary
  error?: { code: string, message: string }
}

/** Persisted by Runtime under an account/project boundary. */
export interface CreativeTeamRun {
  id: string
  accountId: string
  plan: CreativeTeamPlan
  status: CreativeTeamRunStatus
  revision: number
  tasks: readonly CreativeTeamTaskState[]
  artifacts: readonly CreativeArtifact[]
  decisions: readonly CreativeTeamDecision[]
  chargedMicroPoints: number
  reservedMicroPoints: number
  toolCalls: number
  createdAt: number
  updatedAt: number
}

/** Author decisions preserve the selected version and reason for replacement. */
export interface CreativeTeamDecision {
  id: string
  artifactIds: readonly string[]
  action: 'approve-plan' | 'select' | 'reject' | 'adopt' | 'undo' | 'stop'
  reason: string
  projectRevision: string
  at: number
}

/** Availability is a verified Runtime claim, never inferred from a local adapter. */
export interface CreativeTeamAvailability {
  protocolVersion: typeof CREATIVE_TEAM_PROTOCOL_VERSION
  enabled: boolean
  serviceVersion: string
  capabilities: readonly CreativeTeamCapability[]
  media: { image: 'unavailable' | 'manual-import' | 'verified-managed', voice: 'unavailable' | 'manual-import' | 'verified-author-host' | 'verified-managed' }
  maxConcurrentTasks: 1
}

/** Versioned context explicitly distinguishes saved facts from selected candidates. */
export interface CreativeTeamHandoff {
  runId: string
  taskId: string
  projectId: string
  goal: string
  facts: { revision: string, files: Readonly<Record<string, string>> }
  candidates: readonly CreativeArtifact[]
  constraints: readonly string[]
  remainingMicroPoints: number
}
