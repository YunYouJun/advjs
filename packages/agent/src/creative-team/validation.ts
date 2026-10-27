import type { CreativeArtifact, CreativeReviewCapability, CreativeTeamPlan } from './contracts'
import { AGENT_CAPABILITY_IDS } from '../core/contracts'
import { CREATIVE_PARTNER_CAPABILITIES, CREATIVE_PARTNER_IDS, CREATIVE_TEAM_CAPABILITIES, CREATIVE_TEAM_PROTOCOL_VERSION } from './contracts'
import { isCreativeVoiceSettingsPath } from './voice-direction'

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new TypeError('Expected an object')
  return value as Record<string, unknown>
}

function text(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 32000)
    throw new TypeError('Expected non-empty bounded text')
  return value
}

function strings(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 256)
    throw new TypeError('Expected a bounded string array')
  return value.map(text)
}

function taskId(value: unknown): string {
  const id = text(value)
  if (!/^[\w-]{1,64}$/.test(id))
    throw new TypeError('Invalid task identity')
  return id
}

function integer(value: unknown, max: number): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0 || Number(value) > max)
    throw new TypeError('Invalid execution limit')
  return Number(value)
}

function member<const T extends string>(value: unknown, values: readonly T[]): T {
  if (typeof value !== 'string' || !values.includes(value as T))
    throw new TypeError(`Unknown contract value: ${String(value)}`)
  return value as T
}

/** Safe portable source paths; no host code, traversal, URL or private runtime data. */
export function assertCreativeSourcePath(path: string): void {
  if (!/^(?:adv\.config\.json|adv\/(?:world\.md|outline\.md|assets\.json|settings\/game\.json|(?:characters|chapters|scenes|locations|audio|flows|assets)\/[\w-][\w./-]*\.(?:md|json)))$/.test(path)
    || path.split('/').some(segment => segment === '..' || segment === '.' || !segment)) {
    throw new TypeError(`Unsupported creative source path: ${path}`)
  }
}

/** Parse untrusted director output and reject cycles, unknown authority and scope escapes. */
export function parseCreativeTeamPlan(value: unknown, boundary: { projectId: string, projectRevision: string }): CreativeTeamPlan {
  const root = object(value)
  if (root.protocolVersion !== CREATIVE_TEAM_PROTOCOL_VERSION)
    throw new TypeError('Unsupported creative team protocol')
  if (root.projectId !== boundary.projectId || root.projectRevision !== boundary.projectRevision)
    throw new TypeError('Creative plan project boundary mismatch')
  const limits = object(root.limits)
  const parsedLimits = {
    maxTasks: integer(limits.maxTasks, 24),
    maxToolCalls: integer(limits.maxToolCalls, 128),
    maxReworkRounds: integer(limits.maxReworkRounds, 2),
    maxMicroPoints: integer(limits.maxMicroPoints, Number.MAX_SAFE_INTEGER),
  }
  if (!Array.isArray(root.tasks) || !root.tasks.length || root.tasks.length > parsedLimits.maxTasks)
    throw new TypeError('Invalid number of creative tasks')
  const tasks = root.tasks.map((value) => {
    const task = object(value)
    const partner = member(task.partner, CREATIVE_PARTNER_IDS)
    const capability = member(task.capability, [...AGENT_CAPABILITY_IDS, ...CREATIVE_TEAM_CAPABILITIES])
    if (!CREATIVE_PARTNER_CAPABILITIES[partner].includes(capability))
      throw new TypeError('Partner is not authorized for this capability')
    const sourcePaths = strings(task.sourcePaths)
    sourcePaths.forEach(assertCreativeSourcePath)
    if (text(task.instruction).length > 4000 || text(task.expectedOutput).length > 4000)
      throw new TypeError('Creative handoff instruction exceeds the capability context limit')
    return { id: taskId(task.id), partner, capability, dependsOn: strings(task.dependsOn).map(taskId), sourcePaths, instruction: text(task.instruction), expectedOutput: text(task.expectedOutput) }
  })
  const ids = new Set(tasks.map(task => task.id))
  if (ids.size !== tasks.length)
    throw new TypeError('Duplicate task identity')
  const visiting = new Set<string>()
  const visited = new Set<string>()
  const byId = new Map(tasks.map(task => [task.id, task]))
  function visit(id: string): void {
    if (visiting.has(id))
      throw new TypeError('Cyclic task dependencies')
    if (visited.has(id))
      return
    const task = byId.get(id)
    if (!task)
      throw new TypeError('Unknown task dependency')
    visiting.add(id)
    task.dependsOn.forEach(visit)
    visiting.delete(id)
    visited.add(id)
  }
  tasks.forEach(task => visit(task.id))
  return { protocolVersion: CREATIVE_TEAM_PROTOCOL_VERSION, ...boundary, goal: text(root.goal), tasks, limits: parsedLimits }
}

