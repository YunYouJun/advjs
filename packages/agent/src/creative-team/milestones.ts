import type { CreativeArtifact, CreativeFileChange, CreativeMilestoneIntent, CreativeMilestoneMerge, CreativeTeamRun } from './contracts'
import type { CreativeTeamStartRequest } from './wire'
import { compatibleCreativeMediaArtifacts } from './media'
import { creativeMergeInvalidations, mergeCreativeMilestoneChanges, parseCreativeMilestoneMerges } from './merges'
import { creativeOutputFileChanges } from './outputs'
import { requiredCreativeReviewCapabilities } from './validation'
import { parseCreativeProject } from './wire'

export type CreativeMilestoneRequest = {
  project: CreativeTeamStartRequest['project']
  reason: string
} & ({ operation: 'adopt', artifacts: readonly { artifactId: string, fingerprint: string }[], merges?: readonly CreativeMilestoneMerge[] } | { operation: 'undo', milestoneId: string })

export type CreativeMilestoneCommand = { type: 'prepare', request: CreativeMilestoneRequest } | { type: 'confirm' | 'abandon', milestoneId: string, project: CreativeTeamStartRequest['project'] }

export function parseCreativeMilestoneCommand(value: unknown): CreativeMilestoneCommand {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new TypeError('Invalid milestone command')
  const source = value as Record<string, unknown>
  if (source.type === 'prepare' && Object.keys(source).every(key => ['type', 'request'].includes(key)))
    return { type: 'prepare', request: parseCreativeMilestoneRequest(source.request) }
  if (['confirm', 'abandon'].includes(String(source.type)) && Object.keys(source).every(key => ['type', 'milestoneId', 'project'].includes(key))
    && typeof source.milestoneId === 'string' && /^[\w.:-]{1,128}$/.test(source.milestoneId)) {
    return { type: source.type as 'confirm' | 'abandon', milestoneId: source.milestoneId, project: parseCreativeProject(source.project) }
  }
  throw new TypeError('Invalid milestone command authority')
}

export function parseCreativeMilestoneRequest(value: unknown): CreativeMilestoneRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new TypeError('Invalid milestone request')
  const source = value as Record<string, unknown>
  const allowed = source.operation === 'adopt' ? ['operation', 'artifacts', 'project', 'reason', 'merges'] : ['operation', 'milestoneId', 'project', 'reason']
  if (Object.keys(source).some(key => !allowed.includes(key)) || typeof source.reason !== 'string' || !source.reason.trim() || source.reason.length > 4000)
    throw new TypeError('Invalid milestone reason or authority')
  const project = parseCreativeProject(source.project)
  if (source.operation === 'undo' && typeof source.milestoneId === 'string' && /^[\w.:-]{1,128}$/.test(source.milestoneId))
    return { operation: 'undo', milestoneId: source.milestoneId, project, reason: source.reason }
  if (source.operation !== 'adopt' || !Array.isArray(source.artifacts) || !source.artifacts.length || source.artifacts.length > 256)
    throw new TypeError('Invalid milestone selection')
  const artifacts = source.artifacts.map((item) => {
    if (!item || typeof item !== 'object' || Object.keys(item).some(key => !['artifactId', 'fingerprint'].includes(key))
      || typeof item.artifactId !== 'string' || !item.artifactId.trim() || item.artifactId.length > 200
      || typeof item.fingerprint !== 'string' || !item.fingerprint.trim() || item.fingerprint.length > 200) {
      throw new TypeError('Invalid milestone artifact reference')
    }
    return { artifactId: item.artifactId, fingerprint: item.fingerprint }
  })
  if (new Set(artifacts.map(item => item.artifactId)).size !== artifacts.length)
    throw new TypeError('Duplicate milestone reference')
  return { operation: 'adopt', artifacts, project, reason: source.reason, ...(source.merges === undefined ? {} : { merges: parseCreativeMilestoneMerges(source.merges) }) }
}

