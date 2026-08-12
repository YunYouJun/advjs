import type cloudbase from '@cloudbase/js-sdk'
import type { IFileSystem } from './fs'

/** Cloud sync utilities backed by the authenticated AdvJS asset authority. */

export interface CosConfig {
  bucket: string
  region: string
  /** @deprecated Permanent credentials are ignored and must never be stored in the browser. */
  secretId?: string
  /** @deprecated Permanent credentials are ignored and must never be stored in the browser. */
  secretKey?: string
}

export interface SyncResult {
  uploaded: number
  downloaded: number
  failed: string[]
}

export interface CloudFileInfo {
  contentType?: string
  key: string
  lastModified: string
  size: number
}

export interface ProjectSyncFile {
  content: Blob
  lastModified: Date
  path: string
}

/** Recursively collects both text and binary project files for managed sync. */
export async function collectProjectFilesForSync(
  fs: Pick<IFileSystem, 'readBlob' | 'readdir'>,
  basePath = '',
): Promise<ProjectSyncFile[]> {
  const files: ProjectSyncFile[] = []
  for (const entry of await fs.readdir(basePath)) {
    if (entry.type === 'directory') {
      if (!entry.name.startsWith('.') && entry.name !== 'node_modules')
        files.push(...await collectProjectFilesForSync(fs, entry.path))
      continue
    }
    try {
      files.push({
        content: await fs.readBlob(entry.path),
        lastModified: new Date(entry.mtime),
        path: entry.path,
      })
    }
    catch {
      // One unreadable file must not prevent the remaining project from syncing.
    }
  }
  return files
}

/**
 * One file flagged as a sync conflict — both the local and cloud copy were
 * modified after the last successful sync, so neither side is clearly newer
 * than a shared baseline. We can't auto-resolve; the user picks per-file.
 */
export interface ConflictFile {
  /** Binary conflicts carry opaque payloads outside the diff model. */
  binary?: boolean
  /** Project-relative path, no `/` prefix (e.g. "adv/world.md"). */
  path: string
  localContent: string
  cloudContent: string
  /** Local mtime in epoch ms. */
  localMtime: number
  /** Cloud lastModified parsed to epoch ms. */
  cloudMtime: number
}

/**
 * Per-path classification produced by `classifySyncCandidates`. A path can
 * be in exactly one of these states relative to the previous sync baseline.
 */
export type SyncDecision
  = | 'upload' // only local changed since baseline
    | 'download' // only cloud changed since baseline
    | 'noop' // neither side changed since baseline
    | 'conflict' // both sides changed since baseline → ConflictFile

export interface SyncCandidate {
  path: string
  decision: SyncDecision
  localMtime?: number
  cloudMtime?: number
}

/**
 * Pure conflict-detection step.
 *
 * Compares each shared path against the project's last-synced baseline:
 *   - both changed since baseline  → 'conflict'
 *   - only local changed           → 'upload'
 *   - only cloud changed           → 'download'
 *   - neither changed              → 'noop'
 *
 * Files only on one side are transferred without prompting (not a conflict).
 *
 * If `baselineMs` is missing (first sync ever), we have no shared point of
 * reference — fall back to the legacy "newer wins" comparison so first-time
 * sync behaves identically to before this feature landed.
 */
export function classifySyncCandidates(opts: {
  localPaths: Map<string, number>
  cloudPaths: Map<string, number>
  baselineMs: number | undefined
}): SyncCandidate[] {
  const { localPaths, cloudPaths, baselineMs } = opts
  const allPaths = new Set<string>([...localPaths.keys(), ...cloudPaths.keys()])
  const out: SyncCandidate[] = []

  for (const path of allPaths) {
    const local = localPaths.get(path)
    const cloud = cloudPaths.get(path)

    if (local !== undefined && cloud === undefined) {
      out.push({ path, decision: 'upload', localMtime: local })
      continue
    }
    if (local === undefined && cloud !== undefined) {
      out.push({ path, decision: 'download', cloudMtime: cloud })
      continue
    }
    if (local === undefined || cloud === undefined)
      continue

    if (baselineMs === undefined) {
      // Legacy newer-wins for first-time sync.
      if (local > cloud)
        out.push({ path, decision: 'upload', localMtime: local, cloudMtime: cloud })
      else if (cloud > local)
        out.push({ path, decision: 'download', localMtime: local, cloudMtime: cloud })
      else
        out.push({ path, decision: 'noop', localMtime: local, cloudMtime: cloud })
      continue
    }

    const localChanged = local > baselineMs
    const cloudChanged = cloud > baselineMs

    if (localChanged && cloudChanged)
      out.push({ path, decision: 'conflict', localMtime: local, cloudMtime: cloud })
    else if (localChanged)
      out.push({ path, decision: 'upload', localMtime: local, cloudMtime: cloud })
    else if (cloudChanged)
      out.push({ path, decision: 'download', localMtime: local, cloudMtime: cloud })
    else
      out.push({ path, decision: 'noop', localMtime: local, cloudMtime: cloud })
  }

  return out
}

let managedCloudApp: cloudbase.app.App | undefined

interface AssetFunctionError {
  code?: string
  message?: string
}

