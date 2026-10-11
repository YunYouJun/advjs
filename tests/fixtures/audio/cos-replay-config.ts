import { isAbsolute } from 'node:path'

export interface CosReplayReceipt {
  project: string
  publication: { manifestUrl: string, revision: string, manifestObjectKey?: string }
  choiceLabel?: string
  branchText?: string
}

/** Public metadata only: no COS SDK, credentials, TTS factory or remote writes. */
export function parseCosReplayReceipt(value: unknown): CosReplayReceipt {
  if (!value || typeof value !== 'object')
    throw new Error('COS_REPLAY_RECEIPT_INVALID')
  const source = value as Partial<CosReplayReceipt>
  if (typeof source.project !== 'string' || !isAbsolute(source.project) || !source.publication || typeof source.publication.manifestUrl !== 'string' || !/^[a-f0-9]{64}$/u.test(source.publication.revision ?? ''))
    throw new Error('COS_REPLAY_RECEIPT_INVALID')
  let url: URL
  try {
    url = new URL(source.publication.manifestUrl)
  }
  catch {
    throw new Error('COS_REPLAY_RECEIPT_INVALID')
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || !/\.cos\.ap-shanghai\.myqcloud\.com$/u.test(url.hostname))
    throw new Error('COS_REPLAY_REAL_PUBLIC_ENDPOINT_REQUIRED')
  return { project: source.project, publication: source.publication, choiceLabel: source.choiceLabel, branchText: source.branchText }
}

export function cosReplayPublicationFile(environment: Record<string, string | undefined>) {
  const path = environment.ADVJS_COS_REPLAY_PUBLICATION
  if (!path)
    return undefined
  if (!isAbsolute(path))
    throw new Error('COS_REPLAY_ABSOLUTE_RECEIPT_REQUIRED')
  return path
}
