#!/usr/bin/env node

import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { isIP } from 'node:net'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

const HASH = /^[a-f0-9]{64}$/u
const MAX_MANIFEST_BYTES = 2 * 1024 * 1024
const MAX_OBJECT_BYTES = 64 * 1024 * 1024
const MAX_TOTAL_BYTES = 512 * 1024 * 1024
const TIMEOUT_MS = 30_000
const READ_METHODS = ['GET', 'HEAD', 'OPTIONS']

class AuditError extends Error {
  constructor(code) {
    super(code)
    this.code = code
  }
}
function fail(code) {
  throw new AuditError(`AUDIO_CLOUD_AUDIT_${code}`)
}
function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}
function localHost(hostname) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/gu, '')
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local'))
    return true
  if (isIP(host) === 4) {
    const [a, b] = host.split('.').map(Number)
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224
  }
  return isIP(host) === 6 && (host === '::' || host === '::1' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe8') || host.startsWith('fe9') || host.startsWith('fea') || host.startsWith('feb') || host.startsWith('::ffff:'))
}
function cloudUrl(value, base = false) {
  if (typeof value !== 'string' || value.length > 2048)
    fail('URL_INVALID')
  let url
  try {
    url = new URL(value)
  }
  catch { fail('URL_INVALID') }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || localHost(url.hostname)
    || /%|\\/u.test(url.pathname) || (base && !url.pathname.endsWith('/'))) { fail('URL_INVALID') }
  return url
}
function tokens(value) {
  return new Set((value ?? '').toLowerCase().split(',').map(part => part.trim()).filter(Boolean))
}
function immutableCache(headers) {
  const directives = [...tokens(headers.get('cache-control'))]
  const maxAge = directives.filter(value => value.startsWith('max-age='))
  if (!directives.includes('public') || !directives.includes('immutable') || maxAge.length !== 1 || !/^max-age=\d+$/u.test(maxAge[0])
    || Number(maxAge[0].slice(8)) < 31536000 || directives.some(value => ['private', 'no-store', 'no-cache'].includes(value) || value.startsWith('private=') || value.startsWith('no-cache='))) { fail('CACHE_INVALID') }
}
function cors(headers, origin, preflight = false, range = false) {
  const allowed = headers.get('access-control-allow-origin')
  if (allowed !== '*' && allowed !== origin)
    fail('CORS_ORIGIN_INVALID')
  if (allowed !== '*' && !tokens(headers.get('vary')).has('origin'))
    fail('CORS_VARY_INVALID')
  if (!preflight)
    return
  const methods = tokens(headers.get('access-control-allow-methods'))
  if (!methods.has('get') || !methods.has('head') || [...methods].some(value => !['get', 'head', 'options'].includes(value)))
    fail('CORS_METHODS_INVALID')
  if (range && !tokens(headers.get('access-control-allow-headers')).has('range') && !tokens(headers.get('access-control-allow-headers')).has('*'))
    fail('CORS_RANGE_INVALID')
}
function objectHeaders(response, expected, origin, partial = false) {
  const { headers } = response
  if (headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() !== expected.mimeType)
    fail('MIME_INVALID')
  if (headers.has('content-encoding') && headers.get('content-encoding')?.toLowerCase() !== 'identity')
    fail('ENCODING_INVALID')
  if (headers.get('x-cos-meta-sha256') !== expected.sha256)
    fail('SHA_METADATA_INVALID')
  const length = headers.get('content-length')
  if (!length || !/^\d+$/u.test(length) || Number(length) !== expected.bytes)
    fail(partial ? 'RANGE_LENGTH_INVALID' : 'SIZE_INVALID')
  immutableCache(headers)
  cors(headers, origin)
}
async function boundedBytes(response, limit) {
  const reader = response.body?.getReader()
  if (!reader)
    fail('BODY_MISSING')
  const chunks = []
  let total = 0
  try {
    while (true) {
      const chunk = await reader.read()
      if (chunk.done)
        break
      total += chunk.value.byteLength
      if (total > limit)
        fail('BODY_LIMIT')
      chunks.push(Buffer.from(chunk.value))
    }
  }
  finally { await reader.cancel().catch(() => {}) }
  return Buffer.concat(chunks, total)
}