/** Reconstruct transformations from immutable artifacts rather than accepting client patches. */
export function creativeMilestoneChanges(run: CreativeTeamRun, intent: Pick<CreativeMilestoneIntent, 'operation' | 'artifacts' | 'targetId' | 'merges'>): CreativeFileChange[] {
  if (intent.operation === 'undo') {
    const target = run.milestones?.find(item => item.id === intent.targetId && item.operation === 'adopt' && item.status === 'confirmed')
    if (!target)
      throw new Error('CREATIVE_MILESTONE_CONFLICT')
    return creativeMilestoneChanges(run, target).map(change => ({ path: change.path, before: change.after, after: change.before }))
  }
  const artifacts = intent.artifacts.map((reference) => {
    const artifact = run.artifacts.find(item => item.id === reference.artifactId && item.fingerprint === reference.fingerprint)
    if (!artifact)
      throw new Error('CREATIVE_MILESTONE_CONFLICT')
    return artifact
  })
  return mergeCreativeMilestoneChanges(artifacts, intent.merges)
}

/** Exact confirmed writes adjust provenance without mutating the original candidate. */
export function creativeArtifactExpectedFiles(artifact: CreativeArtifact, run?: CreativeTeamRun): Record<string, string | null> {
  const files: Record<string, string | null> = { ...artifact.source.files }
  const dependencies = new Set<string>()
  if (artifact.kind === 'art-direction' || artifact.kind === 'voice-direction' || artifact.media) {
    dependencies.add('adv/assets.json')
    dependencies.add('adv.config.json')
  }
  if (artifact.kind === 'voice-direction' || artifact.media?.target.kind === 'voice') {
    for (const path of ['adv/audio/voice-ledger.json', 'adv/audio/pronunciation.json', 'adv/audio/voice-profiles.json', 'adv/settings/game.json'])
      dependencies.add(path)
  }
  if (artifact.output?.kind === 'art-direction') {
    for (const request of artifact.output.requests)
      dependencies.add(request.kind === 'background' ? `adv/scenes/${request.sceneId}.md` : `adv/characters/${request.characterId}.character.md`)
  }
  if (artifact.output?.kind === 'voice-direction') {
    for (const line of artifact.output.lines.filter(item => item.speakerId !== 'narrator'))
      dependencies.add(`adv/characters/${line.speakerId}.character.md`)
  }
  // Known optional reads also depend on absence: creating a dictionary/profile later must expire old voice input.
  for (const path of dependencies)
    files[path] ??= null
  for (const change of artifact.changes)
    files[change.path] ??= change.before
  for (const intent of run?.milestones ?? []) {
    if (intent.status !== 'confirmed' || !intent.anchors.includes(artifact.id))
      continue
    for (const change of creativeMilestoneChanges(run!, intent)) {
      if (change.path in files && files[change.path] === change.before)
        files[change.path] = change.after
    }
  }
  return files
}

export function overlayCreativeMilestone(files: Readonly<Record<string, string>>, changes: readonly CreativeFileChange[]): Record<string, string> {
  const next = { ...files }
  for (const change of changes) {
    if ((next[change.path] ?? null) !== change.before)
      throw new Error(`CREATIVE_SOURCE_CONFLICT:${change.path}`)
    if (change.after === null)
      delete next[change.path]
    else
      next[change.path] = change.after
  }
  return next
}

