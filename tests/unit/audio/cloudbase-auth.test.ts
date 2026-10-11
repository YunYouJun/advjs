// @vitest-environment node
import { Buffer } from 'node:buffer'
import { rm } from 'node:fs/promises'
import { describe, expect, it, vi } from 'vitest'
import { createCloudBaseVoiceSessionAuthenticator } from '../../../packages/advjs/node/audio/cloudbase-auth'
import { createStudioVoiceService } from '../../../packages/advjs/node/audio/server'
import { createEditorVoiceJobsFixture } from '../../fixtures/audio/editor-voice-jobs'

const envId = 'cloud1-fixture-abc123'
const userId = '9876543210123456789'
const endpoint = `https://${envId}.api.tcloudbasegateway.com/auth/v1/user/me`
const token = 'test-only.opaque-access-token'
const rawProfile = {
  sub: userId,
  user_id: userId,
  status: 'ACTIVE',
  providers: [{ id: 'email', provider_user_id: 'test-only@example.org', name: 'Email', picture: '', url: '', meta: {} }],
  name: 'Fixture user',
  email: 'test-only@example.org',
  phone_number: '+86 13000000000',
  groups: [{ id: 'user' }],
  meta: { department: 'fixture' },
  internal_user_type: 'generalUser',
  type: 'external',
  user_source: 1,
}

function profileResponse(value: unknown = rawProfile, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json; charset=utf-8' } })
}
function authenticator(response: () => Response | Promise<Response>) {
  const fetcher = vi.fn<typeof globalThis.fetch>(async () => await response())
  return { fetcher, authenticate: createCloudBaseVoiceSessionAuthenticator({ envId, fetch: fetcher }) }
}