/** No credentials or SDK: only explicit public HTTPS GET/HEAD/OPTIONS requests. */
export async function auditCloudAudio(options, transport = {}) {
  let phase = 'input'
  let target
  let objectKey
  const requests = { GET: 0, HEAD: 0, OPTIONS: 0 }
  const connection = transport.fetch ? 'injected-fetch-fixture' : 'https-network'
  const responses = new Set()
  try {
    if (!options || !HASH.test(options.manifestSha256 ?? ''))
      fail('MANIFEST_PIN_REQUIRED')
    const manifestUrl = cloudUrl(options.manifestUrl)
    const sourceBase = cloudUrl(options.sourceBaseUrl, true)
    const publicBase = cloudUrl(options.publicBaseUrl, true)
    const studio = cloudUrl(options.studioOrigin)
    if (studio.href !== `${studio.origin}/` || studio.pathname !== '/')
      fail('STUDIO_ORIGIN_INVALID')
    const origin = studio.origin
    if (manifestUrl.origin !== publicBase.origin || !manifestUrl.pathname.startsWith(publicBase.pathname))
      fail('MANIFEST_BASE_MISMATCH')
    const manifestKey = manifestUrl.pathname.slice(publicBase.pathname.length)
    if (!manifestKey || !manifestKey.split('/').every(part => /^[a-zA-Z0-9][\w.-]*$/u.test(part) && !['.', '..', '.git', 'node_modules'].includes(part.toLowerCase())))
      fail('MANIFEST_PATH_INVALID')
    if (options.timeoutMs !== undefined && (!Number.isSafeInteger(options.timeoutMs) || options.timeoutMs < 1 || options.timeoutMs > TIMEOUT_MS))
      fail('TIMEOUT_INVALID')
    const fetcher = transport.fetch ?? globalThis.fetch
    async function request(url, method, headers = {}) {
      if (!READ_METHODS.includes(method))
        fail('METHOD_INVALID')
      requests[method]++
      const response = await fetcher(url, { method, headers: { origin, 'accept-encoding': 'identity', ...headers }, redirect: 'error', credentials: 'omit', cache: 'no-store', signal: AbortSignal.timeout(options.timeoutMs ?? TIMEOUT_MS) })
      responses.add(response)
      if (response.redirected || (response.url && response.url !== url.href) || (response.status >= 300 && response.status < 400))
        fail('REDIRECT_FORBIDDEN')
      return response
    }
    async function preflight(url) {
      for (const method of ['HEAD', 'GET']) {
        const response = await request(url, 'OPTIONS', { 'access-control-request-method': method, ...(method === 'GET' ? { 'access-control-request-headers': 'range' } : {}) })
        if (response.status !== 200 && response.status !== 204)
          fail('OPTIONS_STATUS_INVALID')
        cors(response.headers, origin, true, method === 'GET')
        await response.body?.cancel()
      }
    }
    async function fullObject(url, expected) {
      const head = await request(url, 'HEAD')
      if (head.status !== 200)
        fail('HEAD_STATUS_INVALID')
      objectHeaders(head, expected, origin)
      const response = await request(url, 'GET')
      if (response.status !== 200)
        fail('GET_STATUS_INVALID')
      objectHeaders(response, expected, origin)
      const bytes = await boundedBytes(response, expected.bytes)
      if (bytes.byteLength !== expected.bytes)
        fail('SIZE_INVALID')
      if (sha256(bytes) !== expected.sha256)
        fail('HASH_CHANGED')
      await preflight(url)
      return bytes
    }
    phase = 'manifest'
    target = 'public'
    const manifestResponse = await request(manifestUrl, 'GET')
    if (manifestResponse.status !== 200)
      fail('GET_STATUS_INVALID')
    const size = manifestResponse.headers.get('content-length')
    if (!size || !/^\d+$/u.test(size) || Number(size) <= 0 || Number(size) > MAX_MANIFEST_BYTES)
      fail('MANIFEST_LIMIT')
    const expectedManifest = { bytes: Number(size), sha256: options.manifestSha256, mimeType: 'application/json' }
    objectHeaders(manifestResponse, expectedManifest, origin)
    const manifestBytes = await boundedBytes(manifestResponse, MAX_MANIFEST_BYTES)
    if (manifestBytes.byteLength !== expectedManifest.bytes || sha256(manifestBytes) !== options.manifestSha256)
      fail('MANIFEST_HASH_CHANGED')
    const { loadPublishedAudioManifest } = await import('advjs/node')
    if (typeof loadPublishedAudioManifest !== 'function')
      fail('RUNTIME_UNAVAILABLE')
    let manifest
    try {
      manifest = await loadPublishedAudioManifest(process.cwd(), { audioManifest: manifestUrl.href, audioManifestSha256: options.manifestSha256 }, { fetch: async () => new Response(manifestBytes, { status: 200, headers: manifestResponse.headers }) })
    }
    catch (error) {
      if (/^ADV_AUDIO_RELEASE_[A-Z_]+$/u.test(error?.message ?? ''))
        throw error
      fail('MANIFEST_INVALID')
    }
    const profile = manifest.profiles[manifest.defaultProfile]
    if (cloudUrl(profile.baseUrl, true).href !== publicBase.href)
      fail('PROFILE_BASE_MISMATCH')
    const publicHead = await request(manifestUrl, 'HEAD')
    if (publicHead.status !== 200)
      fail('HEAD_STATUS_INVALID')
    objectHeaders(publicHead, expectedManifest, origin)
    await preflight(manifestUrl)
    target = 'source'
    const sourceManifest = new URL(manifestKey, sourceBase)
    const sourceBytes = await fullObject(sourceManifest, expectedManifest)
    if (!sourceBytes.equals(manifestBytes))
      fail('MANIFEST_SOURCE_CHANGED')
    const variants = manifest.assets.flatMap(asset => Object.entries(asset.variants).map(([variant, record]) => ({ assetId: asset.id, kind: asset.kind, variant, ...record })))
    if (manifest.id.length > 256 || variants.some(value => value.assetId.length > 256 || value.objectKey.length > 1024))
      fail('PROOF_LIMIT')
    if (variants.some(value => value.bytes > MAX_OBJECT_BYTES) || variants.reduce((total, value) => total + value.bytes * 2, expectedManifest.bytes * 2) > MAX_TOTAL_BYTES)
      fail('OBJECT_BUDGET_EXCEEDED')
    const objects = []
    for (const variant of variants) {
      phase = 'variant'
      objectKey = variant.objectKey
      for (const [name, base] of [['source', sourceBase], ['public', publicBase]]) {
        target = name
        const url = new URL(variant.objectKey, base)
        const bytes = await fullObject(url, variant)
        const end = Math.min(1023, bytes.byteLength - 1)
        const range = await request(url, 'GET', { range: `bytes=0-${end}` })
        if (range.status !== 206)
          fail('RANGE_STATUS_INVALID')
        objectHeaders(range, { ...variant, bytes: end + 1 }, origin, true)
        if (range.headers.get('content-range') !== `bytes 0-${end}/${bytes.byteLength}`)
          fail('RANGE_HEADER_INVALID')
        const rangeBytes = await boundedBytes(range, end + 1)
        if (!rangeBytes.equals(bytes.subarray(0, end + 1)))
          fail('RANGE_BYTES_CHANGED')
      }
      objects.push({ assetId: variant.assetId, variant: variant.variant, objectKey: variant.objectKey, sha256: variant.sha256, bytes: variant.bytes, mimeType: variant.mimeType, sourceVerified: true, publicVerified: true, rangeVerified: true })
    }
    return { schemaVersion: 1, mode: 'read-only-cloud', connection, status: 'passed', manifest: { url: manifestUrl.href, sourceUrl: sourceManifest.href, sha256: options.manifestSha256, bytes: expectedManifest.bytes, catalogId: manifest.id }, studioOrigin: origin, assetCount: manifest.assets.length, variantCount: objects.length, requests, objects }
  }
  catch (error) {
    const code = error instanceof AuditError ? error.code : /^ADV_AUDIO_RELEASE_[A-Z_]+$/u.test(error?.message ?? '') ? error.message : error?.name === 'AbortError' || error?.name === 'TimeoutError' ? 'AUDIO_CLOUD_AUDIT_TIMEOUT' : 'AUDIO_CLOUD_AUDIT_REQUEST_FAILED'
    return { schemaVersion: 1, mode: 'read-only-cloud', connection, status: 'failed', error: { code, phase, ...(target ? { target } : {}), ...(objectKey ? { objectKey } : {}) }, requests }
  }
  finally {
    await Promise.allSettled([...responses].map(response => response.body?.cancel()))
  }
}

