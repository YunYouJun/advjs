import type { CreativeTeamClient } from './client'
import type { CreativeMilestoneIntent, CreativeTeamRun } from './contracts'
import type { CreativeMilestoneRequest } from './milestones'
import type { CreativeMilestoneReview, CreativeProjectWorkspace } from './review'
import { compileProject } from '@advjs/core'
import { computeAgentProjectRevision } from '../proposals/review'
import { creativeMilestoneChanges, overlayCreativeMilestone, prepareCreativeMilestone } from './milestones'
import { requiredCreativeReviewCapabilities } from './validation'
import { parseCreativeProject } from './wire'

export interface CreativeAdoptionScope { accountId: string, projectId: string, runId: string }
export interface CreativeAdoptionJournalEntry extends CreativeAdoptionScope {
  intentId: string
  request: CreativeMilestoneRequest
  review: CreativeMilestoneReview
  state: 'preparing' | 'prepared' | 'applied' | 'confirmed' | 'abandoned'
}
/** Private durable host storage. A save must resolve only after its transaction commits. */
export interface CreativeAdoptionJournal {
  load: (scope: CreativeAdoptionScope) => Promise<CreativeAdoptionJournalEntry | undefined>
  save: (entry: CreativeAdoptionJournalEntry) => Promise<void>
}
export interface CreativeAdoptionRecovery {
  entry: CreativeAdoptionJournalEntry
  run: CreativeTeamRun
  projectState: 'before' | 'after' | 'partial' | 'conflict'
  sourceState: 'before' | 'after' | 'conflict'
}

/** Compiles an isolated, exact snapshot. Re-review explicitly accepts unrelated source updates. */
export async function reviewCreativeMilestone(run: CreativeTeamRun, request: CreativeMilestoneRequest): Promise<CreativeMilestoneReview> {
  if (await computeAgentProjectRevision(request.project.files) !== request.project.revision)
    throw new Error('CREATIVE_SOURCE_CONFLICT')
  const prepared = prepareCreativeMilestone(run, request)
  const compiled = await compileProject({ id: request.project.id, files: prepared.files }, { allowEmptyAssetManifest: true })
  if (compiled.diagnostics.some(item => item.severity === 'error'))
    throw new Error('CREATIVE_COMPILE_FAILED')
  const candidateRevision = await computeAgentProjectRevision(prepared.files)
  // A project that cannot cross the confirmation boundary must never be written locally.
  parseCreativeProject({ id: request.project.id, revision: candidateRevision, files: prepared.files })
  if (candidateRevision === request.project.revision)
    throw new Error('CREATIVE_EMPTY_MILESTONE')
  return { projectId: request.project.id, baselineRevision: request.project.revision, artifactIds: prepared.artifacts.map(item => item.artifactId), changes: prepared.changes, files: prepared.files, diagnostics: compiled.diagnostics, candidateRevision }
}

/** Coordinates two storage domains. Reconnect only inspects; resuming requires an author action. */
export class CreativeMilestoneCoordinator {
  constructor(private readonly options: { scope: CreativeAdoptionScope, client: CreativeTeamClient, workspace: CreativeProjectWorkspace, journal: CreativeAdoptionJournal, assertCurrent: () => void }) {}

  private assertEntry(entry: CreativeAdoptionJournalEntry): void {
    this.options.assertCurrent()
    if (entry.accountId !== this.options.scope.accountId || entry.projectId !== this.options.scope.projectId || entry.runId !== this.options.scope.runId)
      throw new Error('CREATIVE_PROJECT_MISMATCH')
  }

  private mediaArtifacts(run: CreativeTeamRun, artifactIds: readonly string[]) {
    const artifacts = run.artifacts.filter(item => artifactIds.includes(item.id) && item.kind === 'media-adoption')
    for (const artifact of artifacts) {
      if (!artifact.media || !this.options.workspace.verifyMedia || requiredCreativeReviewCapabilities(artifact).some(capability => !this.options.workspace.capabilities.includes(capability)))
        throw new Error('CREATIVE_MEDIA_VERIFIER_REQUIRED')
    }
    return artifacts
  }

  private async verifyMedia(run: CreativeTeamRun, intent: CreativeMilestoneIntent, files: Readonly<Record<string, string>>) {
    const artifacts = this.mediaArtifacts(run, intent.artifacts.map(item => item.artifactId))
    if (artifacts.length)
      await this.options.workspace.verifyMedia!(files, intent.operation === 'adopt' ? artifacts.map(item => item.media!) : [])
    this.options.assertCurrent()
  }

  async recover(): Promise<CreativeAdoptionRecovery | undefined> {
    this.options.assertCurrent()
    const entry = await this.options.journal.load(this.options.scope)
    if (!entry)
      return undefined
    this.assertEntry(entry)
    const run = await this.options.client.get(entry.projectId, entry.runId)
    this.assertEntry(entry)
    const snapshot = await this.options.workspace.snapshot()
    this.assertEntry(entry)
    const sourceState = snapshot.revision === entry.review.candidateRevision ? 'after' : snapshot.revision === entry.review.baselineRevision ? 'before' : 'conflict'
    const projectState = this.options.workspace.inspectRecovery ? await this.options.workspace.inspectRecovery(entry.review) : sourceState
    this.assertEntry(entry)
    return { entry, run, projectState, sourceState }
  }