/** Pure validation; the trusted service stamps IDs, hashes and durable receipts. Media requires separate author-host evidence. */
export function prepareCreativeMilestone(run: CreativeTeamRun, request: CreativeMilestoneRequest): { artifacts: CreativeMilestoneIntent['artifacts'], anchors: string[], changes: CreativeFileChange[], files: Record<string, string> } {
  if (run.status === 'completed' || request.project.id !== run.plan.projectId || run.tasks.some(task => ['running', 'reconcile_required'].includes(task.status)) || run.reservedMicroPoints
    || run.milestones?.some(item => item.status === 'prepared') || (run.milestones?.length ?? 0) >= 128) {
    throw new Error('CREATIVE_MILESTONE_CONFLICT')
  }
  let artifacts: CreativeMilestoneIntent['artifacts']
  let anchors: string[]
  let targetId: string | undefined
  if (request.operation === 'adopt') {
    artifacts = request.artifacts
    const selected = artifacts.map((reference) => {
      const artifact = run.artifacts.find(item => item.id === reference.artifactId && item.fingerprint === reference.fingerprint && item.status === 'selected')
      if (!artifact)
        throw new Error('CREATIVE_MILESTONE_CONFLICT')
      if (requiredCreativeReviewCapabilities(artifact).some(capability => ['catalog-media', 'voice-take'].includes(capability)) && (artifact.kind !== 'media-adoption' || artifact.media?.verification !== 'author-host'))
        throw new Error('CREATIVE_MEDIA_VERIFIER_REQUIRED')
      if (requiredCreativeReviewCapabilities(artifact).includes('voice-settings') && (artifact.output?.kind !== 'voice-direction' || JSON.stringify(creativeOutputFileChanges(artifact.output, request.project.files)) !== JSON.stringify(artifact.changes)))
        throw new Error('CREATIVE_VOICE_SETTINGS_INVALID')
      for (const [path, content] of Object.entries(creativeArtifactExpectedFiles(artifact, run))) {
        if ((request.project.files[path] ?? null) !== content)
          throw new Error(`CREATIVE_SOURCE_CONFLICT:${path}`)
      }
      for (const upstream of artifact.source.upstream) {
        const dependency = run.artifacts.find(item => item.id === upstream.artifactId && item.fingerprint === upstream.fingerprint)
        if (!dependency || !['selected', 'adopted'].includes(dependency.status) || (dependency.changes.length && dependency.status !== 'adopted' && !artifacts.some(item => item.artifactId === dependency.id)))
          throw new Error('CREATIVE_MILESTONE_UPSTREAM_REQUIRED')
      }
      return artifact
    })
    const compatible = new Set(selected.map(item => item.id))
    // Descendants explicitly built from these selected versions retain their source anchors.
    let changed = true
    while (changed) {
      changed = false
      for (const artifact of run.artifacts) {
        if (!compatible.has(artifact.id) && ['candidate', 'selected', 'adopted'].includes(artifact.status) && artifact.source.upstream.some(item => compatible.has(item.artifactId))) {
          compatible.add(artifact.id)
          changed = true
        }
      }
    }
    // Approved ancestors are part of this lineage too. Do not expand their other branches:
    // an unrelated candidate reading the replaced source must still become stale.
    const collectAncestors = (id: string): void => {
      for (const reference of run.artifacts.find(item => item.id === id)?.source.upstream ?? []) {
        if (!compatible.has(reference.artifactId)) {
          compatible.add(reference.artifactId)
          collectAncestors(reference.artifactId)
        }
      }
    }
    selected.forEach(item => collectAncestors(item.id))
    anchors = [...compatible]
  }
  else {
    const confirmed = run.milestones?.filter(item => item.status === 'confirmed') ?? []
    const target = confirmed.at(-1)
    if (!target || target.id !== request.milestoneId || target.operation !== 'adopt' || request.project.revision !== target.afterRevision)
      throw new Error('CREATIVE_UNDO_CONFLICT')
    targetId = target.id
    artifacts = target.artifacts
    anchors = [...target.anchors]
  }
  const merges = request.operation === 'adopt' ? request.merges : undefined
  if (merges) {
    const invalidated = creativeMergeInvalidations(run, artifacts, merges)
    if (artifacts.some(item => invalidated.has(item.artifactId)))
      throw new Error('CREATIVE_MILESTONE_REBASE_REQUIRED')
    anchors = anchors.filter(id => !invalidated.has(id))
  }
  const changes = creativeMilestoneChanges(run, { operation: request.operation, artifacts, targetId, merges })
  if (!changes.length || changes.length > 100)
    throw new Error('CREATIVE_EMPTY_MILESTONE')
  const files = overlayCreativeMilestone(request.project.files, changes)
  if (request.operation === 'adopt' && artifacts.some(reference => run.artifacts.find(item => item.id === reference.artifactId)?.kind === 'media-adoption'))
    anchors = [...new Set([...anchors, ...compatibleCreativeMediaArtifacts(run, files)])]
  return { artifacts, anchors, changes, files }
}
