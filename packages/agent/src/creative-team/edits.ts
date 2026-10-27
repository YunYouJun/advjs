import type { CreativeArtifact, CreativeTeamHandoff, CreativeTeamRun } from './contracts'
import type { CreativePartnerOutput } from './outputs'
import { creativeArtifactExpectedFiles } from './milestones'
import { creativeOutputFileChanges, parseCreativePartnerOutput } from './outputs'
import { requiredCreativeReviewCapabilities } from './validation'

export type CreativeEditableOutput = Extract<CreativePartnerOutput, { kind: 'characters' | 'chapter' | 'voice-direction' }>
export interface CreativeCandidateEditRequest {
  artifactId: string
  fingerprint: string
  reason: string
  output: CreativeEditableOutput
}

export interface CreativeCandidateEditInput extends Omit<CreativeCandidateEditRequest, 'output'> { output: unknown }

export function parseCreativeCandidateEditRequest(value: unknown): CreativeCandidateEditInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).some(key => !['artifactId', 'fingerprint', 'reason', 'output'].includes(key))) {
    throw new TypeError('Invalid author revision request')
  }
  const source = value as Record<string, unknown>
  const text = (key: string, max: number) => {
    if (typeof source[key] !== 'string' || !source[key].trim() || source[key].length > max)
      throw new TypeError('Invalid author revision field')
    return source[key]
  }
  return { artifactId: text('artifactId', 200), fingerprint: text('fingerprint', 200), reason: text('reason', 4000), output: source.output }
}

/** Runtime assigns identity and fingerprint; clients cannot supply paths or provenance. */
export function prepareCreativeCandidateEdit(run: CreativeTeamRun, request: CreativeCandidateEditInput, facts: CreativeTeamHandoff['facts']): Omit<CreativeArtifact, 'id' | 'fingerprint'> {
  const original = run.artifacts.find(item => item.id === request.artifactId && item.fingerprint === request.fingerprint)
  if (!original || !['candidate', 'selected'].includes(original.status) || run.status === 'completed')
    throw new Error('CREATIVE_EDIT_SOURCE_CONFLICT')
  if (!original.output || !['characters', 'chapter', 'voice-direction'].includes(original.output.kind))
    throw new TypeError('This candidate does not support structured author editing')
  if (!request.reason.trim() || request.reason.length > 4000)
    throw new TypeError('An author edit requires a bounded decision reason')
  for (const [path, content] of Object.entries(creativeArtifactExpectedFiles(original, run))) {
    if ((facts.files[path] ?? null) !== content)
      throw new Error('CREATIVE_EDIT_SOURCE_CONFLICT')
  }
  const upstream = original.source.upstream.map((reference) => {
    const artifact = run.artifacts.find(item => item.id === reference.artifactId && item.fingerprint === reference.fingerprint && ['selected', 'adopted'].includes(item.status))
    if (!artifact)
      throw new Error('CREATIVE_EDIT_SOURCE_CONFLICT')
    return artifact
  })
  const files = { ...facts.files }
  for (const artifact of upstream) {
    for (const change of artifact.changes) {
      if ((files[change.path] ?? null) === change.after)
        continue
      if ((files[change.path] ?? null) !== change.before)
        throw new Error('CREATIVE_EDIT_SOURCE_CONFLICT')
      if (change.after === null)
        delete files[change.path]
      else
        files[change.path] = change.after
    }
  }
  for (const change of original.changes) {
    if ((files[change.path] ?? null) !== change.before)
      throw new Error('CREATIVE_EDIT_SOURCE_CONFLICT')
  }
  const characterIds = Object.keys(files).flatMap((path) => {
    const match = /^adv\/characters\/([\w-]+)\.(?:character\.)?md$/.exec(path)
    return match ? [match[1]] : []
  })
  const output = parseCreativePartnerOutput(original.output.kind, request.output, {
    projectId: run.plan.projectId,
    projectRevision: facts.revision,
    files,
    characterIds,
    limits: run.plan.limits,
  }) as CreativeEditableOutput
  const changes = creativeOutputFileChanges(output, files)
  const dependencies = new Set([
    ...Object.keys(original.source.files),
    ...changes.map(change => change.path),
    ...Object.keys(facts.files).filter(path => /^adv\/characters\//.test(path)),
  ])
  const edited: Omit<CreativeArtifact, 'id' | 'fingerprint'> = {
    runId: run.id,
    taskId: original.taskId,
    partner: original.partner,
    projectId: run.plan.projectId,
    kind: original.kind,
    summary: output.summary,
    output,
    changes,
    reviewCapabilities: [],
    status: 'candidate',
    source: { projectId: run.plan.projectId, revision: facts.revision, files: Object.fromEntries([...dependencies].filter(path => path in facts.files).map(path => [path, facts.files[path]])), upstream: original.source.upstream },
    editedFrom: { artifactId: original.id, fingerprint: original.fingerprint },
  }
  edited.reviewCapabilities = requiredCreativeReviewCapabilities(edited)
  return edited
}
