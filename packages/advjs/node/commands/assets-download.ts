import type { AdvAssetDownloadItem, AdvAssetDownloadPlan, AdvAssetDownloadSelection } from '@advjs/assets'
import type { AdvAssetDownloadSource } from '@advjs/types'
import { createHash, randomUUID } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { link, lstat, mkdir, realpath, rm } from 'node:fs/promises'
import { createRequire } from 'node:module'
import process from 'node:process'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { pathToFileURL } from 'node:url'
import { planAdvAssetDownloads } from '@advjs/assets'
import { dirname, resolve } from 'pathe'
import { loadProject, ProjectLoadError } from '../project'
import { AdvCommandError } from './errors'

export type AdvAssetCacheState = 'missing' | 'verified' | 'corrupt'

export interface AdvAssetCacheItem extends AdvAssetDownloadItem {
  state: AdvAssetCacheState
  downloaded?: boolean
}

export interface AdvAssetCacheResult {
  action: 'pull' | 'status' | 'verify'
  root: string
  items: AdvAssetCacheItem[]
  downloaded: number
  verified: number
  missing: number
  corrupt: number
}

export interface AdvAssetCacheOptions extends AdvAssetDownloadSelection {
  root?: string
  /** Node adapter seam for custom storage/signing; never persisted or exposed in results. */
  resolveUrl?: (item: AdvAssetDownloadItem, source: AdvAssetDownloadSource) => Promise<string>
}

function invalid(message: string): AdvCommandError {
  return new AdvCommandError('ADV_VALIDATION', message)
}

function isMissing(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')
}

async function metadata(path: string) {
  try {
    return await lstat(path)
  }
  catch (error) {
    if (isMissing(error))
      return undefined
    throw error
  }
}

async function safeDestination(root: string, path: string): Promise<string> {
  let current = root
  const segments = path.split('/')
  for (const [index, segment] of segments.entries()) {
    current = resolve(current, segment)
    const file = await metadata(current)
    if (file?.isSymbolicLink())
      throw invalid(`Asset cache path contains a symbolic link: ${path}`)
    if (file && (index === segments.length - 1 ? !file.isFile() : !file.isDirectory()))
      throw invalid(`Asset cache path has an incompatible file type: ${path}`)
  }
  return current
}

async function inspect(root: string, item: AdvAssetDownloadItem): Promise<AdvAssetCacheItem> {
  const destination = await safeDestination(root, item.path)
  const file = await metadata(destination)
  if (!file)
    return { ...item, state: 'missing' }
  if (file.size !== item.bytes)
    return { ...item, state: 'corrupt' }
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(destination))
    hash.update(chunk)
  return { ...item, state: hash.digest('hex') === item.sha256 ? 'verified' : 'corrupt' }
}

function requireVerified(items: AdvAssetCacheItem[], allowMissing: boolean): void {
  const bad = items.find(item => item.state === 'corrupt' || (!allowMissing && item.state === 'missing'))
  if (bad)
    throw invalid(`Asset cache ${bad.state}: ${bad.id} (${bad.variant}), ${bad.path}`)
}

async function loadPlan(options: AdvAssetCacheOptions): Promise<{ root: string, plan: AdvAssetDownloadPlan }> {
  const root = await realpath(resolve(options.root ?? process.cwd()))
  const loaded = await loadProject({ root }).catch((error: unknown) => {
    if (error instanceof ProjectLoadError)
      throw invalid(error.message)
    throw error
  })
  const manifest = loaded.result.project.assets
  if (!manifest)
    throw invalid('No valid asset catalog; check adv/assets.json and its includes')
  try {
    return { root, plan: planAdvAssetDownloads(manifest, options) }
  }
  catch (error) {
    throw invalid(error instanceof Error ? error.message : 'Invalid asset download catalog')
  }
}

