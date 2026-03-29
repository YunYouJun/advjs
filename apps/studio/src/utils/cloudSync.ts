/**
 * Cloud sync utilities for Tencent COS (browser-side).
 * Uses fetch + Web Crypto API for HMAC-SHA1 signing.
 */

export interface CosConfig {
  bucket: string
  region: string
  secretId: string
  secretKey: string
}

export interface SyncResult {
  uploaded: number
  downloaded: number
  failed: string[]
}

export interface CloudFileInfo {
  key: string
  lastModified: string
  size: number
}

const COS_KEY_REGEX = /<Key>(.*?)<\/Key>/g
const COS_LAST_MODIFIED_REGEX = /<LastModified>(.*?)<\/LastModified>/g
const COS_SIZE_REGEX = /<Size>(.*?)<\/Size>/g

/**
 * Classify COS errors for better user feedback.
 */
function classifyCosError(status: number, statusText: string, url: string): string {
  if (status === 403)
    return 'Access denied (403). Check your SecretId/SecretKey and bucket permissions.'
  if (status === 404)
    return 'Not found (404). Check your bucket name and region.'
  if (status === 0)
    return 'Network error. Check your internet connection and CORS configuration.'
  return `COS error: ${status} ${statusText} (${url})`
}

/**
 * Generate HMAC-SHA1 signature using Web Crypto API.
 */
async function hmacSha1(key: string, message: string): Promise<string> {
  const encoder = new TextEncoder()
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(key),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message))
  return Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Generate SHA-1 hash of content.
 */