export function parseCloudAudioAuditArgs(args) {
  if (!args.length || (args.length === 1 && ['--help', '-h', 'help'].includes(args[0])))
    return { help: true }
  const flags = { '--manifest-url': 'manifestUrl', '--manifest-sha256': 'manifestSha256', '--source-base-url': 'sourceBaseUrl', '--public-base-url': 'publicBaseUrl', '--studio-origin': 'studioOrigin' }
  const options = {}
  for (let index = 0; index < args.length; index += 2) {
    const key = Object.hasOwn(flags, args[index]) ? flags[args[index]] : undefined
    if (!key || options[key] !== undefined || !args[index + 1] || args[index + 1].startsWith('--'))
      fail('ARGUMENT_INVALID')
    options[key] = args[index + 1]
  }
  if (Object.keys(options).length !== Object.keys(flags).length)
    fail('ARGUMENT_REQUIRED')
  return options
}
async function main() {
  try {
    const options = parseCloudAudioAuditArgs(process.argv.slice(2))
    const result = options.help ? { usage: 'node scripts/audit-cloud-audio.mjs --manifest-url <HTTPS URL> --manifest-sha256 <SHA256> --source-base-url <HTTPS COS base/> --public-base-url <HTTPS published profile base/> --studio-origin <HTTPS Studio origin>', methods: READ_METHODS, credentials: false, limits: { manifestBytes: MAX_MANIFEST_BYTES, objectBytes: MAX_OBJECT_BYTES, totalBytes: MAX_TOTAL_BYTES } } : await auditCloudAudio(options)
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
    if (result.status === 'failed')
      process.exitCode = 1
  }
  catch (error) {
    process.stdout.write(`${JSON.stringify({ status: 'failed', error: { code: error instanceof AuditError ? error.code : 'AUDIO_CLOUD_AUDIT_ARGUMENT_INVALID' } })}\n`)
    process.exitCode = 1
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await main()