async function defaultResolver(root: string, source: AdvAssetDownloadSource): Promise<(item: AdvAssetDownloadItem) => Promise<string>> {
  if (source.provider === 'http')
    return async item => new URL(item.objectKey!, source.baseUrl).href
  let plugin: typeof import('@advjs/plugin-cos')
  // Prefer the consumer's optional plugin installation; also support a linked engine workspace.
  try {
    const require = createRequire(resolve(root, 'package.json'))
    plugin = await import(pathToFileURL(require.resolve('@advjs/plugin-cos')).href)
  }
  catch {
    try {
      plugin = await import('@advjs/plugin-cos')
    }
    catch {
      throw new AdvCommandError('ADV_AUTH', 'Private COS downloads require @advjs/plugin-cos; install it in the project')
    }
  }
  if (typeof plugin.createCosDownloadResolver !== 'function')
    throw new AdvCommandError('ADV_AUTH', 'Installed @advjs/plugin-cos does not support asset downloads; update or rebuild it')
  const authorize = plugin.createCosDownloadResolver({ bucket: source.bucket, region: source.region })
  return async (item) => {
    try {
      return await authorize(item.objectKey!)
    }
    catch {
      throw new AdvCommandError('ADV_AUTH', 'Cannot authorize COS download; configure COS environment/STS credentials or ADV_COS_SIGNER')
    }
  }
}

async function* responseChunks(body: NonNullable<Response['body']>): AsyncGenerator<Uint8Array> {
  const reader = body.getReader()
  try {
    while (true) {
      const chunk = await reader.read()
      if (chunk.done)
        return
      yield chunk.value
    }
  }
  finally {
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}

async function download(root: string, item: AdvAssetDownloadItem, url: string): Promise<void> {
  const destination = await safeDestination(root, item.path)
  await mkdir(dirname(destination), { recursive: true })
  await safeDestination(root, item.path)
  const temporary = `${destination}.${randomUUID()}.tmp`
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(60_000) })
    if (!response.ok || !response.body)
      throw new AdvCommandError('ADV_NETWORK', `Asset download failed: ${item.id} (${item.variant}, HTTP ${response.status})`)
    let bytes = 0
    const hash = createHash('sha256')
    const checksum = new Transform({
      transform(chunk, _encoding, callback) {
        bytes += chunk.length
        if (bytes > item.bytes) {
          callback(invalid(`Downloaded asset exceeds declared size: ${item.id} (${item.variant})`))
          return
        }
        hash.update(chunk)
        callback(null, chunk)
      },
    })
    await pipeline(Readable.from(responseChunks(response.body), { objectMode: false }), checksum, createWriteStream(temporary, { flags: 'wx' }))
    if (bytes !== item.bytes || hash.digest('hex') !== item.sha256)
      throw invalid(`Downloaded asset checksum mismatch: ${item.id} (${item.variant})`)
    await safeDestination(root, item.path)
    try {
      // Atomic, exclusive installation: a concurrent writer's destination is never overwritten.
      await link(temporary, destination)
    }
    catch (error) {
      if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 'EEXIST')
        throw error
      requireVerified([await inspect(root, item)], false)
    }
  }
  catch (error) {
    if (error instanceof AdvCommandError)
      throw error
    // Network/adapter errors may contain signed URLs. Keep them out of diagnostics.
    throw new AdvCommandError('ADV_NETWORK', `Cannot download asset: ${item.id} (${item.variant})`)
  }
  finally {
    await rm(temporary, { force: true })
  }
}

/** Inspect, verify or materialize selected catalog entries without modifying the catalog. */
export async function manageAdvAssetCache(action: AdvAssetCacheResult['action'], options: AdvAssetCacheOptions = {}): Promise<AdvAssetCacheResult> {
  const { root, plan } = await loadPlan(options)
  let items: AdvAssetCacheItem[] = []
  for (const item of plan.items)
    items.push(await inspect(root, item))
  if (action !== 'status')
    requireVerified(items, action === 'pull')
  if (action === 'pull' && items.some(item => item.state === 'missing')) {
    if (!plan.source || items.some(item => !item.objectKey))
      throw invalid('Missing assets require download.source and objectKey metadata')
    const resolveUrl = options.resolveUrl
      ? (item: AdvAssetDownloadItem) => options.resolveUrl!(item, plan.source!)
      : await defaultResolver(root, plan.source)
    const pulled: AdvAssetCacheItem[] = []
    for (const item of items) {
      if (item.state === 'missing') {
        await download(root, item, await resolveUrl(item))
        const verified = await inspect(root, item)
        requireVerified([verified], false)
        pulled.push({ ...verified, downloaded: true })
      }
      else {
        pulled.push(item)
      }
    }
    items = pulled
  }
  return {
    action,
    root,
    items,
    downloaded: items.filter(item => item.downloaded).length,
    verified: items.filter(item => item.state === 'verified').length,
    missing: items.filter(item => item.state === 'missing').length,
    corrupt: items.filter(item => item.state === 'corrupt').length,
  }
}