async function sha1Hash(content: string): Promise<string> {
  const encoder = new TextEncoder()
  const hash = await crypto.subtle.digest('SHA-1', encoder.encode(content))
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Build COS authorization header.
 * Implements a simplified COS XML API v5 signing scheme.
 *
 * @param config - COS configuration object.
 * @param method - HTTP method (e.g. 'GET', 'PUT').
 * @param path - Request path.
 * @param queryParams - Query parameters to include in the signature (e.g. { 'max-keys': '1' }).
 *   These MUST match the query parameters sent in the actual request, otherwise COS returns 403.
 */
async function buildAuthorization(
  config: CosConfig,
  method: string,
  path: string,
  queryParams: Record<string, string> = {},
): Promise<string> {
  const secretId = config.secretId.trim()
  const secretKey = config.secretKey.trim()

  const now = Math.floor(Date.now() / 1000)
  const expiry = now + 600 // 10 minutes
  const keyTime = `${now};${expiry}`

  // Sort query param keys and build the signed strings
  const sortedKeys = Object.keys(queryParams).sort()
  const qUrlParamList = sortedKeys.join(';')
  const queryString = sortedKeys
    .map(k => `${k}=${encodeURIComponent(queryParams[k])}`)
    .join('&')

  const signKey = await hmacSha1(secretKey, keyTime)
  const httpString = `${method.toLowerCase()}\n${path}\n${queryString}\n\n`
  const httpStringHash = await sha1Hash(httpString)
  const stringToSign = `sha1\n${keyTime}\n${httpStringHash}\n`
  const signature = await hmacSha1(signKey, stringToSign)

  return `q-sign-algorithm=sha1&q-ak=${secretId}&q-sign-time=${keyTime}&q-key-time=${keyTime}&q-header-list=&q-url-param-list=${qUrlParamList}&q-signature=${signature}`
}

function getCosHost(config: CosConfig): string {
  return `${config.bucket}.cos.${config.region}.myqcloud.com`
}

/**
 * Test connection to COS bucket.
 * Performs a HEAD request on the bucket root.
 */
export async function testConnection(config: CosConfig): Promise<boolean> {
  const authorization = await buildAuthorization(config, 'GET', '/', { 'max-keys': '1' })
  const host = getCosHost(config)

  try {
    const response = await fetch(`https://${host}/?max-keys=1`, {
      method: 'GET',
      headers: {
        Authorization: authorization,
      },
    })

    if (!response.ok)
      throw new Error(classifyCosError(response.status, response.statusText, `https://${host}/`))

    return true
  }
  catch (err) {
    if (err instanceof TypeError) {
      // Network/CORS error
      throw new Error('Network error. Check your internet connection and ensure CORS is configured on the COS bucket.')
    }
    throw err
  }
}

/**
 * Upload content to COS.
 */
export async function uploadToCloud(
  config: CosConfig,
  key: string,
  content: string,
): Promise<void> {
  const path = `/${key}`
  const authorization = await buildAuthorization(config, 'PUT', path)
  const host = getCosHost(config)

  try {
    const response = await fetch(`https://${host}${path}`, {
      method: 'PUT',
      headers: {
        'Authorization': authorization,
        'Content-Type': 'text/plain; charset=utf-8',
      },
      body: content,
    })

    if (!response.ok)
      throw new Error(classifyCosError(response.status, response.statusText, `https://${host}${path}`))
  }
  catch (err) {
    if (err instanceof TypeError)
      throw new Error('Network error during upload. Check your connection and CORS configuration.')
    throw err
  }
}

/**
 * Download content from COS.
 */
export async function downloadFromCloud(
  config: CosConfig,
  key: string,
): Promise<string> {
  const path = `/${key}`
  const authorization = await buildAuthorization(config, 'GET', path)
  const host = getCosHost(config)

  try {
    const response = await fetch(`https://${host}${path}`, {
      method: 'GET',
      headers: {
        Authorization: authorization,
      },
    })

    if (!response.ok)
      throw new Error(classifyCosError(response.status, response.statusText, `https://${host}${path}`))

    return response.text()
  }
  catch (err) {
    if (err instanceof TypeError)
      throw new Error('Network error during download. Check your connection and CORS configuration.')
    throw err
  }
}

/**
 * Delete a file from COS.
 */
export async function deleteFromCloud(
  config: CosConfig,
  key: string,
): Promise<void> {
  const path = `/${key}`
  const authorization = await buildAuthorization(config, 'DELETE', path)
  const host = getCosHost(config)

  try {
    const response = await fetch(`https://${host}${path}`, {
      method: 'DELETE',
      headers: {
        Authorization: authorization,
      },
    })

    // COS returns 204 for successful delete, 404 if already gone
    if (!response.ok && response.status !== 404)
      throw new Error(classifyCosError(response.status, response.statusText, `https://${host}${path}`))
  }
  catch (err) {
    if (err instanceof TypeError)
      throw new Error('Network error during delete. Check your connection and CORS configuration.')
    throw err
  }
}

/**
 * List files in COS bucket under a prefix.
 * Returns file keys as strings.
 */
export async function listCloudFiles(
  config: CosConfig,
  prefix: string,
): Promise<string[]> {
  const queryParams = { prefix }
  const authorization = await buildAuthorization(config, 'GET', '/', queryParams)
  const host = getCosHost(config)
  const queryString = `prefix=${encodeURIComponent(prefix)}`

  try {
    const response = await fetch(`https://${host}/?${queryString}`, {
      method: 'GET',
      headers: {
        Authorization: authorization,
      },
    })

    if (!response.ok)
      throw new Error(classifyCosError(response.status, response.statusText, `https://${host}/`))

    const xml = await response.text()
    const keys: string[] = []
    const matches = xml.matchAll(COS_KEY_REGEX)
    for (const match of matches)
      keys.push(match[1])

    return keys
  }
  catch (err) {
    if (err instanceof TypeError)
      throw new Error('Network error listing files. Check your connection and CORS configuration.')
    throw err
  }
}

/**
 * List files in COS bucket with metadata (last modified time, size).
 */
export async function listCloudFilesDetailed(
  config: CosConfig,
  prefix: string,
): Promise<CloudFileInfo[]> {
  const queryParams = { 'prefix': prefix, 'max-keys': '1000' }
  const authorization = await buildAuthorization(config, 'GET', '/', queryParams)
  const host = getCosHost(config)
  const queryString = `prefix=${encodeURIComponent(prefix)}&max-keys=1000`

  try {
    const response = await fetch(`https://${host}/?${queryString}`, {
      method: 'GET',
      headers: {
        Authorization: authorization,
      },
    })

    if (!response.ok)
      throw new Error(classifyCosError(response.status, response.statusText, `https://${host}/`))

    const xml = await response.text()
    const files: CloudFileInfo[] = []

    const keys: string[] = []
    const lastModifieds: string[] = []
    const sizes: number[] = []

    for (const match of xml.matchAll(COS_KEY_REGEX))
      keys.push(match[1])
    for (const match of xml.matchAll(COS_LAST_MODIFIED_REGEX))
      lastModifieds.push(match[1])
    for (const match of xml.matchAll(COS_SIZE_REGEX))
      sizes.push(Number.parseInt(match[1], 10))

    for (let i = 0; i < keys.length; i++) {
      files.push({
        key: keys[i],
        lastModified: lastModifieds[i] || '',
        size: sizes[i] || 0,
      })
    }

    return files
  }
  catch (err) {
    if (err instanceof TypeError)
      throw new Error('Network error listing files. Check your connection and CORS configuration.')
    throw err
  }
}

/**
 * Batch upload multiple files to COS.
 * Returns a SyncResult with counts and any failed file paths.
 */
export async function uploadProjectToCloud(
  config: CosConfig,
  prefix: string,
  files: { path: string, content: string }[],
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
