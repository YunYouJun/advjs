/** Authenticated audio service requests never carry provider credentials or host paths. */
export interface ManagedVoiceHttpOptions {
  baseUrl: string
  accountId: string
  projectId: string
  getAccessToken: () => Promise<string>
  assertCurrent: () => void
  onSessionExpired?: () => void
  fetch?: typeof globalThis.fetch
}

export function resolveManagedVoiceServiceUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim())
    return undefined
  try {
    const url = new URL(value.trim())
    const local = url.hostname === 'localhost' || url.hostname.endsWith('.localhost') || ['127.0.0.1', '[::1]'].includes(url.hostname)
    if ((url.protocol !== 'https:' && !(local && url.protocol === 'http:')) || url.username || url.password || url.search || url.hash)
      return undefined
    return url.toString().replace(/\/$/u, '')
  }
  catch { return undefined }
}

export function createManagedVoiceHttp(options: ManagedVoiceHttpOptions) {
  const base = resolveManagedVoiceServiceUrl(options.baseUrl)
  if (!base || !/^[\w.:-]{1,128}$/u.test(options.projectId) || !options.accountId.trim())
    throw new Error('AUDIO_SERVICE_CONFIG_INVALID')
  const projectUrl = `${base}/v1/audio/projects/${encodeURIComponent(options.projectId)}`
  const request = options.fetch ?? globalThis.fetch

  async function response(url: string, init: RequestInit) {
    options.assertCurrent()
    const token = await options.getAccessToken()
    options.assertCurrent()
    if (!token)
      throw new Error('AUDIO_SERVICE_LOGIN_REQUIRED')
    const result = await request(url, { ...init, credentials: 'omit', cache: 'no-store', redirect: 'error', headers: { ...init.headers, authorization: `Bearer ${token}` } })
    options.assertCurrent()
    if (result.status === 401) {
      options.onSessionExpired?.()
      throw new Error('AUDIO_SERVICE_LOGIN_REQUIRED')
    }
    return result
  }

  async function json<T>(suffix: string, method: 'GET' | 'POST' = 'GET', body?: unknown, signal?: AbortSignal): Promise<T> {
    if (!/^\/[\w-]+(?:\/[\w-]+)*$/u.test(suffix))
      throw new Error('AUDIO_SERVICE_ROUTE_INVALID')
    const result = await response(`${projectUrl}${suffix}`, { method, signal, ...(body === undefined ? {} : { body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }) })
    const text = await result.text()
    options.assertCurrent()
    if (new TextEncoder().encode(text).byteLength > 2 * 1024 * 1024)
      throw new Error('AUDIO_SERVICE_RESPONSE_LIMIT')
    let value: unknown
    try {
      value = JSON.parse(text)
    }
    catch { throw new Error('AUDIO_SERVICE_RESPONSE_INVALID') }
    if (!result.ok) {
      const error = value && typeof value === 'object' && 'error' in value ? value.error : undefined
      const code = error && typeof error === 'object' && 'code' in error ? error.code : error
      throw new Error(typeof code === 'string' && /^[A-Z][A-Z0-9_]{0,79}$/u.test(code) ? code : 'AUDIO_SERVICE_REQUEST_FAILED')
    }
    return value as T
  }

  async function media(mediaUrl: string, expectedBytes: number, signal?: AbortSignal): Promise<ArrayBuffer> {
    if (!Number.isSafeInteger(expectedBytes) || expectedBytes <= 0 || expectedBytes > 64 * 1024 * 1024)
      throw new Error('AUDIO_SERVICE_MEDIA_LIMIT')
    const target = new URL(mediaUrl, `${base}/`)
    const scopeUrl = new URL(`${projectUrl}/`)
    const route = target.pathname.slice(scopeUrl.pathname.length)
    if (target.origin !== scopeUrl.origin || !target.pathname.startsWith(scopeUrl.pathname) || !/^(?:jobs\/[\w-]+\/media\/[\w-]+|voice-design\/previews\/[\w-]+\/media)$/u.test(route) || target.search || target.hash || target.username || target.password)
      throw new Error('AUDIO_SERVICE_MEDIA_SCOPE_INVALID')
    const result = await response(target.toString(), { method: 'GET', signal })
    if (!result.ok || !result.body)
      throw new Error('AUDIO_SERVICE_MEDIA_UNAVAILABLE')
    const length = result.headers.get('content-length')
    if (length !== null && Number(length) !== expectedBytes)
      throw new Error('VOICE_AUDIO_CHANGED')
    const reader = result.body.getReader()
    const chunks: Uint8Array[] = []
    let count = 0
    try {
      while (true) {
        const next = await reader.read()
        options.assertCurrent()
        if (next.done)
          break
        count += next.value.byteLength
        if (count > expectedBytes)
          throw new Error('VOICE_AUDIO_CHANGED')
        chunks.push(next.value)
      }
      if (count !== expectedBytes)
        throw new Error('VOICE_AUDIO_CHANGED')
      const bytes = new Uint8Array(count)
      let offset = 0
      for (const chunk of chunks) {
        bytes.set(chunk, offset)
        offset += chunk.byteLength
      }
      return bytes.buffer
    }
    finally {
      await reader.cancel().catch(() => {})
      reader.releaseLock()
    }
  }
  async function upload(assetId: string, blob: Blob, sha256: string, signal?: AbortSignal) {
    if (!assetId || assetId.length > 256 || !/^[a-f0-9]{64}$/u.test(sha256) || blob.size <= 0 || blob.size > 64 * 1024 * 1024)
      throw new Error('AUDIO_SERVICE_MEDIA_LIMIT')
    const result = await response(`${projectUrl}/media/${encodeURIComponent(assetId)}`, { method: 'PUT', body: blob, signal, headers: { 'content-type': blob.type || 'application/octet-stream', 'x-advjs-sha256': sha256 } })
    if (!result.ok)
      throw new Error('AUDIO_SERVICE_MEDIA_UPLOAD_FAILED')
  }
  return { json, media, upload, projectUrl }
}
