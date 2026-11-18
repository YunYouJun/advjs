import type { CreativeMediaCandidateRequest, CreativeMediaTarget, CreativeTeamRun } from '@advjs/agent'
import type { CreativeArtImportScope } from './creativeArtImportCache'
import type { CreativeMediaWriteReview } from './creativeMediaRecovery'
import type { CreativeVoiceReview } from './creativeVoiceImport'
import type { IFileSystem } from './fs'
import { computeAgentProjectRevision, creativeMediaCanonical, parseCreativeMediaCandidateRequest } from '@advjs/agent'
import { createStudioCreativeWorkspace } from './creativeTeamWorkspace'

/** Durable POST intent. The original request survives an unknown response unchanged. */
export interface CreativeMediaRegistration {
  id: string
  request: CreativeMediaCandidateRequest
  artifact?: { artifactId: string, fingerprint: string }
  milestoneId?: string
}
export type CreativeMediaSubmit = (request: CreativeMediaCandidateRequest, intentId: string) => Promise<CreativeTeamRun>

export function creativeVoiceMediaTarget(review: Omit<CreativeVoiceReview, 'data'>): Extract<CreativeMediaTarget, { kind: 'voice' }> {
  const content = review.changes.find(item => item.path === 'adv/audio/voice-ledger.json')?.content
  const take = content ? JSON.parse(content).lines?.[review.target.lineId]?.locales?.[review.target.locale]?.takes?.find((item: { id: string }) => item.id === review.takeId) : undefined
  if (!take || typeof take.assetId !== 'string')
    throw new Error('CREATIVE_MEDIA_CANDIDATE_INVALID')
  return { kind: 'voice', phase: 'registered', assetId: take.assetId, lineId: review.target.lineId, locale: review.target.locale, takeId: review.takeId }
}

/** Register only; no binary or source write occurs until the separate milestone review. */
export async function submitCreativeMediaCandidate(options: {
  fs: IFileSystem
  scope: CreativeArtImportScope
  parent: { artifactId: string, fingerprint: string }
  target: CreativeMediaTarget
  review: CreativeMediaWriteReview
  reason: string
  registration?: CreativeMediaRegistration
  save: (registration: CreativeMediaRegistration) => Promise<void>
  submit: CreativeMediaSubmit
  assertCurrent: () => void
}): Promise<CreativeMediaRegistration> {
  let registration = options.registration
  if (!registration) {
    const snapshot = await createStudioCreativeWorkspace(options.fs, options.scope.projectId, { assertCurrent: options.assertCurrent }).snapshot()
    if (snapshot.revision !== options.review.beforeRevision)
      throw new Error('CREATIVE_SOURCE_CONFLICT')
    const writes = Object.fromEntries(options.review.changes.map((item) => {
      if (item.content === null || (snapshot.files[item.path] ?? null) !== item.expected)
        throw new Error('CREATIVE_SOURCE_CONFLICT')
      return [item.path, item.content]
    }))
    if (await computeAgentProjectRevision({ ...snapshot.files, ...writes }) !== options.review.afterRevision)
      throw new Error('CREATIVE_REVIEW_CHANGED')
    registration = { id: crypto.randomUUID(), request: parseCreativeMediaCandidateRequest({ ...options.parent, project: { id: options.scope.projectId, files: snapshot.files, revision: snapshot.revision }, target: options.target, writes, reason: options.reason }) }
    options.assertCurrent()
    await options.save(registration)
  }
  if (registration.request.project.id !== options.scope.projectId || registration.request.artifactId !== options.parent.artifactId || registration.request.fingerprint !== options.parent.fingerprint
    || creativeMediaCanonical(registration.request.target) !== creativeMediaCanonical(options.target) || registration.request.project.revision !== options.review.beforeRevision) {
    throw new Error('CREATIVE_MEDIA_CANDIDATE_INVALID')
  }
  options.assertCurrent()
  const run = await options.submit(registration.request, registration.id)
  options.assertCurrent()
  const decision = run.decisions.find(item => item.id === registration!.id && item.action === 'register-media')
  const artifact = run.artifacts.find(item => item.id === decision?.artifactIds[0])
  if (run.accountId !== options.scope.accountId || run.id !== options.scope.runId || run.plan.projectId !== options.scope.projectId || decision?.artifactIds.length !== 1 || artifact?.kind !== 'media-adoption'
    || !artifact.media || creativeMediaCanonical(artifact.media.parent) !== creativeMediaCanonical(options.parent) || creativeMediaCanonical(artifact.media.target) !== creativeMediaCanonical(options.target)) {
    throw new Error('CREATIVE_MEDIA_CANDIDATE_INVALID')
  }
  registration = { ...registration, artifact: { artifactId: artifact.id, fingerprint: artifact.fingerprint } }
  await options.save(registration)
  options.assertCurrent()
  return registration
}
