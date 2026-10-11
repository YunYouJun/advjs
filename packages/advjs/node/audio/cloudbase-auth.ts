import type { StudioVoiceServiceOptions } from './server'
import { Buffer } from 'node:buffer'

const MAX_PROFILE_BYTES = 64 * 1024
const MAX_TOKEN_BYTES = 8192
const MAX_TIMEOUT_MS = 10_000
const UID = /^[\w.:-]{1,128}$/u

export interface CloudBaseVoiceSessionAuthenticatorOptions {
  /** Domestic CloudBase environment ID; no caller-controlled endpoint or URL. */
  envId: string
  fetch?: typeof globalThis.fetch
  timeoutMs?: number
}

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}
function validUid(value: unknown): value is string {
  return typeof value === 'string' && UID.test(value) && value !== '.' && value !== '..'
}
function account(value: unknown): { accountId: string } | undefined {
  if (!record(value) || value.status !== 'ACTIVE' || value.error !== undefined || value.error_code !== undefined)
    return undefined
  const uid = value.sub ?? value.user_id
  if (!validUid(uid) || (value.sub !== undefined && value.user_id !== undefined && value.sub !== value.user_id))
    return undefined
  if (value.is_anonymous === true || value.isAnonymous === true || value.type === 'anonymous' || value.internal_user_type === 'anonymous'
    || (typeof value.scope === 'string' && value.scope.split(/\s+/u).includes('anonymous'))) {
    return undefined
  }
  // An anonymous user has no bound registered identity. Unknown/missing evidence
  // cannot authorize paid authoring work, even when a profile says ACTIVE.
  if (!Array.isArray(value.providers) || !value.providers.length || value.providers.length > 64
    || value.providers.some(provider => !record(provider) || typeof provider.id !== 'string' || !UID.test(provider.id) || provider.id.toLowerCase() === 'anonymous')) {
    return undefined
  }
  return { accountId: uid }
}

/** Verify the opaque user token with CloudBase's authoritative raw v1Profile API. */
export function createCloudBaseVoiceSessionAuthenticator(options: CloudBaseVoiceSessionAuthenticatorOptions): StudioVoiceServiceOptions['authenticate'] {
  if (!options || typeof options.envId !== 'string' || options.envId.length > 63 || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u.test(options.envId)
    || (options.timeoutMs !== undefined && (!Number.isSafeInteger(options.timeoutMs) || options.timeoutMs < 1 || options.timeoutMs > MAX_TIMEOUT_MS))) {
    throw new Error('ADV_AUDIO_CLOUDBASE_AUTH_CONFIG_INVALID')
  }
  const url = new URL(`https://${options.envId}.api.tcloudbasegateway.com/auth/v1/user/me`)
  const fetcher = options.fetch ?? globalThis.fetch
  const timeoutMs = options.timeoutMs ?? MAX_TIMEOUT_MS
  return async (accessToken: string) => {
    if (typeof accessToken !== 'string' || !accessToken.length || accessToken.length > MAX_TOKEN_BYTES || !/^[\w.~+/-]+=*$/u.test(accessToken))
      return undefined
    let response: Response | undefined
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
    try {
      response = await fetcher(url, { method: 'GET', headers: { authorization: `Bearer ${accessToken}`, accept: 'application/json' }, redirect: 'error', credentials: 'omit', cache: 'no-store', signal: AbortSignal.timeout(timeoutMs) })
      if (response.status !== 200 || response.redirected || (response.url && response.url !== url.href)
        || response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() !== 'application/json') {
        return undefined
      }
      const declared = response.headers.get('content-length')
      if (declared !== null && (!/^\d+$/u.test(declared) || Number(declared) > MAX_PROFILE_BYTES))
        return undefined
      reader = response.body?.getReader()
      if (!reader)
        return undefined
      const chunks: Uint8Array[] = []
      let total = 0
      while (true) {
        const chunk = await reader.read()
        if (chunk.done)
          break
        total += chunk.value.byteLength
        if (total > MAX_PROFILE_BYTES)
          return undefined
        chunks.push(chunk.value)
      }
      const bytes = Buffer.concat(chunks, total)
      return account(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)))
    }
    catch {
      // Never log a supplier exception: it may contain an access token or PII.
      return undefined
    }
    finally {
      if (reader)
        await reader.cancel().catch(() => {})
      else
        await response?.body?.cancel().catch(() => {})
    }
  }
}
