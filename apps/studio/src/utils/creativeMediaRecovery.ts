import type { IFileSystem } from './fs'
import type { StudioNativeFileChange } from './nativeProjectMutation'
import { computeAgentProjectRevision } from '@advjs/agent'
import { verifyVoiceCandidateBytes } from '@advjs/audio'
import { createStudioCreativeWorkspace } from './creativeTeamWorkspace'
import { commitStudioProjectFiles } from './nativeProjectMutation'

export type CreativeMediaProjectState = 'before' | 'after' | 'partial' | 'conflict'
export interface CreativeMediaWriteReview {
  beforeRevision: string
  afterRevision: string
  changes: readonly StudioNativeFileChange[]
  mediaPath: string
}
export interface CreativeMediaBytes { sha256: string, bytes: number }

/** Closing an unwritten intent never overwrites independent author edits or removes media. */
export async function assertCreativeMediaFilesUnchanged(fs: IFileSystem, projectId: string, review: CreativeMediaWriteReview, destination: 'before' | 'after', assertCurrent: () => void) {
  const snapshot = await createStudioCreativeWorkspace(fs, projectId, { assertCurrent }).snapshot()
  if (review.changes.some(change => (snapshot.files[change.path] ?? null) !== (destination === 'before' ? change.expected : change.content)))
    throw new Error('CREATIVE_MEDIA_RECOVERY_CONFLICT')
  assertCurrent()
}

function assertReview(review: CreativeMediaWriteReview, media: CreativeMediaBytes) {
  if (!/^sha256:[a-f0-9]{64}$/.test(review.beforeRevision) || !/^sha256:[a-f0-9]{64}$/.test(review.afterRevision) || review.beforeRevision === review.afterRevision
    || !review.changes.length || review.changes.length > 100 || new Set(review.changes.map(item => item.path)).size !== review.changes.length
    || !/^[\w./-]+$/.test(review.mediaPath) || review.mediaPath.split('/').some(part => ['', '.', '..'].includes(part))
    || !/^[a-f0-9]{64}$/.test(media.sha256) || !Number.isSafeInteger(media.bytes) || media.bytes <= 0 || media.bytes > 32 * 1024 * 1024) {
    throw new Error('CREATIVE_MEDIA_JOURNAL_INVALID')
  }
}

/** Reconstruct both complete versions from the actual files; every touched byte must be reviewed. */
export async function creativeMediaSourceState(files: Readonly<Record<string, string>>, revision: string, review: Pick<CreativeMediaWriteReview, 'beforeRevision' | 'afterRevision' | 'changes'>): Promise<CreativeMediaProjectState> {
  const before = { ...files }
  const after = { ...files }
  for (const change of review.changes) {
    const actual = files[change.path] ?? null
    if (actual !== change.expected && actual !== change.content)
      return 'conflict'
    if (change.expected === null)
      delete before[change.path]
    else
      before[change.path] = change.expected
    if (change.content === null)
      delete after[change.path]
    else
      after[change.path] = change.content
  }
  if (await computeAgentProjectRevision(before) !== review.beforeRevision || await computeAgentProjectRevision(after) !== review.afterRevision)
    return 'conflict'
  return revision === review.beforeRevision ? 'before' : revision === review.afterRevision ? 'after' : 'partial'
}

/** Read-only reopen, including a crash between any two text or binary writes. */
export async function inspectCreativeMediaWrite(fs: IFileSystem, projectId: string, review: CreativeMediaWriteReview, media: CreativeMediaBytes, assertCurrent: () => void): Promise<CreativeMediaProjectState> {
  assertReview(review, media)
  const snapshot = await createStudioCreativeWorkspace(fs, projectId, { assertCurrent }).snapshot()
  const state = await creativeMediaSourceState(snapshot.files, snapshot.revision, review)
  if (state === 'conflict')
    return state
  if (await fs.exists(review.mediaPath)) {
    try {
      const blob = await fs.readBlob(review.mediaPath)
      if (blob.size !== media.bytes)
        return 'conflict'
      await verifyVoiceCandidateBytes(media, await blob.arrayBuffer())
    }
    catch {
      assertCurrent()
      return 'conflict'
    }
  }
  else if (state === 'after') {
    assertCurrent()
    return 'partial'
  }
  assertCurrent()
  return state
}

/** Explicit recovery only. Recheck the captured partial version under the normal project lock. */
export async function recoverCreativeMediaWrite(options: {
  fs: IFileSystem
  projectId: string
  review: CreativeMediaWriteReview
  media: CreativeMediaBytes
  destination: 'before' | 'after'
  data?: ArrayBuffer
  mimeType: string
  acceptsPath: (path: string) => boolean
  assertCurrent: () => void
}) {
  const { fs, projectId, review, media, assertCurrent } = options
  const state = await inspectCreativeMediaWrite(fs, projectId, review, media, assertCurrent)
  if (state === 'conflict')
    throw new Error('CREATIVE_MEDIA_RECOVERY_CONFLICT')
  const snapshot = await createStudioCreativeWorkspace(fs, projectId, { assertCurrent }).snapshot()
  if (await creativeMediaSourceState(snapshot.files, snapshot.revision, review) === 'conflict')
    throw new Error('CREATIVE_MEDIA_RECOVERY_CONFLICT')
  let blob: Blob | undefined
  if (options.destination === 'after') {
    if (options.data)
      blob = new Blob([options.data], { type: options.mimeType })
    else if (await fs.exists(review.mediaPath))
      blob = await fs.readBlob(review.mediaPath)
    else
      throw new Error('CREATIVE_MEDIA_RECOVERY_BYTES_REQUIRED')
    if (blob.size !== media.bytes)
      throw new Error('CREATIVE_MEDIA_RECOVERY_CONFLICT')
    await verifyVoiceCandidateBytes(media, await blob.arrayBuffer())
  }
  assertCurrent()
  await commitStudioProjectFiles(fs, review.changes.map(change => ({ path: change.path, expected: snapshot.files[change.path] ?? null, content: options.destination === 'after' ? change.content : change.expected })), {
    assertCurrent,
    acceptsPath: options.acceptsPath,
    ...(blob ? { media: { ...media, path: review.mediaPath, blob } } : {}),
    async validateCurrent(scope) {
      const current = await createStudioCreativeWorkspace(scope, projectId, { assertCurrent }).snapshot()
      if (current.revision !== snapshot.revision || await inspectCreativeMediaWrite(scope, projectId, review, media, assertCurrent) === 'conflict')
        throw new Error('CREATIVE_MEDIA_RECOVERY_CONFLICT')
    },
  })
  if (await inspectCreativeMediaWrite(fs, projectId, review, media, assertCurrent) !== options.destination)
    throw new Error('CREATIVE_MEDIA_RECOVERY_INCOMPLETE')
}
