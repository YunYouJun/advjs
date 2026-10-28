import type { AdvProjectDiagnostic, AdvProjectFileMap } from '@advjs/types'
import type { AgentProjectWorkspaceSnapshot } from '../proposals/review'
import type { CreativeArtifact, CreativeFileChange, CreativeMilestoneIntent, CreativeReviewCapability, CreativeTeamRun } from './contracts'
import type { CreativeMediaEvidence } from './media'
import type { CreativePlaytestVoiceCoverage } from './playtest-voice'
import { compileProject } from '@advjs/core'
import { computeAgentProjectRevision } from '../proposals/review'
import { creativeArtifactExpectedFiles } from './milestones'
import { requiredCreativeReviewCapabilities } from './validation'

/** Host adapter uses the existing project write transaction, including binary staging. */
export interface CreativeProjectWorkspace {
  snapshot: () => Promise<AgentProjectWorkspaceSnapshot>
  commit: (changes: readonly CreativeFileChange[], expectedRevision: string, intent?: CreativeMilestoneIntent) => Promise<AgentProjectWorkspaceSnapshot>
  capabilities: readonly CreativeReviewCapability[]
  /** Re-read current binary bytes and verify every supplied immutable hash, size and binding. */
  verifyMedia?: (files: Readonly<AdvProjectFileMap>, evidence: readonly CreativeMediaEvidence[]) => Promise<void>
  /** Trusted host inspects the exact effective source and real local audio bytes, read-only. */
  inspectVoiceCoverage?: (snapshot: AgentProjectWorkspaceSnapshot, signal?: AbortSignal) => Promise<CreativePlaytestVoiceCoverage>
  /** Inspect actual source and binary bytes without writing or contacting a service. */
  inspectRecovery?: (review: CreativeMilestoneReview) => Promise<'before' | 'after' | 'partial' | 'conflict'>
  /** Explicit author recovery; every affected file must equal one of the two reviewed versions. */
  recover?: (review: CreativeMilestoneReview, destination: 'before' | 'after', intent: CreativeMilestoneIntent) => Promise<AgentProjectWorkspaceSnapshot>
  /** Private local receipt only, after the server confirmed or abandoned this exact intent. */
  acknowledge?: (intent: CreativeMilestoneIntent) => Promise<void>
}

/** Immutable review contains the full candidate snapshot for isolated compilation/playtest. */
export interface CreativeMilestoneReview {
  projectId: string
  baselineRevision: string
  artifactIds: readonly string[]
  changes: readonly CreativeFileChange[]
  files: Readonly<AdvProjectFileMap>
  diagnostics: readonly AdvProjectDiagnostic[]
  candidateRevision: string
}

/** Undo is conditional on the exact adopted version and restores creations/deletions as well. */
export interface CreativeMilestoneCommit {
  projectId: string
  artifactIds: readonly string[]
  beforeRevision: string
  afterRevision: string
  undo: readonly CreativeFileChange[]
}

/** Apply candidate data in memory; overlapping writes require an explicit merge first. */
export function overlayCreativeChanges(files: Readonly<AdvProjectFileMap>, changes: readonly CreativeFileChange[]): AdvProjectFileMap {
  const next = { ...files }
  const paths = new Set<string>()
  for (const change of changes) {
    requiredCreativeReviewCapabilities({ kind: 'chapter', changes: [change] })
    if (paths.has(change.path))
      throw new Error(`CREATIVE_MERGE_REQUIRED:${change.path}`)
    paths.add(change.path)
    if ((next[change.path] ?? null) !== change.before)
      throw new Error(`CREATIVE_SOURCE_CONFLICT:${change.path}`)
    if (change.after === null)
      delete next[change.path]
    else
      next[change.path] = change.after
  }
  return next
}

/** Unified text/catalog review reuses the compiler and a revision-checked host workspace. */
export class CreativeMilestoneReviewService {
  constructor(private readonly workspace: CreativeProjectWorkspace) {}

  async review(artifacts: readonly CreativeArtifact[], run?: CreativeTeamRun): Promise<CreativeMilestoneReview> {
    if (!artifacts.length)
      throw new Error('CREATIVE_EMPTY_MILESTONE')
    const baseline = await this.workspace.snapshot()
    for (const artifact of artifacts) {
      if (artifact.projectId !== baseline.projectId || artifact.source.projectId !== baseline.projectId)
        throw new Error('CREATIVE_PROJECT_MISMATCH')
      if ((!run && artifact.source.revision !== baseline.revision) || !['candidate', 'selected'].includes(artifact.status))
        throw new Error('CREATIVE_REBASE_REQUIRED')
      for (const [path, content] of Object.entries(creativeArtifactExpectedFiles(artifact, run))) {
        if ((baseline.files[path] ?? null) !== content)
          throw new Error(`CREATIVE_SOURCE_CONFLICT:${path}`)
      }
      for (const capability of requiredCreativeReviewCapabilities(artifact)) {
        if (!this.workspace.capabilities.includes(capability))
          throw new Error(`CREATIVE_REVIEW_UNSUPPORTED:${capability}`)
      }
    }
    const changes = structuredClone(artifacts.flatMap(artifact => [...artifact.changes]))
    const files = overlayCreativeChanges(baseline.files, changes)
    const result = await compileProject({ id: baseline.projectId, files }, { allowEmptyAssetManifest: true })
    if (result.diagnostics.some(item => item.severity === 'error'))
      throw new Error(`CREATIVE_COMPILE_FAILED:${JSON.stringify(result.diagnostics)}`)
    return {
      projectId: baseline.projectId,
      baselineRevision: baseline.revision,
      artifactIds: artifacts.map(artifact => artifact.id),
      changes,
      files,
      diagnostics: result.diagnostics,
      candidateRevision: await computeAgentProjectRevision(files),
    }
  }

  async apply(review: CreativeMilestoneReview): Promise<CreativeMilestoneCommit> {
    const baseline = await this.workspace.snapshot()
    if (baseline.projectId !== review.projectId || baseline.revision !== review.baselineRevision)
      throw new Error('CREATIVE_SOURCE_CONFLICT')
    const files = overlayCreativeChanges(baseline.files, review.changes)
    if (await computeAgentProjectRevision(files) !== review.candidateRevision)
      throw new Error('CREATIVE_REVIEW_CHANGED')
    const result = await compileProject({ id: baseline.projectId, files }, { allowEmptyAssetManifest: true })
    if (result.diagnostics.some(item => item.severity === 'error'))
      throw new Error('CREATIVE_COMPILE_FAILED')
    const after = await this.workspace.commit(review.changes, review.baselineRevision)
    if (after.revision !== review.candidateRevision)
      throw new Error('CREATIVE_COMMIT_INCOMPLETE')
    return {
      projectId: review.projectId,
      artifactIds: review.artifactIds,
      beforeRevision: review.baselineRevision,
      afterRevision: after.revision,
      undo: review.changes.map(change => ({ path: change.path, before: change.after, after: change.before })),
    }
  }

  async undo(commit: CreativeMilestoneCommit): Promise<AgentProjectWorkspaceSnapshot> {
    const current = await this.workspace.snapshot()
    if (current.projectId !== commit.projectId || current.revision !== commit.afterRevision)
      throw new Error('CREATIVE_UNDO_CONFLICT')
    return this.workspace.commit(commit.undo, commit.afterRevision)
  }
}
