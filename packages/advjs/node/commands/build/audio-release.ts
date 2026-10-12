import type { AdvAssetEntry, AdvAssetManifest, VoiceLedger } from '@advjs/types'
import { createHash } from 'node:crypto'
import { readFile, realpath, stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createAdvAssetCatalog, normalizeAdvAssetManifest } from '@advjs/assets'
import { audioObjectKey, canonicalAudioJson, isRuntimeAudioAsset, runtimeAudioAssetIds } from '@advjs/audio'

const MAX_MANIFEST_BYTES = 2 * 1024 * 1024
const HASH = /^[a-f0-9]{64}$/u
const KINDS = ['bgm', 'ambience', 'voice', 'sfx', 'ui']

function fail(reason: string): never {
  throw new Error(`ADV_AUDIO_RELEASE_${reason}`)
}
function fields(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).every(key => keys.includes(key)))
}
function publicUrl(value: string) {
  const url = new URL(value)
  if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) || url.username || url.password || url.search || url.hash)
    fail('PUBLIC_URL_INVALID')
  return url
}
function objectPath(value: unknown): value is string {
  return typeof value === 'string' && Boolean(value) && value.split('/').every(part => /^[a-zA-Z0-9][\w.-]*$/u.test(part) && !['.', '..', '.git', 'node_modules'].includes(part.toLowerCase()))
}

/** Explicit opt-in reads a bounded, hash-pinned public catalog, never private host state. */
export async function loadPublishedAudioManifest(root: string, input: { audioManifest?: string, audioManifestSha256?: string }, transport: { fetch?: typeof globalThis.fetch } = {}): Promise<AdvAssetManifest | undefined> {
  if (input.audioManifest === undefined && input.audioManifestSha256 === undefined)
    return undefined
  if (typeof input.audioManifest !== 'string' || !input.audioManifest || !HASH.test(input.audioManifestSha256 ?? ''))
    fail('MANIFEST_PIN_REQUIRED')
  let bytes: Uint8Array
  if (/^[a-z]+:/iu.test(input.audioManifest)) {
    const response = await (transport.fetch ?? globalThis.fetch)(publicUrl(input.audioManifest), { redirect: 'error', signal: AbortSignal.timeout(15_000), headers: { accept: 'application/json' } })
    if (!response.ok || Number(response.headers.get('content-length')) > MAX_MANIFEST_BYTES || response.headers.get('content-type')?.split(';')[0]?.trim() !== 'application/json')
      fail('MANIFEST_RESPONSE_INVALID')
    const reader = response.body?.getReader()
    if (!reader)
      fail('MANIFEST_RESPONSE_INVALID')
    const chunks: Uint8Array[] = []
    let total = 0
    try {
      while (true) {
        const chunk = await reader.read()
        if (chunk.done)
          break
        total += chunk.value.byteLength
        if (total > MAX_MANIFEST_BYTES)
          fail('MANIFEST_LIMIT')
        chunks.push(chunk.value)
      }
    }
    finally { await reader.cancel() }
    bytes = new Uint8Array(total)
    let offset = 0
    for (const chunk of chunks) {
      bytes.set(chunk, offset)
      offset += chunk.byteLength
    }
  }
  else {
    const path = await realpath(resolve(root, input.audioManifest))
    const info = await stat(path)
    if (!info.isFile() || info.size > MAX_MANIFEST_BYTES)
      fail('MANIFEST_LIMIT')
    bytes = await readFile(path)
    if (bytes.byteLength > MAX_MANIFEST_BYTES)
      fail('MANIFEST_LIMIT')
  }
  if (createHash('sha256').update(bytes).digest('hex') !== input.audioManifestSha256)
    fail('MANIFEST_HASH_CHANGED')
  const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
  canonicalAudioJson(value)
  if (!fields(value, ['schemaVersion', 'id', 'defaultProfile', 'profiles', 'release', 'assets']) || value.schemaVersion !== 2 || typeof value.id !== 'string' || !value.id
    || typeof value.defaultProfile !== 'string' || !fields(value.profiles, [value.defaultProfile]) || Object.keys(value.profiles).length !== 1
    || !fields(value.release, ['provider', 'objectPrefix']) || value.release.provider !== 'tencent-cos' || !objectPath(value.release.objectPrefix)
    || !Array.isArray(value.assets) || !value.assets.length || value.assets.length > 200) {
    fail('MANIFEST_INVALID')
  }
  const profile = value.profiles[value.defaultProfile]
  if (!fields(profile, ['provider', 'baseUrl']) || profile.provider !== 'http' || typeof profile.baseUrl !== 'string' || !publicUrl(profile.baseUrl).pathname.endsWith('/'))
    fail('PUBLIC_PROFILE_INVALID')
  for (const asset of value.assets) {
    if (!fields(asset, ['id', 'type', 'kind', 'sha256', 'variants', 'labels', 'title', 'alt', 'chapterId', 'characterId', 'sceneId', 'duration', 'loop', 'license'])
      || asset.type !== 'audio' || typeof asset.id !== 'string' || !asset.id || typeof asset.kind !== 'string' || !KINDS.includes(asset.kind) || typeof asset.sha256 !== 'string' || !HASH.test(asset.sha256)
      || !fields(asset.variants, ['opus', 'aac']) || Object.keys(asset.variants).length !== 2
      || (asset.duration !== undefined && (typeof asset.duration !== 'number' || !Number.isFinite(asset.duration) || asset.duration <= 0))) {
      fail('ASSET_INVALID')
    }
    for (const [name, variant] of Object.entries(asset.variants)) {
      if (!fields(variant, ['objectKey', 'sha256', 'bytes', 'mimeType']) || !objectPath(variant.objectKey) || !variant.objectKey.startsWith(`${value.release.objectPrefix}/`)
        || typeof variant.sha256 !== 'string' || !HASH.test(variant.sha256) || typeof variant.bytes !== 'number' || !Number.isSafeInteger(variant.bytes) || variant.bytes <= 0
        || variant.mimeType !== (name === 'opus' ? 'audio/webm' : 'audio/mp4')) {
        fail('VARIANT_INVALID')
      }
    }
  }
  if (new Set(value.assets.map(asset => asset.id)).size !== value.assets.length)
    fail('ASSET_DUPLICATE')
  return normalizeAdvAssetManifest(value)
}