/** Enumerate the workspace/media authority needed to review an output. */
export function requiredCreativeReviewCapabilities(artifact: Pick<CreativeArtifact, 'kind' | 'changes'> & Partial<Pick<CreativeArtifact, 'media'>>): CreativeReviewCapability[] {
  const needed = new Set<CreativeReviewCapability>()
  for (const change of artifact.changes) {
    assertCreativeSourcePath(change.path)
    if (change.before === null && change.after === null)
      throw new TypeError('An empty file change is invalid')
    needed.add(change.before === null ? 'create-source' : change.after === null ? 'delete-source' : 'modify-source')
    if (/^adv\/assets(?:\/|\.json$)/.test(change.path))
      needed.add('catalog-media')
    if (/^adv\/audio\//.test(change.path))
      needed.add(/^adv\/audio\/(?:pronunciation|voice-profiles)\.json$/.test(change.path) ? 'voice-settings' : 'voice-take')
  }
  if (artifact.kind === 'media-adoption')
    needed.add('catalog-media')
  if (artifact.kind === 'voice-direction')
    needed.add(artifact.changes.length && artifact.changes.every(change => isCreativeVoiceSettingsPath(change.path)) ? 'voice-settings' : 'voice-take')
  if (artifact.media?.target.kind === 'voice')
    needed.add('voice-take')
  if (artifact.kind === 'playtest-report' || artifact.kind === 'chapter')
    needed.add('candidate-preview')
  return [...needed].sort()
}

/** Validate handoff identity and the current upstream versions before using a candidate. */
export function assertCreativeArtifactBoundary(artifact: CreativeArtifact, run: { id: string, plan: CreativeTeamPlan, artifacts: readonly CreativeArtifact[] }, options: { allowStaleUpstream?: boolean } = {}): void {
  if (artifact.projectId !== run.plan.projectId || artifact.source.projectId !== run.plan.projectId || artifact.runId !== run.id)
    throw new TypeError('Cross-project or cross-run artifact')
  const task = run.plan.tasks.find(task => task.id === artifact.taskId)
  if (!task || task.partner !== artifact.partner)
    throw new TypeError('Artifact owner mismatch')
  if ((artifact.kind === 'media-adoption') !== Boolean(artifact.media) || (artifact.media && (artifact.output || artifact.legacyResult || !artifact.source.upstream.some(item => item.artifactId === artifact.media!.parent.artifactId && item.fingerprint === artifact.media!.parent.fingerprint))))
    throw new TypeError('Invalid author-host media provenance')
  if (artifact.media) {
    const parent = run.artifacts.find(item => item.id === artifact.media!.parent.artifactId && item.fingerprint === artifact.media!.parent.fingerprint)
    if (!parent || parent.kind !== (artifact.media.target.kind === 'image' ? 'art-direction' : 'voice-direction'))
      throw new TypeError('Invalid author-host media parent')
  }
  if (artifact.editedFrom) {
    const visited = new Set([artifact.id])
    let reference: CreativeArtifact['editedFrom'] = artifact.editedFrom
    while (reference) {
      const parent = run.artifacts.find(item => item.id === reference!.artifactId && item.fingerprint === reference!.fingerprint)
      if (!parent || visited.has(parent.id) || parent.taskId !== artifact.taskId || parent.kind !== artifact.kind || parent.partner !== artifact.partner)
        throw new TypeError('Invalid author revision lineage')
      visited.add(parent.id)
      reference = parent.editedFrom
    }
  }
  requiredCreativeReviewCapabilities(artifact).forEach((capability) => {
    if (!artifact.reviewCapabilities.includes(capability))
      throw new TypeError(`Missing review capability: ${capability}`)
  })
  const ancestors = new Set<string>()
  function collect(id: string): void {
    if (ancestors.has(id))
      return
    ancestors.add(id)
    run.plan.tasks.find(task => task.id === id)?.dependsOn.forEach(collect)
  }
  task.dependsOn.forEach(collect)
  for (const dependency of artifact.source.upstream) {
    const upstream = run.artifacts.find(item => item.id === dependency.artifactId)
    const allowedStatuses = options.allowStaleUpstream ? ['selected', 'adopted', 'stale'] : ['selected', 'adopted']
    const mediaLineage = artifact.kind === 'media-adoption' && artifact.media && upstream?.taskId === artifact.taskId && ((upstream.id === artifact.media.parent.artifactId && upstream.fingerprint === artifact.media.parent.fingerprint && ['art-direction', 'voice-direction'].includes(upstream.kind)) || (upstream.kind === 'media-adoption' && upstream.media?.parent.artifactId === artifact.media.parent.artifactId && upstream.media.parent.fingerprint === artifact.media.parent.fingerprint))
    if (!upstream || (!ancestors.has(upstream.taskId) && !mediaLineage) || upstream.fingerprint !== dependency.fingerprint || !allowedStatuses.includes(upstream.status))
      throw new TypeError('Unavailable or stale upstream artifact')
  }
}
