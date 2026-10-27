import type { AgentCapabilityId, AgentUsageSummary } from '../core/contracts'
import type { CreativePartnerOutput } from './outputs'
import type { CreativePlaytestSummary } from './playtest-contracts'
import type { CreativePlaytestRepairContext, CreativePlaytestRepairReference } from './playtest-repair'

/** Creative partners are not in-game character identities. */
export const CREATIVE_PARTNER_IDS = ['director', 'writer', 'character-designer', 'art-director', 'voice-director', 'playtester'] as const
export type CreativePartnerId = typeof CREATIVE_PARTNER_IDS[number]

/** Additive crew protocol; the existing five-capability v1/v2 API stays unchanged. */
export const CREATIVE_TEAM_PROTOCOL_VERSION = 1 as const
export const CREATIVE_TEAM_CAPABILITIES = ['plan-production', 'write-chapters', 'design-characters', 'direct-art', 'direct-voice', 'playtest-project'] as const
export type CreativeTeamCapability = AgentCapabilityId | typeof CREATIVE_TEAM_CAPABILITIES[number]

export const CREATIVE_PARTNER_DEFAULT_CAPABILITY = {
  'director': 'plan-production',
  'writer': 'write-chapters',
  'character-designer': 'design-characters',
  'art-director': 'direct-art',
  'voice-director': 'direct-voice',
  'playtester': 'playtest-project',
} as const satisfies Record<CreativePartnerId, CreativeTeamCapability>

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

export const CREATIVE_ARTIFACT_KINDS = ['production-brief', 'characters', 'chapter', 'art-direction', 'voice-direction', 'playtest-plan', 'playtest-report', 'delivery-summary', 'outline', 'roleplay', 'consistency-review', 'plot-suggestions'] as const
export type CreativeArtifactKind = typeof CREATIVE_ARTIFACT_KINDS[number]
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
  /** Immutable author revision; lineage is separate from upstream task dependencies. */
  editedFrom?: { artifactId: string, fingerprint: string }
  output?: CreativePartnerOutput
  legacyResult?: { capability: AgentCapabilityId, streamText: string }
  changes: readonly CreativeFileChange[]
  reviewCapabilities: readonly CreativeReviewCapability[]
  status: 'candidate' | 'selected' | 'adopted' | 'rejected' | 'stale'
}

/** Runtime history is execution metadata, not another game script format. */
export interface CreativeTeamAttempt {
  attempt: number
  dispatchKey: string
  runtimeTaskId?: string
  inputFingerprint?: string
  status: 'completed' | 'failed' | 'cancelled'
  usage: AgentUsageSummary
  artifactIds: readonly string[]
  error?: { code: string, message: string }
  playtestRepair?: { decisionId: string, reference: CreativePlaytestRepairReference }
}

/** The latest attempt is convenient for UI; history retains every confirmed bill and tool result. */
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
  history?: readonly CreativeTeamAttempt[]
  error?: { code: string, message: string }
  playtestRepair?: { decisionId: string, reference: CreativePlaytestRepairReference }
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
  /** Two-store adoption receipts contain references, never duplicate game source content. */
  milestones?: readonly CreativeMilestoneIntent[]
  playtests?: readonly CreativePlaytestSummary[]
  chargedMicroPoints: number
  reservedMicroPoints: number
  toolCalls: number
  createdAt: number
  updatedAt: number
}

export interface CreativeMilestoneIntent {
  id: string
  operation: 'adopt' | 'undo'
  status: 'prepared' | 'confirmed' | 'abandoned'
  artifacts: readonly { artifactId: string, fingerprint: string }[]
  /** Only these candidates were built using the exact adopted versions. */
  anchors: readonly string[]
  targetId?: string
  beforeRevision: string
  afterRevision: string
  requestFingerprint: string
  reason: string
  at: number
  confirmedAt?: number
}

/** Author decisions preserve the selected version and reason for replacement. */
export interface CreativeTeamDecision {
  id: string
  artifactIds: readonly string[]
  action: 'approve-plan' | 'select' | 'reject' | 'adopt' | 'undo' | 'stop' | 'rework' | 'edit'
  reason: string
  projectRevision: string
  at: number
  requestFingerprint?: string
  playtestRepair?: { taskId: string, reference: CreativePlaytestRepairReference }
}

/** Availability is a verified Runtime claim, never inferred from a local adapter. */
export interface CreativeTeamAvailability {
  protocolVersion: typeof CREATIVE_TEAM_PROTOCOL_VERSION
  enabled: boolean
  serviceVersion: string
  capabilities: readonly CreativeTeamCapability[]
  media: { image: 'unavailable' | 'manual-import' | 'verified-managed', voice: 'unavailable' | 'manual-import' | 'verified-author-host' | 'verified-managed' }
  authoring?: { candidateEdits: boolean, milestoneAdoption: boolean, playtestReports?: boolean, playtestRepair?: boolean }
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
  repair?: CreativePlaytestRepairContext
  remainingMicroPoints: number
}