  async begin(run: CreativeTeamRun, request: CreativeMilestoneRequest, review: CreativeMilestoneReview): Promise<CreativeTeamRun> {
    this.options.assertCurrent()
    if (run.id !== this.options.scope.runId || run.accountId !== this.options.scope.accountId || run.plan.projectId !== this.options.scope.projectId)
      throw new Error('CREATIVE_PROJECT_MISMATCH')
    const previous = await this.options.journal.load(this.options.scope)
    this.options.assertCurrent()
    if (previous && !['confirmed', 'abandoned'].includes(previous.state))
      throw new Error('CREATIVE_MILESTONE_PENDING')
    const checked = await reviewCreativeMilestone(run, request)
    if (JSON.stringify(checked) !== JSON.stringify(review))
      throw new Error('CREATIVE_REVIEW_CHANGED')
    this.mediaArtifacts(run, review.artifactIds)
    const snapshot = await this.options.workspace.snapshot()
    this.options.assertCurrent()
    if (snapshot.revision !== review.baselineRevision)
      throw new Error('CREATIVE_SOURCE_CONFLICT')
    const entry: CreativeAdoptionJournalEntry = { ...this.options.scope, intentId: crypto.randomUUID(), request: structuredClone(request), review: structuredClone(review), state: 'preparing' }
    await this.options.journal.save(entry)
    this.assertEntry(entry)
    // Persist before the first POST. An unknown response is recovered using this same key.
    await this.options.client.milestone(entry.projectId, entry.runId, { type: 'prepare', request: entry.request }, entry.intentId)
    this.assertEntry(entry)
    return this.resume(entry)
  }

  async resume(entry: CreativeAdoptionJournalEntry): Promise<CreativeTeamRun> {
    this.assertEntry(entry)
    let run = await this.options.client.get(entry.projectId, entry.runId)
    this.assertEntry(entry)
    let intent = run.milestones?.find(item => item.id === entry.intentId)
    let snapshot = await this.options.workspace.snapshot()
    this.assertEntry(entry)
    this.mediaArtifacts(run, entry.review.artifactIds)
    if (!intent) {
      if (snapshot.revision !== entry.review.baselineRevision)
        throw new Error('CREATIVE_MILESTONE_CONFLICT')
      run = await this.options.client.milestone(entry.projectId, entry.runId, { type: 'prepare', request: entry.request }, entry.intentId)
      this.assertEntry(entry)
      intent = run.milestones?.find(item => item.id === entry.intentId)
    }
    if (!intent || intent.beforeRevision !== entry.review.baselineRevision || intent.afterRevision !== entry.review.candidateRevision || intent.operation !== entry.request.operation
      || JSON.stringify(intent.artifacts.map(item => item.artifactId)) !== JSON.stringify(entry.review.artifactIds) || intent.status === 'abandoned') {
      throw new Error('CREATIVE_MILESTONE_CONFLICT')
    }
    const actual = await this.options.workspace.inspectRecovery?.(entry.review)
    this.assertEntry(entry)
    if (actual === 'conflict')
      throw new Error('CREATIVE_SOURCE_CONFLICT')
    if (actual === 'partial') {
      if (!this.options.workspace.recover || (intent.status === 'confirmed' && snapshot.revision !== intent.afterRevision))
        throw new Error('CREATIVE_SOURCE_CONFLICT')
      const changes = creativeMilestoneChanges(run, intent)
      if (JSON.stringify(changes) !== JSON.stringify(entry.review.changes) || await computeAgentProjectRevision(entry.review.files) !== intent.afterRevision)
        throw new Error('CREATIVE_REVIEW_CHANGED')
      const result = await compileProject({ id: entry.projectId, files: entry.review.files }, { allowEmptyAssetManifest: true })
      if (result.diagnostics.some(item => item.severity === 'error'))
        throw new Error('CREATIVE_COMPILE_FAILED')
      this.assertEntry(entry)
      snapshot = await this.options.workspace.recover(entry.review, 'after', intent)
      this.assertEntry(entry)
    }
    if (snapshot.revision !== intent.beforeRevision && snapshot.revision !== intent.afterRevision)
      throw new Error('CREATIVE_SOURCE_CONFLICT')
    if (intent.status === 'confirmed') {
      if (snapshot.revision !== intent.afterRevision)
        throw new Error('CREATIVE_MILESTONE_CONFLICT')
      await this.verifyMedia(run, intent, snapshot.files)
      await this.options.workspace.acknowledge?.(intent)
      this.assertEntry(entry)
      await this.options.journal.save({ ...entry, state: 'confirmed' })
      return run
    }
    if (snapshot.revision === intent.beforeRevision) {
      const changes = creativeMilestoneChanges(run, intent)
      if (JSON.stringify(changes) !== JSON.stringify(entry.review.changes)
        || await computeAgentProjectRevision(overlayCreativeMilestone(snapshot.files, changes)) !== intent.afterRevision) {
        throw new Error('CREATIVE_REVIEW_CHANGED')
      }
      await this.options.journal.save({ ...entry, state: 'prepared' })
      this.assertEntry(entry)
      if (await computeAgentProjectRevision(entry.review.files) !== intent.afterRevision)
        throw new Error('CREATIVE_REVIEW_CHANGED')
      const result = await compileProject({ id: entry.projectId, files: entry.review.files }, { allowEmptyAssetManifest: true })
      if (result.diagnostics.some(item => item.severity === 'error'))
        throw new Error('CREATIVE_COMPILE_FAILED')
      this.assertEntry(entry)
      await this.options.workspace.commit(entry.review.changes, intent.beforeRevision, intent)
      // Hosts may write then throw; never infer the actual project from that promise alone.
      snapshot = await this.options.workspace.snapshot()
      this.assertEntry(entry)
      if (snapshot.revision !== intent.afterRevision)
        throw new Error('CREATIVE_COMMIT_INCOMPLETE')
    }
    await this.options.journal.save({ ...entry, state: 'applied' })
    this.assertEntry(entry)
    snapshot = await this.options.workspace.snapshot()
    this.assertEntry(entry)
    if (snapshot.revision !== intent.afterRevision)
      throw new Error('CREATIVE_SOURCE_CONFLICT')
    await this.verifyMedia(run, intent, snapshot.files)
    snapshot = await this.options.workspace.snapshot()
    this.assertEntry(entry)
    if (snapshot.revision !== intent.afterRevision)
      throw new Error('CREATIVE_SOURCE_CONFLICT')
    run = await this.options.client.milestone(entry.projectId, entry.runId, { type: 'confirm', milestoneId: intent.id, project: { id: entry.projectId, revision: snapshot.revision, files: snapshot.files } }, `${entry.intentId}:confirm`)
    this.assertEntry(entry)
    if (run.milestones?.find(item => item.id === intent!.id)?.status !== 'confirmed')
      throw new Error('CREATIVE_MILESTONE_CONFLICT')
    await this.options.workspace.acknowledge?.(run.milestones!.find(item => item.id === intent!.id)!)
    this.assertEntry(entry)
    await this.options.journal.save({ ...entry, state: 'confirmed' })
    return run
  }

