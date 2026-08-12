import type { AdvAssetEntry, AdvAssetType } from '@advjs/types'

export interface CloudFunctionCaller {
  callFunction: (options: { name: string, data: Record<string, unknown> }) => Promise<{ result?: unknown }>
}

export interface ManagedAssetUploadInput {
  projectId: string
  assetId: string
  fileName: string
  file: Blob
  kind: string
  type: AdvAssetType
}

interface UploadReservation {
  ok: true
  uploadId: string
  objectKey: string
  putUrl: string
  headers?: Record<string, string>
  expiresAt: number
}

interface UploadCompletion {
  ok: true
  asset: AdvAssetEntry
}

export interface ManagedAssetUploader {
  upload: (input: ManagedAssetUploadInput) => Promise<AdvAssetEntry>
}

const PROJECT_ID_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/u
const ASSET_ID_RE = /^[a-z0-9][a-z0-9_/-]{0,127}$/u
const FILE_NAME_RE = /^[^/\\\0]{1,128}$/u

function fail(message: string): Error {
  return new Error(`ADV_ASSET_UPLOAD_FAILED: ${message}`)
}

async function sha256Hex(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

function cloudResult<T>(response: { result?: unknown }): T {
  const result = response.result
  if (!result || typeof result !== 'object')
    throw fail('cloud function returned an invalid response')
  const error = (result as { error?: unknown }).error
  if (typeof error === 'string' && error)
    throw fail(error)
  return result as T
}

export function createManagedAssetUploader(
  cloud: CloudFunctionCaller,
  options: { fetcher?: typeof fetch } = {},
): ManagedAssetUploader {
  const fetcher = options.fetcher ?? fetch

  return {
    async upload(input) {
      if (!PROJECT_ID_RE.test(input.projectId))
        throw fail('projectId is invalid')
      if (!ASSET_ID_RE.test(input.assetId) || input.assetId.includes('..'))
        throw fail('assetId is invalid')
      if (!FILE_NAME_RE.test(input.fileName))
        throw fail('fileName is invalid')
      if (input.file.size <= 0)
        throw fail('file must not be empty')

      const sha256 = await sha256Hex(input.file)
      const mimeType = input.file.type || 'application/octet-stream'
      const reservation = cloudResult<UploadReservation>(await cloud.callFunction({
        name: 'advjsAssets',
        data: {
          action: 'reserveUpload',
          projectId: input.projectId,
          assetId: input.assetId,
          fileName: input.fileName,
          kind: input.kind,
          type: input.type,
          bytes: input.file.size,
          mimeType,
          sha256,
        },
      }))
      if (!reservation.ok || !reservation.uploadId || !reservation.putUrl)
        throw fail('cloud function returned an incomplete reservation')
      if (reservation.expiresAt <= Date.now())
        throw fail('upload reservation already expired')

      const response = await fetcher(reservation.putUrl, {
        method: 'PUT',
        headers: {
          ...reservation.headers,
          'Content-Type': mimeType,
        },
        body: input.file,
      })
      if (!response.ok)
        throw fail(`COS PUT returned ${response.status}`)

      const completion = cloudResult<UploadCompletion>(await cloud.callFunction({
        name: 'advjsAssets',
        data: {
          action: 'completeUpload',
          uploadId: reservation.uploadId,
          sha256,
        },
      }))
      if (!completion.ok || !completion.asset)
        throw fail('cloud function did not complete the asset')
      return completion.asset
    },
  }
}