interface AssetFunctionEnvelope {
  error?: AssetFunctionError
  files?: CloudFileInfo[]
  ok?: boolean
  preview?: { expiresAt: string, url: string }
  upload?: {
    expiresAt: string
    headers: Record<string, string>
    uploadId: string
    url: string
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

const CONTENT_TYPES: Record<string, string> = {
  avif: 'image/avif',
  css: 'text/css; charset=utf-8',
  flac: 'audio/flac',
  gif: 'image/gif',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  json: 'application/json',
  m4a: 'audio/mp4',
  md: 'text/markdown; charset=utf-8',
  mp3: 'audio/mpeg',
  mp4: 'video/mp4',
  ogg: 'audio/ogg',
  png: 'image/png',
  svg: 'image/svg+xml',
  txt: 'text/plain; charset=utf-8',
  wav: 'audio/wav',
  webm: 'video/webm',
  webp: 'image/webp',
  yaml: 'application/yaml',
  yml: 'application/yaml',
}

function inferContentType(key: string, content: Blob | string): string {
  if (content instanceof Blob && content.type && content.type !== 'application/octet-stream')
    return content.type
  const extension = key.split('.').at(-1)?.toLowerCase() || ''
  return CONTENT_TYPES[extension] || (typeof content === 'string'
    ? 'text/plain; charset=utf-8'
    : 'application/octet-stream')
}

/** Installs the single CloudBase app used by all managed asset calls. */
export function configureManagedCloudSync(app: cloudbase.app.App): void {
  managedCloudApp = app
}

async function callAssets(data: Record<string, unknown>): Promise<AssetFunctionEnvelope> {
  if (!managedCloudApp)
    throw new Error('Cloud sync is unavailable because CloudBase is not configured.')
  const response = await managedCloudApp.callFunction({ name: 'advjsAssets', data }) as unknown
  const payload = isRecord(response) && isRecord(response.result) ? response.result : undefined
  if (!payload)
    throw new Error('AdvJS asset service returned an invalid response.')
  const envelope = payload as AssetFunctionEnvelope
  if (envelope.error)
    throw new Error(envelope.error.message || envelope.error.code || 'AdvJS asset service failed.')
  if (!envelope.ok)
    throw new Error('AdvJS asset service rejected the request.')
  return envelope
}

/** Checks the authenticated managed-storage authority. */
export async function testConnection(_config: CosConfig): Promise<boolean> {
  await callAssets({ action: 'health' })
  return true
}

/** Uploads through an exact-object short-lived capability and finalizes metadata. */
export async function uploadToCloud(
  _config: CosConfig,
  key: string,
  content: Blob | string,
): Promise<void> {
  const contentType = inferContentType(key, content)
  const body = content instanceof Blob ? content : new Blob([content], { type: contentType })
  const reservation = await callAssets({
    action: 'reserveUpload',
    bytes: body.size,
    contentType,
    key,
  })
  if (!reservation.upload)
    throw new Error('AdvJS asset service did not return an upload capability.')
  const response = await fetch(reservation.upload.url, {
    body,
    headers: reservation.upload.headers,
    method: 'PUT',
  })
  if (!response.ok)
    throw new Error(`Managed upload failed (${response.status}).`)
  await callAssets({ action: 'finalizeUpload', uploadId: reservation.upload.uploadId })
}

/** Downloads binary-safe bytes through a freshly authorized private URL. */
export async function downloadBlobFromCloud(
  _config: CosConfig,
  key: string,
): Promise<Blob> {
  const result = await callAssets({ action: 'createPreview', key })
  if (!result.preview)
    throw new Error('AdvJS asset service did not return a download capability.')
  const response = await fetch(result.preview.url)
  if (!response.ok)
    throw new Error(`Managed download failed (${response.status}).`)
  return response.blob()
}

/** Downloads and decodes one text resource. */
export async function downloadFromCloud(
  config: CosConfig,
  key: string,
): Promise<string> {
  return (await downloadBlobFromCloud(config, key)).text()
}

/** Deletes only unreferenced, unpublished private source assets. */
export async function deleteFromCloud(
  _config: CosConfig,
  key: string,
): Promise<void> {
  await callAssets({ action: 'deleteAsset', key })
}

/** Lists owner-scoped logical keys from the AdvJS metadata catalog. */
export async function listCloudFiles(
  _config: CosConfig,
  prefix: string,
): Promise<string[]> {
  return (await listCloudFilesDetailed(_config, prefix)).map(file => file.key)
}

/** Lists owner-scoped logical keys with verified metadata. */
export async function listCloudFilesDetailed(
  _config: CosConfig,
  prefix: string,
): Promise<CloudFileInfo[]> {
  return (await callAssets({ action: 'listFiles', prefix })).files ?? []
}

/**
 * Batch upload multiple files to COS.
 * Returns a SyncResult with counts and any failed file paths.
 */
export async function uploadProjectToCloud(
  config: CosConfig,
  prefix: string,
  files: { path: string, content: Blob | string }[],
): Promise<SyncResult> {
  const result: SyncResult = { uploaded: 0, downloaded: 0, failed: [] }

  for (const file of files) {
    const key = prefix + file.path
    try {
      await uploadToCloud(config, key, file.content)
      result.uploaded++
    }
    catch {
      result.failed.push(file.path)
    }
  }

  return result
}

/**
 * Batch download all files from COS under a prefix.
 * Returns an array of file paths (relative to prefix) and their contents.
 */
export async function downloadProjectFromCloud(
  config: CosConfig,
  prefix: string,
): Promise<{ path: string, content: string }[]> {
  const keys = await listCloudFiles(config, prefix)
  const files: { path: string, content: string }[] = []

  for (const key of keys) {
    // Skip directory markers (keys ending with /)
    if (key.endsWith('/'))
      continue

    try {
      const content = await downloadFromCloud(config, key)
      const relativePath = key.startsWith(prefix) ? key.slice(prefix.length) : key
      files.push({ path: relativePath, content })
    }
    catch {
      // Skip failed downloads
    }
  }

  return files
}
