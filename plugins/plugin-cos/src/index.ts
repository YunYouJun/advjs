import type { Buffer } from 'node:buffer'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import process from 'node:process'
import COS from 'cos-nodejs-sdk-v5'

export const ADV_COS_IMMUTABLE_CACHE_CONTROL = 'public, max-age=31536000, immutable'
export const ADV_COS_MANIFEST_CACHE_CONTROL = 'public, max-age=60, must-revalidate'

const HASHED_OBJECT_PATTERN = /\.[0-9a-f]{8,64}\.[a-z0-9]+$/u

export interface CosOptions {
  secretId?: string
  secretKey?: string
  token?: string
  bucket?: string
  region?: string
  /** Remote prefix path in the bucket (default: 'adv/'). Use an empty string for full object keys from a release plan. */
  prefix?: string
}

export interface CosUploadOptions {
  cacheControl?: string
  contentDisposition?: string
  contentType?: string
  /** COS user metadata without the x-cos-meta- prefix. */
  metadata?: Record<string, string>
}

export interface CosObjectInfo {
  cacheControl?: string
  contentLength?: number
  contentType?: string
  etag?: string
  lastModified?: Date
  metadata: Record<string, string>
}

export function contentTypeForObjectKey(objectKey: string): string {
  const extension = objectKey.split('.').at(-1)?.toLowerCase()
  const contentTypes: Record<string, string> = {
    avif: 'image/avif',
    gif: 'image/gif',
    jpeg: 'image/jpeg',
    jpg: 'image/jpeg',
    json: 'application/json; charset=utf-8',
    mp3: 'audio/mpeg',
    ogg: 'audio/ogg',
    png: 'image/png',
    svg: 'image/svg+xml; charset=utf-8',
    webp: 'image/webp',
  }
  return contentTypes[extension ?? ''] ?? 'application/octet-stream'
}

export function isContentHashedObjectKey(objectKey: string): boolean {
  return HASHED_OBJECT_PATTERN.test(objectKey)
}

export function normalizeCosObjectKey(value: string): string {
  const normalized = value.replaceAll('\\', '/')
  if (!normalized || normalized.startsWith('/') || normalized.includes('://'))
    throw new Error(`COS object key must be a non-empty relative path: ${value}`)
  if (normalized.split('/').some(segment => !segment || segment === '.' || segment === '..'))
    throw new Error(`COS object key contains an invalid path segment: ${value}`)
  return normalized
}

export function normalizeCosPrefix(value: string): string {
  if (!value)
    return ''
  return `${normalizeCosObjectKey(value.replace(/\/+$/u, ''))}/`
}

export function defaultUploadOptions(objectKey: string): Required<Pick<CosUploadOptions, 'cacheControl' | 'contentType'>> {
  return {
    cacheControl: isContentHashedObjectKey(objectKey)
      ? ADV_COS_IMMUTABLE_CACHE_CONTROL
      : ADV_COS_MANIFEST_CACHE_CONTROL,
    contentType: contentTypeForObjectKey(objectKey),
  }
}

/** Resolve COS options from environment variables and explicit options. */
function resolveOptions(options: CosOptions): Required<Pick<CosOptions, 'secretId' | 'secretKey' | 'bucket' | 'region'>> & { prefix: string, token?: string } {
  const secretId = options.secretId || process.env.TENCENT_COS_SECRET_ID || process.env.ADV_COS_SECRET_ID || ''
  const secretKey = options.secretKey || process.env.TENCENT_COS_SECRET_KEY || process.env.ADV_COS_SECRET_KEY || ''
  const token = options.token || process.env.TENCENT_COS_TOKEN || process.env.ADV_COS_TOKEN
  const bucket = options.bucket || process.env.TENCENT_COS_BUCKET || process.env.ADV_COS_BUCKET || ''
  const region = options.region || process.env.TENCENT_COS_REGION || process.env.ADV_COS_REGION || ''
  const prefix = normalizeCosPrefix(options.prefix ?? process.env.ADV_COS_PREFIX ?? 'adv/')

  if (!secretId || !secretKey || !bucket || !region) {
    throw new Error(
      'Missing COS credentials. Set TENCENT_COS_SECRET_ID, TENCENT_COS_SECRET_KEY, '
      + 'TENCENT_COS_BUCKET, TENCENT_COS_REGION, and TENCENT_COS_TOKEN for STS credentials.',
    )
  }

  return { secretId, secretKey, bucket, region, prefix, ...(token ? { token } : {}) }
}