describe('cloudbase authoritative voice session adapter', () => {
  it('uses the fixed official GET endpoint and opaque bearer token, returning only canonical identity', async () => {
    const host = authenticator(() => profileResponse())
    expect(await host.authenticate(token)).toEqual({ accountId: userId })
    const [url, init] = host.fetcher.mock.calls[0]!
    expect(String(url)).toBe(endpoint)
    expect(init).toMatchObject({ method: 'GET', headers: { authorization: `Bearer ${token}`, accept: 'application/json' }, redirect: 'error', credentials: 'omit', cache: 'no-store' })
    expect(init!.signal).toBeInstanceOf(AbortSignal)
    expect(init!.body).toBeUndefined()
  })

  it('accepts raw profiles using sub or user_id and registered custom/provider identities', async () => {
    const { sub: _, ...withoutSub } = rawProfile
    const { user_id: __, ...withoutUserId } = rawProfile
    for (const profile of [withoutSub, withoutUserId, { ...rawProfile, providers: [{ id: 'custom-provider-id' }] }])
      expect(await authenticator(() => profileResponse(profile)).authenticate(token)).toEqual({ accountId: userId })
  })

  it.each([
    { providers: [{ id: 'anonymous' }] },
    { providers: [{ id: 'ANONYMOUS' }] },
    { providers: [] },
    { providers: null },
    { providers: [{ id: 'email' }, { id: 'anonymous' }] },
    { is_anonymous: true },
    { isAnonymous: true },
    { scope: 'openid anonymous' },
    { type: 'anonymous' },
    { internal_user_type: 'anonymous' },
    { status: 'DEFAULT' },
    { status: 'PENDING' },
    { status: 'BLOCKED' },
    { status: 'active' },
    { sub: 'different-user' },
    { sub: null },
    { sub: 'invalid/user', user_id: 'invalid/user' },
    { sub: '..', user_id: '..' },
    { sub: 'x'.repeat(129), user_id: 'x'.repeat(129) },
    { error: 'invalid_access_token' },
  ])('fails closed for anonymous, inactive, conflicting and invalid profiles: %o', async (override) => {
    expect(await authenticator(() => profileResponse({ ...rawProfile, ...override })).authenticate(token)).toBeUndefined()
  })

  it('rejects missing UID/status/provider evidence and nested envelopes instead of guessing an identity', async () => {
    for (const profile of [{ ...rawProfile, sub: undefined, user_id: undefined }, { ...rawProfile, providers: undefined }, { ...rawProfile, status: undefined }, { data: rawProfile }, [rawProfile], null])
      expect(await authenticator(() => profileResponse(profile)).authenticate(token)).toBeUndefined()
  })

  it.each([401, 403, 429, 500, 302])('rejects expired/error/redirect HTTP responses: %s', async (status) => {
    expect(await authenticator(() => profileResponse({ error: 'expired_access_token' }, status)).authenticate(token)).toBeUndefined()
  })

  it('rejects a changed response URL and redirected success without reading its profile', async () => {
    for (const changes of [{ redirected: true }, { url: 'https://untrusted.example.org/auth/v1/user/me' }]) {
      const response = profileResponse()
      for (const [key, value] of Object.entries(changes))
        Object.defineProperty(response, key, { value })
      expect(await authenticator(() => response).authenticate(token)).toBeUndefined()
    }
  })

  it('rejects malformed JSON, invalid UTF-8, incorrect MIME and credential-laden exceptions without logging', async () => {
    const log = vi.spyOn(console, 'log')
    const error = vi.spyOn(console, 'error')
    try {
      for (const response of [new Response('{malformed', { headers: { 'content-type': 'application/json' } }), new Response(new Uint8Array([0xFF]), { headers: { 'content-type': 'application/json' } }), new Response(JSON.stringify(rawProfile), { headers: { 'content-type': 'text/html' } })])
        expect(await authenticator(() => response).authenticate(token)).toBeUndefined()
      expect(await authenticator(() => {
        throw new Error(`supplier exception contains ${token}`)
      }).authenticate(token)).toBeUndefined()
      expect(log).not.toHaveBeenCalled()
      expect(error).not.toHaveBeenCalled()
    }
    finally {
      log.mockRestore()
      error.mockRestore()
    }
  })

  it.each(['', 'Bearer token', 'token\r\nInjected: header', 'token\n', 'token\t', 'ümlaut', 'x'.repeat(8193)])('rejects invalid bearer tokens before any network access: %j', async (invalid) => {
    const host = authenticator(() => profileResponse())
    expect(await host.authenticate(invalid)).toBeUndefined()
    expect(host.fetcher).not.toHaveBeenCalled()
  })

  it.each(['https://cloud1.example.org', 'cloud1.example.org', 'ENV-UPPERCASE', '-env', 'env-', 'env--double', 'env/route', 'env\r\n', 'x'.repeat(64)])('rejects noncanonical environment IDs without outputting or fetching them: %j', (invalid) => {
    const fetcher = vi.fn<typeof globalThis.fetch>()
    expect(() => createCloudBaseVoiceSessionAuthenticator({ envId: invalid, fetch: fetcher })).toThrow('ADV_AUDIO_CLOUDBASE_AUTH_CONFIG_INVALID')
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('enforces declared and streamed 64KiB bounds and cancels oversize bodies', async () => {
    const cancel = vi.fn()
    const body = new ReadableStream<Uint8Array>({ start(controller) {
      controller.enqueue(new Uint8Array(64 * 1024 + 1))
    }, cancel })
    expect(await authenticator(() => new Response(body, { headers: { 'content-type': 'application/json' } })).authenticate(token)).toBeUndefined()
    expect(cancel).toHaveBeenCalledOnce()
    for (const size of ['65537', '-1', 'Infinity', 'invalid'])
      expect(await authenticator(() => new Response(null, { headers: { 'content-type': 'application/json', 'content-length': size } })).authenticate(token)).toBeUndefined()
    const bytes = Buffer.from(JSON.stringify({ ...rawProfile, name: 'x'.repeat(66_000) }))
    expect(await authenticator(() => new Response(bytes, { headers: { 'content-type': 'application/json', 'content-length': '10' } })).authenticate(token)).toBeUndefined()
  })

  it('aborts timed-out verification and never retries it', async () => {
    const fetcher = vi.fn<typeof globalThis.fetch>(async (_, init) => await new Promise<Response>((_, reject) => {
      init!.signal!.addEventListener('abort', () => reject(init!.signal!.reason), { once: true })
    }))
    const authenticate = createCloudBaseVoiceSessionAuthenticator({ envId, fetch: fetcher, timeoutMs: 5 })
    expect(await authenticate(token)).toBeUndefined()
    expect(fetcher).toHaveBeenCalledOnce()
    expect(fetcher.mock.calls[0]![1]!.signal!.aborted).toBe(true)
  })

  it('plugs directly into the real service authentication contract without supplier execution', async () => {
    const source = await createEditorVoiceJobsFixture()
    const host = authenticator(() => profileResponse())
    const service = await createStudioVoiceService({ host: '127.0.0.1', port: 0, stateDirectory: source.storeDirectory, allowedOrigins: ['http://localhost:3388'], authenticate: host.authenticate, projects: [{ accountId: userId, projectId: 'cloudbase-project', root: source.root, config: source.config }] })
    try {
      const address = await service.start()
      const response = await fetch(`${address.url}/v1/audio/projects/cloudbase-project/jobs`, { headers: { authorization: `Bearer ${token}`, origin: 'http://localhost:3388' } })
      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({ accountId: userId, projectId: 'cloudbase-project', configured: true })
      expect(source.calls).toHaveLength(0)
      expect(host.fetcher).toHaveBeenCalledOnce()
    }
    finally {
      await service.stop()
      await rm(source.directory, { recursive: true, force: true })
    }
  })
})