  async restore(entry: CreativeAdoptionJournalEntry): Promise<CreativeTeamRun> {
    this.assertEntry(entry)
    const run = await this.options.client.get(entry.projectId, entry.runId)
    this.assertEntry(entry)
    const intent = run.milestones?.find(item => item.id === entry.intentId)
    if (!intent || intent.status !== 'prepared' || intent.beforeRevision !== entry.review.baselineRevision || intent.afterRevision !== entry.review.candidateRevision
      || intent.operation !== entry.request.operation || JSON.stringify(creativeMilestoneChanges(run, intent)) !== JSON.stringify(entry.review.changes) || !this.options.workspace.recover) {
      throw new Error('CREATIVE_MILESTONE_CONFLICT')
    }
    const actual = await this.options.workspace.inspectRecovery?.(entry.review)
    this.assertEntry(entry)
    if (!actual || !['before', 'after', 'partial'].includes(actual))
      throw new Error('CREATIVE_SOURCE_CONFLICT')
    await this.options.workspace.recover(entry.review, 'before', intent)
    this.assertEntry(entry)
    return this.abandon(entry)
  }

  async abandon(entry: CreativeAdoptionJournalEntry): Promise<CreativeTeamRun> {
    this.assertEntry(entry)
    let snapshot = await this.options.workspace.snapshot()
    this.assertEntry(entry)
    if (snapshot.revision !== entry.review.baselineRevision)
      throw new Error('CREATIVE_SOURCE_CONFLICT')
    let run = await this.options.client.get(entry.projectId, entry.runId)
    this.assertEntry(entry)
    snapshot = await this.options.workspace.snapshot()
    this.assertEntry(entry)
    if (snapshot.revision !== entry.review.baselineRevision)
      throw new Error('CREATIVE_SOURCE_CONFLICT')
    if (run.milestones?.some(item => item.id === entry.intentId))
      run = await this.options.client.milestone(entry.projectId, entry.runId, { type: 'abandon', milestoneId: entry.intentId, project: { id: entry.projectId, revision: snapshot.revision, files: snapshot.files } }, `${entry.intentId}:abandon`)
    this.assertEntry(entry)
    const intent = run.milestones?.find(item => item.id === entry.intentId)
    if (intent?.status === 'abandoned')
      await this.options.workspace.acknowledge?.(intent)
    this.assertEntry(entry)
    await this.options.journal.save({ ...entry, state: 'abandoned' })
    return run
  }
}