/** Native master and adopted take identities remain authoritative; only transport changes. */
export function createPublishedAudioCatalog(native: AdvAssetManifest | undefined, published: AdvAssetManifest, ledger?: VoiceLedger, runtimeAssetIds?: ReadonlySet<string>) {
  if (!native || native.id !== published.id)
    fail('CATALOG_IDENTITY_CHANGED')
  const selected = runtimeAudioAssetIds(ledger)
  const required = native.assets.filter(asset => isRuntimeAudioAsset(asset, selected) && (!runtimeAssetIds || runtimeAssetIds.has(asset.id)))
  if (required.length !== published.assets.length)
    fail('ASSET_SET_CHANGED')
  const prefix = published.release?.objectPrefix
  if (!prefix)
    fail('MANIFEST_INVALID')
  for (const asset of required) {
    const transport = published.assets.find(item => item.id === asset.id)
    if (!transport || transport.type !== asset.type || transport.kind !== asset.kind || !asset.sha256 || asset.sha256 !== transport.sha256)
      fail('MASTER_IDENTITY_CHANGED')
    let voice: { locale: string, speakerId: string, lineId: string, takeId: string } | undefined
    if (asset.kind === 'voice') {
      const bindings = Object.entries(ledger?.lines ?? {}).flatMap(([lineId, line]) => Object.entries(line.locales).flatMap(([locale, binding]) => binding.takes.filter(take => take.id === binding.selectedTake && take.assetId === asset.id).map(take => ({ locale, speakerId: line.speakerId, lineId, takeId: take.id, sha256: take.sha256 }))))
      if (bindings.length !== 1 || bindings[0]!.sha256 !== asset.sha256)
        fail('SELECTED_TAKE_CHANGED')
      const selected = bindings[0]!
      voice = { locale: selected.locale, speakerId: selected.speakerId, lineId: selected.lineId, takeId: selected.takeId }
    }
    for (const variant of ['opus', 'aac'] as const) {
      const source = transport.variants?.[variant]
      const expected = source?.sha256 && audioObjectKey({ projectPrefix: prefix, kind: asset.kind as 'bgm' | 'ambience' | 'voice' | 'sfx' | 'ui', assetId: asset.id, sha256: source.sha256, extension: variant === 'opus' ? 'webm' : 'm4a', ...voice })
      if (!expected || source?.objectKey !== expected)
        fail('OBJECT_IDENTITY_CHANGED')
    }
  }
  return createAdvAssetCatalog(published, { adapter: {
    async resolve(request) {
      if (request.provider !== 'http' || !request.baseUrl || !request.variant)
        throw new Error(`ADV_ASSET_CATALOG_INVALID: asset "${request.asset.id}" has no location for profile "${request.profile}"`)
      return new URL(request.location, request.baseUrl).href
    },
  } })
}

export function publishedAudioAsset(catalog: ReturnType<typeof createPublishedAudioCatalog>, id: string): AdvAssetEntry {
  const asset = catalog.get(id)
  if (!asset)
    fail('ASSET_SET_CHANGED')
  return asset
}
