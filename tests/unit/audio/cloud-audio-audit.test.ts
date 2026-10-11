// @vitest-environment node
import type { AdvAssetManifest } from '@advjs/types'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import { loadPublishedAudioManifest } from '../../../packages/advjs/node/commands/build/audio-release'
import { auditCloudAudio, parseCloudAudioAuditArgs } from '../../../scripts/audit-cloud-audio.mjs'

vi.mock('advjs/node', () => ({ loadPublishedAudioManifest }))

const hash = (bytes: string | Uint8Array) => createHash('sha256').update(bytes).digest('hex')
const sourceBaseUrl = 'https://example-1234567890.cos.ap-shanghai.myqcloud.com/'
const publicBaseUrl = 'https://media.example.org/'
const studioOrigin = 'https://studio.example.org'
const assetId = 'audio_019d137e-7abc-7000-8000-000000000009'

interface RequestRecord { url: string, init: RequestInit }
interface FixtureObject { bytes: Buffer, headers: Record<string, string> }

/** HTTPS protocol fixture, never contacts a real bucket or uses credentials. */
function fixture(changeManifest?: (manifest: AdvAssetManifest) => void) {
  const objects = new Map<string, FixtureObject>()
  const calls: RequestRecord[] = []
  const manifest: AdvAssetManifest = {
    schemaVersion: 2,
    id: 'audio-cloud-audit-fixture',
    defaultProfile: 'public',
    profiles: { public: { provider: 'http', baseUrl: publicBaseUrl } },
    release: { provider: 'tencent-cos', objectPrefix: 'fixture/cloud' },
    assets: [{ id: assetId, type: 'audio', kind: 'bgm', sha256: hash('original master'), variants: {} }],
  }
  function object(key: string, bytes: Buffer, mimeType: string) {
    const headers = { 'content-type': mimeType, 'content-length': String(bytes.length), 'x-cos-meta-sha256': hash(bytes), 'cache-control': 'IMMUTABLE, max-age=31536000, public', 'access-control-allow-origin': studioOrigin, 'vary': 'Accept-Encoding, Origin' }
    objects.set(key, { bytes, headers })
    return { objectKey: key, sha256: hash(bytes), bytes: bytes.length, mimeType }
  }
  for (const name of ['opus', 'aac'] as const) {
    const bytes = Buffer.from(`${name} actual immutable fixture bytes`.repeat(80))
    const extension = name === 'opus' ? 'webm' : 'm4a'
    manifest.assets[0]!.variants![name] = object(`fixture/cloud/audio/bgm/${assetId}/${hash(bytes)}.${extension}`, bytes, name === 'opus' ? 'audio/webm' : 'audio/mp4')
  }
  changeManifest?.(manifest)
  const bytes = Buffer.from(JSON.stringify(manifest))
  const manifestSha256 = hash(bytes)
  const key = `fixture/cloud/manifests/assets.${manifestSha256}.json`
  object(key, bytes, 'application/json')
  const options = { manifestUrl: new URL(key, publicBaseUrl).href, manifestSha256, sourceBaseUrl, publicBaseUrl, studioOrigin }
  let mutate: ((response: Response, record: RequestRecord) => Response | Promise<Response>) | undefined
  const fetcher: typeof globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input))
    const record = { url: url.href, init: init ?? {} }
    calls.push(record)
    const entry = objects.get(url.pathname.slice(1))
    if (!entry)
      return new Response(null, { status: 404 })
    const headers = new Headers(entry.headers)
    let response: Response
    if (init?.method === 'OPTIONS') {
      headers.set('access-control-allow-methods', 'HEAD, GET, OPTIONS')
      headers.set('access-control-allow-headers', 'Range')
      response = new Response(null, { status: 204, headers })
    }
    else if (init?.method === 'HEAD') {
      response = new Response(null, { status: 200, headers })
    }
    else {
      const range = new Headers(init?.headers).get('range')
      if (range) {
        const end = Number(range.split('-')[1])
        headers.set('content-range', `bytes 0-${end}/${entry.bytes.length}`)
        headers.set('content-length', String(end + 1))
        response = new Response(entry.bytes.subarray(0, end + 1), { status: 206, headers })
      }
      else {
        response = new Response(entry.bytes, { status: 200, headers })
      }
    }
    return mutate ? await mutate(response, record) : response
  }
  return { options, manifest, objects, calls, fetcher, setMutation(value: NonNullable<typeof mutate>) {
    mutate = value
  } }
}

function headersChanged(response: Response, headers: Record<string, string>) {
  const changed = new Headers(response.headers)
  for (const [name, value] of Object.entries(headers))
    changed.set(name, value)
  return new Response(response.body, { status: response.status, headers: changed })
}