function userMetadataHeaders(metadata: Record<string, string> = {}): Record<`x-cos-meta-${string}`, string> {
  return Object.fromEntries(Object.entries(metadata).map(([key, value]) => {
    const normalizedKey = key.toLowerCase().replaceAll('_', '-').replace(/[^a-z0-9-]/gu, '-')
    if (!normalizedKey)
      throw new Error('COS metadata keys must contain an ASCII letter or number')
    return [`x-cos-meta-${normalizedKey}`, value]
  }))
}

export class CosStorage {
  private cos: COS
  private bucket: string
  private region: string
  private prefix: string

  constructor(options: CosOptions = {}) {
    const resolved = resolveOptions(options)
    this.cos = new COS({
      SecretId: resolved.secretId,
      SecretKey: resolved.secretKey,
      ...(resolved.token ? { SecurityToken: resolved.token } : {}),
    })
    this.bucket = resolved.bucket
    this.region = resolved.region
    this.prefix = resolved.prefix
  }

  private objectKey(remotePath: string): string {
    return this.prefix + normalizeCosObjectKey(remotePath)
  }

  /** Upload a local file to COS with browser-safe content metadata. */
  async upload(localPath: string, remotePath: string, options: CosUploadOptions = {}): Promise<void> {
    const key = this.objectKey(remotePath)
    const defaults = defaultUploadOptions(key)
    const file = await stat(localPath)
    const params: COS.PutObjectParams = {
      Bucket: this.bucket,
      Region: this.region,
      Key: key,
      Body: createReadStream(localPath),
      ContentLength: file.size,
      ContentType: options.contentType ?? defaults.contentType,
      CacheControl: options.cacheControl ?? defaults.cacheControl,
      ...(options.contentDisposition ? { ContentDisposition: options.contentDisposition } : {}),
      ...userMetadataHeaders(options.metadata),
    }
    await this.cos.putObject(params)
  }

  /** Download a file from COS to a local path. */
  async download(remotePath: string, localPath: string): Promise<void> {
    const { mkdirSync, writeFileSync } = await import('node:fs')
    const { dirname } = await import('node:path')

    const result = await this.cos.getObject({
      Bucket: this.bucket,
      Region: this.region,
      Key: this.objectKey(remotePath),
    })

    mkdirSync(dirname(localPath), { recursive: true })
    writeFileSync(localPath, result.Body as Buffer)
  }

  /** List all files in COS with a given prefix, including paginated buckets. */
  async list(prefix = ''): Promise<string[]> {
    const endsWithSlash = prefix.endsWith('/')
    const normalizedPrefix = prefix
      ? normalizeCosObjectKey(prefix.replace(/\/+$/u, '')) + (endsWithSlash ? '/' : '')
      : ''
    const fullPrefix = this.prefix + normalizedPrefix
    const allKeys: string[] = []
    let marker: string | undefined

    do {
      const result = await this.cos.getBucket({
        Bucket: this.bucket,
        Region: this.region,
        Prefix: fullPrefix,
        ...(marker ? { Marker: marker } : {}),
      })

      const keys = (result.Contents || [])
        .map(item => item.Key.slice(this.prefix.length))
        .filter(key => key.length > 0)
      allKeys.push(...keys)

      marker = result.IsTruncated === 'true' && result.NextMarker
        ? result.NextMarker
        : undefined
    } while (marker)

    return allKeys
  }

  /** Read object response metadata. Returns null when the object does not exist. */
  async head(remotePath: string): Promise<CosObjectInfo | null> {
    try {
      const result = await this.cos.headObject({
        Bucket: this.bucket,
        Region: this.region,
        Key: this.objectKey(remotePath),
      })
      const headers = (result.headers ?? {}) as Record<string, string | undefined>
      const metadata = Object.fromEntries(Object.entries(headers)
        .filter(([key, value]) => key.toLowerCase().startsWith('x-cos-meta-') && value !== undefined)
        .map(([key, value]) => [key.toLowerCase().slice('x-cos-meta-'.length), value as string]))
      const parsedLength = Number(headers['content-length'])
      return {
        etag: result.ETag,
        ...(headers['last-modified'] ? { lastModified: new Date(headers['last-modified']) } : {}),
        ...(headers['content-type'] ? { contentType: headers['content-type'] } : {}),
        ...(headers['cache-control'] ? { cacheControl: headers['cache-control'] } : {}),
        ...(Number.isFinite(parsedLength) ? { contentLength: parsedLength } : {}),
        metadata,
      }
    }
    catch (error: unknown) {
      if (error && typeof error === 'object' && 'statusCode' in error && (error as { statusCode: number }).statusCode === 404)
        return null
      throw error
    }
  }

  /** Get the last modified time of a remote file, or null when it does not exist. */
  async getLastModified(remotePath: string): Promise<Date | null> {
    return (await this.head(remotePath))?.lastModified ?? null
  }
}
