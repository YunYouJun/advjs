import type { Buffer } from 'node:buffer'
import { createReadStream } from 'node:fs'
import process from 'node:process'
import COS from 'cos-nodejs-sdk-v5'

export interface CosOptions {
  secretId?: string
  secretKey?: string
  bucket?: string
  region?: string
  /** Remote prefix path in the bucket (default: 'adv/') */
  prefix?: string
}

/**
 * Resolve COS options from environment variables and explicit options.
 */
function resolveOptions(options: CosOptions): Required<Pick<CosOptions, 'secretId' | 'secretKey' | 'bucket' | 'region'>> & { prefix: string } {
  const secretId = options.secretId || process.env.ADV_COS_SECRET_ID || ''
  const secretKey = options.secretKey || process.env.ADV_COS_SECRET_KEY || ''
  const bucket = options.bucket || process.env.ADV_COS_BUCKET || ''
  const region = options.region || process.env.ADV_COS_REGION || ''
  const prefix = options.prefix || 'adv/'

  if (!secretId || !secretKey || !bucket || !region) {
    throw new Error(
      'Missing COS credentials. Set environment variables: '
      + 'ADV_COS_SECRET_ID, ADV_COS_SECRET_KEY, ADV_COS_BUCKET, ADV_COS_REGION',
    )
  }

  return { secretId, secretKey, bucket, region, prefix }
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
    })
    this.bucket = resolved.bucket
    this.region = resolved.region
    this.prefix = resolved.prefix
  }

  /**
   * Upload a local file to COS.
   */
  async upload(localPath: string, remotePath: string): Promise<void> {
    const body = createReadStream(localPath)

    await this.cos.putObject({
      Bucket: this.bucket,
      Region: this.region,
      Key: this.prefix + remotePath,
      Body: body,
    })
  }

  /**
   * Download a file from COS to local path.
   */
  async download(remotePath: string, localPath: string): Promise<void> {
    const { mkdirSync, writeFileSync } = await import('node:fs')
    const { dirname } = await import('node:path')

    const result = await this.cos.getObject({
      Bucket: this.bucket,
      Region: this.region,
      Key: this.prefix + remotePath,
    })

    mkdirSync(dirname(localPath), { recursive: true })
    writeFileSync(localPath, result.Body as Buffer)
  }

  /**
   * List all files in COS with a given prefix.
   * Handles pagination for buckets with more than 1000 objects.
   */
  async list(prefix?: string): Promise<string[]> {
    const fullPrefix = this.prefix + (prefix || '')
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

      // COS returns IsTruncated as string 'true'/'false'
      if (result.IsTruncated === 'true' && result.NextMarker) {
        marker = result.NextMarker
      }
      else {
        marker = undefined
      }
    } while (marker)

    return allKeys
  }

  /**
   * Get the last modified time of a remote file.
   * Returns null if the file does not exist (404).
   */
  async getLastModified(remotePath: string): Promise<Date | null> {
    try {
      const result = await this.cos.headObject({
        Bucket: this.bucket,
        Region: this.region,
        Key: this.prefix + remotePath,
      })
      return result.headers?.['last-modified']
        ? new Date(result.headers['last-modified'] as string)
        : null
    }
    catch (err: unknown) {
      // 404 means file doesn't exist — return null silently
      if (err && typeof err === 'object' && 'statusCode' in err && (err as { statusCode: number }).statusCode === 404)
        return null
      // Re-throw unexpected errors (network, permissions, etc.)
      throw err
    }
  }
}