describe('bounded credential-free cloud audio audit', () => {
  it('defaults to help, requires an explicit complete pinned configuration and rejects credential flags', () => {
    expect(parseCloudAudioAuditArgs([])).toEqual({ help: true })
    expect(parseCloudAudioAuditArgs(['--help'])).toEqual({ help: true })
    expect(() => parseCloudAudioAuditArgs(['--token', 'private'])).toThrow('ARGUMENT_INVALID')
    expect(() => parseCloudAudioAuditArgs(['--manifest-url', 'https://media.example.org/a.json'])).toThrow('ARGUMENT_REQUIRED')
    const source = fixture()
    expect(parseCloudAudioAuditArgs(Object.entries(source.options).flatMap(([key, value]) => [`--${key.replace(/[A-Z]/gu, letter => `-${letter.toLowerCase()}`)}`, value]))).toEqual(source.options)
  })

  it('uses the strict production manifest loader, verifies both hosts, and proves every variant Range without writes or credentials', async () => {
    const source = fixture()
    const result = await auditCloudAudio(source.options, { fetch: source.fetcher })
    expect(result).toMatchObject({ status: 'passed', connection: 'injected-fetch-fixture', assetCount: 1, variantCount: 2, requests: { GET: 10, HEAD: 6, OPTIONS: 12 } })
    expect(result.objects).toHaveLength(2)
    expect(result.objects).toEqual(expect.arrayContaining([expect.objectContaining({ variant: 'opus', sourceVerified: true, publicVerified: true, rangeVerified: true }), expect.objectContaining({ variant: 'aac', rangeVerified: true })]))
    const rangeCalls = source.calls.filter(record => new Headers(record.init.headers).has('range'))
    expect(rangeCalls).toHaveLength(4)
    expect(new Set(rangeCalls.map(record => new URL(record.url).origin))).toEqual(new Set([new URL(sourceBaseUrl).origin, new URL(publicBaseUrl).origin]))
    for (const record of source.calls) {
      expect(['GET', 'HEAD', 'OPTIONS']).toContain(record.init.method)
      expect(record.init).toMatchObject({ redirect: 'error', credentials: 'omit', cache: 'no-store' })
      expect(new Headers(record.init.headers).get('authorization')).toBeNull()
      expect(new Headers(record.init.headers).get('cookie')).toBeNull()
      expect(record.init.signal).toBeInstanceOf(AbortSignal)
    }
  })

  it.each([
    { manifestUrl: 'https://media.example.org/private.json?sign=SECRET' },
    { sourceBaseUrl: 'http://bucket.example.org/' },
    { publicBaseUrl: 'https://localhost/' },
    { sourceBaseUrl: 'https://127.1/' },
    { sourceBaseUrl: 'https://[::ffff:127.0.0.1]/' },
    { studioOrigin: 'https://studio.example.org/path' },
    { manifestSha256: 'invalid' },
  ])('rejects unsafe inputs before any I/O and never emits signed query contents: %o', async (input) => {
    const source = fixture()
    const result = await auditCloudAudio({ ...source.options, ...input }, { fetch: source.fetcher })
    expect(result.status).toBe('failed')
    expect(source.calls).toHaveLength(0)
    expect(JSON.stringify(result)).not.toContain('SECRET')
  })

  it('rejects a profile mismatch and author/private catalog rows through the existing strict schema', async () => {
    const profile = fixture(manifest => (manifest.profiles.public!.baseUrl = 'https://other.example.org/'))
    expect(await auditCloudAudio(profile.options, { fetch: profile.fetcher })).toMatchObject({ status: 'failed', error: { code: 'AUDIO_CLOUD_AUDIT_PROFILE_BASE_MISMATCH' } })
    const reference = fixture(manifest => (manifest.assets[0]!.kind = 'reference'))
    expect(await auditCloudAudio(reference.options, { fetch: reference.fetcher })).toMatchObject({ status: 'failed', error: { code: 'ADV_AUDIO_RELEASE_ASSET_INVALID' } })
    const privateProfile = fixture(manifest => (manifest.profiles.secondary = { provider: 'project', root: 'private' }))
    expect(await auditCloudAudio(privateProfile.options, { fetch: privateProfile.fetcher })).toMatchObject({ status: 'failed', error: { code: 'ADV_AUDIO_RELEASE_MANIFEST_INVALID' } })
  })

  it.each([
    ['cache-control', 'public, immutable, max-age=60', 'CACHE_INVALID'],
    ['cache-control', 'private, immutable, max-age=31536000', 'CACHE_INVALID'],
    ['x-cos-meta-sha256', '0'.repeat(64), 'SHA_METADATA_INVALID'],
    ['content-type', 'text/plain', 'MIME_INVALID'],
    ['access-control-allow-origin', 'https://untrusted.example.org', 'CORS_ORIGIN_INVALID'],
    ['vary', 'accept-encoding', 'CORS_VARY_INVALID'],
  ])('rejects incompatible immutable/CORS object headers: %s', async (header, value, code) => {
    const source = fixture()
    source.setMutation(response => headersChanged(response, { [header]: value }))
    expect(await auditCloudAudio(source.options, { fetch: source.fetcher })).toMatchObject({ status: 'failed', error: { code: `AUDIO_CLOUD_AUDIT_${code}` } })
  })

  it.each([
    ['access-control-allow-methods', 'GET, HEAD, OPTIONS, PUT', 'CORS_METHODS_INVALID'],
    ['access-control-allow-methods', 'GET, OPTIONS', 'CORS_METHODS_INVALID'],
    ['access-control-allow-headers', 'authorization', 'CORS_RANGE_INVALID'],
  ])('rejects write-enabled or missing public read preflight: %s', async (header, value, code) => {
    const source = fixture()
    source.setMutation((response, record) => record.init.method === 'OPTIONS' ? headersChanged(response, { [header]: value }) : response)
    expect(await auditCloudAudio(source.options, { fetch: source.fetcher })).toMatchObject({ status: 'failed', error: { code: `AUDIO_CLOUD_AUDIT_${code}` } })
    expect(source.calls.every(record => ['GET', 'HEAD', 'OPTIONS'].includes(record.init.method!))).toBe(true)
  })

  it('rejects different source manifest bytes even if HEAD/hash metadata still claims the pin', async () => {
    const source = fixture()
    source.setMutation((response, record) => {
      if (new URL(record.url).origin !== new URL(sourceBaseUrl).origin || record.init.method !== 'GET')
        return response
      const size = Number(response.headers.get('content-length'))
      return new Response(Buffer.alloc(size, 32), { status: response.status, headers: response.headers })
    })
    expect(await auditCloudAudio(source.options, { fetch: source.fetcher })).toMatchObject({ status: 'failed', error: { code: 'AUDIO_CLOUD_AUDIT_HASH_CHANGED', target: 'source', phase: 'manifest' } })
  })

  it.each(['status', 'range', 'bytes'])('checks actual Range 206 payloads rather than trusting %s headers', async (failure) => {
    const source = fixture()
    source.setMutation(async (response, record) => {
      if (!new Headers(record.init.headers).has('range'))
        return response
      if (failure === 'status')
        return new Response(response.body, { status: 200, headers: response.headers })
      if (failure === 'range')
        return headersChanged(response, { 'content-range': 'bytes 0-1023/1' })
      return new Response(Buffer.alloc(Number(response.headers.get('content-length'))), { status: 206, headers: response.headers })
    })
    const code = failure === 'status' ? 'RANGE_STATUS_INVALID' : failure === 'range' ? 'RANGE_HEADER_INVALID' : 'RANGE_BYTES_CHANGED'
    expect(await auditCloudAudio(source.options, { fetch: source.fetcher })).toMatchObject({ status: 'failed', error: { code: `AUDIO_CLOUD_AUDIT_${code}` } })
  })

  it('rejects redirects and sanitizes supplier exception messages', async () => {
    const source = fixture()
    source.setMutation(() => new Response(null, { status: 302, headers: { location: 'https://media.example.org/secret?sign=SECRET' } }))
    expect(await auditCloudAudio(source.options, { fetch: source.fetcher })).toMatchObject({ error: { code: 'AUDIO_CLOUD_AUDIT_REDIRECT_FORBIDDEN' } })
    const result = await auditCloudAudio(source.options, { fetch: async () => {
      throw new Error('https://bucket.example.org/?token=SECRET')
    } })
    expect(result).toMatchObject({ status: 'failed', error: { code: 'AUDIO_CLOUD_AUDIT_REQUEST_FAILED' } })
    expect(JSON.stringify(result)).not.toContain('SECRET')
  })

  it('bounds dishonest bodies and rejects oversized variants before media requests', async () => {
    const source = fixture()
    source.setMutation(response => new Response(new Uint8Array(2 * 1024 * 1024 + 1), { status: 200, headers: response.headers }))
    expect(await auditCloudAudio(source.options, { fetch: source.fetcher })).toMatchObject({ error: { code: 'AUDIO_CLOUD_AUDIT_BODY_LIMIT' } })
    const oversized = fixture(manifest => (manifest.assets[0]!.variants!.opus!.bytes = 64 * 1024 * 1024 + 1))
    expect(await auditCloudAudio(oversized.options, { fetch: oversized.fetcher })).toMatchObject({ error: { code: 'AUDIO_CLOUD_AUDIT_OBJECT_BUDGET_EXCEEDED' } })
    expect(oversized.calls.every(record => record.url.includes('/manifests/'))).toBe(true)
  })

  it('normalizes timeout errors and cancels an unfinished response when header verification fails', async () => {
    const source = fixture()
    const timedOut = await auditCloudAudio(source.options, { fetch: async () => {
      throw new DOMException('PRIVATE supplier URL', 'TimeoutError')
    } })
    expect(timedOut).toMatchObject({ error: { code: 'AUDIO_CLOUD_AUDIT_TIMEOUT' } })
    expect(JSON.stringify(timedOut)).not.toContain('PRIVATE')
    const cancelled = vi.fn()
    const response = new Response(new ReadableStream({ cancel: cancelled }), { status: 200, headers: { 'content-length': '1', 'content-type': 'text/plain' } })
    expect(await auditCloudAudio(source.options, { fetch: async () => response })).toMatchObject({ error: { code: 'AUDIO_CLOUD_AUDIT_MIME_INVALID' } })
    expect(cancelled).toHaveBeenCalledOnce()
  })
})
