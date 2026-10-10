import type { AdvConfig, AdvVoiceLibrary, AdvVoiceLibrarySnapshot, AdvVoiceSelectInput } from '@advjs/types'
import { createHash, randomUUID } from 'node:crypto'
import { readFile, realpath, rename, rm, stat, writeFile } from 'node:fs/promises'
import process from 'node:process'
import { normalizeAdvAssetManifest } from '@advjs/assets'
import { dirname, isAbsolute, relative, resolve } from 'pathe'
import { loadAdvConfig } from '../config'
import { withProjectWriteLock } from '../project/write-lock'
import { AdvCommandError } from './errors'

const HASH = /^[a-f0-9]{64}$/u
const ID = /^[a-z0-9][a-z0-9._-]*$/u
const AUDIO_TYPES = new Set(['audio/wav', 'audio/mpeg', 'audio/ogg'])

function invalid(message: string): never {
  throw new AdvCommandError('ADV_VALIDATION', message)
}

function object(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function within(root: string, target: string): boolean {
  const path = relative(root, target)
  return !isAbsolute(path) && path !== '..' && !path.startsWith('../')
}

async function safeFile(root: string, path: string): Promise<string> {
  if (!path || isAbsolute(path) || /^[a-z]:[\\/]/iu.test(path) || !within(root, resolve(root, path)))
    invalid('Voice file must remain inside the project')
  const target = await realpath(resolve(root, path))
  if (!within(root, target) || !(await stat(target)).isFile())
    invalid('Voice file resolves outside the project or is not a file')
  return target
}

function digest(bytes: string | Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

/** Read versioned identities while retaining all unknown authoring metadata. */
export async function readVoiceLibrary(root: string, path?: string) {
  if (!path)
    invalid('Configure authoring.voice.library before using voice identities')
  const target = await safeFile(root, path)
  const raw = await readFile(target, 'utf8')
  const value: unknown = JSON.parse(raw)
  if (!object(value) || value.schemaVersion !== 1 || !Array.isArray(value.voices))
    invalid('Voice library must declare schemaVersion 1 and voices')
  const ids = new Set<string>()
  for (const voice of value.voices) {
    if (!object(voice) || typeof voice.id !== 'string' || !ID.test(voice.id) || ids.has(voice.id)
      || typeof voice.version !== 'string' || !voice.version.trim()
      || typeof voice.characterId !== 'string' || !ID.test(voice.characterId)
      || typeof voice.label !== 'string' || !voice.label.trim() || !object(voice.implementations)) {
      invalid('Voice identities require unique stable IDs, versions, characters, labels, and implementations')
    }
    ids.add(voice.id)
    for (const [provider, implementation] of Object.entries(voice.implementations)) {
      if (!ID.test(provider) || !object(implementation) || typeof implementation.preset !== 'string' || !implementation.preset.trim()
        || (implementation.character !== undefined && implementation.character !== voice.characterId)
        || (implementation.referenceMode !== undefined && typeof implementation.referenceMode !== 'string')
        || (implementation.presetSha256 !== undefined && (typeof implementation.presetSha256 !== 'string' || !HASH.test(implementation.presetSha256)))) {
        invalid(`Invalid provider implementation for voice ${voice.id}`)
      }
    }
    if (voice.selectedSample !== undefined && (!object(voice.selectedSample)
      || typeof voice.selectedSample.assetId !== 'string' || !voice.selectedSample.assetId.trim()
      || typeof voice.selectedSample.sha256 !== 'string' || !HASH.test(voice.selectedSample.sha256))) {
      invalid(`Invalid selected sample for voice ${voice.id}`)
    }
  }
  return { target, raw, revision: digest(raw), library: value as unknown as AdvVoiceLibrary }
}

/** Normalize native assets while preserving established local-cache hints for older projects. */
export async function readVoiceAssetManifest(root: string, path: string) {
  const target = await safeFile(root, path)
  const source: unknown = JSON.parse(await readFile(target, 'utf8'))
  if (!object(source))
    invalid('Voice assets require a native asset manifest')
  if (source.includes !== undefined && (!Array.isArray(source.includes) || source.assets !== undefined))
    invalid('Voice asset manifest must declare exactly one of assets or includes')
  const entries: unknown[] = source.includes === undefined && Array.isArray(source.assets) ? source.assets : []
  for (const include of (source.includes as unknown[] | undefined) ?? []) {
    if (typeof include !== 'string' || isAbsolute(include) || /^[a-z]:[\\/]/iu.test(include))
      invalid('Voice asset includes must be relative paths')
    const fragmentPath = await safeFile(root, relative(root, resolve(dirname(target), include)))
    const fragment: unknown = JSON.parse(await readFile(fragmentPath, 'utf8'))
    if (!object(fragment) || fragment.schemaVersion !== 2 || !Array.isArray(fragment.assets))
      invalid('Invalid native voice asset fragment')
    entries.push(...fragment.assets)
  }
  const { includes: _includes, ...base } = source
  const manifest = normalizeAdvAssetManifest({ ...base, assets: entries })
  const cachePaths = new Map<string, string>()
  for (const entry of entries) {
    if (object(entry) && typeof entry.id === 'string' && typeof entry.cachePath === 'string')
      cachePaths.set(entry.id, entry.cachePath)
  }
  const profile = object(source.download) && typeof source.download.profile === 'string' ? source.download.profile : undefined
  if (profile && !manifest.profiles[profile])
    invalid('Voice cache profile is not declared in the native manifest')
  return {
    ...manifest,
    download: profile ? { profile } : undefined,
    assets: manifest.assets.map(asset => ({ ...asset, cachePath: cachePaths.get(asset.id) })),
  }
}

/** Shared service options; CLI and local Editor use the same project configuration. */
export interface VoiceLibraryOptions {
  root?: string
  config?: Partial<AdvConfig>
}

async function configuration(options: VoiceLibraryOptions) {
  const root = await realpath(resolve(options.root ?? process.cwd()))
  const { config } = await loadAdvConfig({ userRoot: root, advConfig: options.config })
  return { root, voice: config.authoring?.voice }
}

/** List registered short samples without reading audio, creating files, or downloading media. */
export async function runVoiceSamples(options: VoiceLibraryOptions = {}): Promise<AdvVoiceLibrarySnapshot> {
  const { root, voice } = await configuration(options)
  if (!voice?.library)
    return { configured: false, voices: [], samples: [] }
  const loaded = await readVoiceLibrary(root, voice.library)
  const manifest = await readVoiceAssetManifest(root, voice.assetManifest ?? 'adv/assets.json')
  return {
    configured: true,
    revision: loaded.revision,
    voices: loaded.library.voices,
    samples: manifest.assets.filter(asset => asset.type === 'audio' && asset.kind === 'voice').map(asset => ({
      assetId: asset.id,
      characterId: asset.characterId,
      title: asset.title ?? asset.id,
      sha256: asset.sha256,
      bytes: asset.bytes,
      state: asset.state,
    })),
  }
}

/** Read only a registered voice sample and verify its native cache identity. */
export async function readVoiceSample(options: VoiceLibraryOptions, assetId: string) {
  const { root, voice } = await configuration(options)
  const manifest = await readVoiceAssetManifest(root, voice?.assetManifest ?? 'adv/assets.json')
  const asset = manifest.assets.find(item => item.id === assetId)
  if (!asset || asset.type !== 'audio' || asset.kind !== 'voice' || !asset.sha256 || !HASH.test(asset.sha256)
    || !asset.bytes || asset.bytes > 20 * 1024 * 1024 || !AUDIO_TYPES.has(asset.mimeType ?? '')) {
    invalid('The sample must be a registered voice audio asset with a hash, size, and supported MIME type')
  }
  const profile = manifest.profiles[manifest.download?.profile ?? manifest.defaultProfile]
  let path = asset.cachePath
  let nativeCacheRoot: string | undefined
  if (!path && profile?.provider === 'project' && asset.path) {
    const cacheRoot = resolve(root, profile.root ?? '.')
    nativeCacheRoot = await realpath(cacheRoot)
    const cached = resolve(cacheRoot, asset.path)
    if (!within(root, cacheRoot) || !within(cacheRoot, cached))
      invalid('Voice sample escapes the native cache directory')
    path = relative(root, cached)
  }
  if (!path)
    invalid('Voice sample has no local cache; prepare it through the project asset workflow')
  let target: string
  try {
    target = await safeFile(root, path)
  }
  catch (cause) {
    if (object(cause) && cause.code === 'ENOENT')
      invalid('Voice sample has no local cache; prepare it through the project asset workflow')
    throw cause
  }
  if (nativeCacheRoot && !within(nativeCacheRoot, target))
    invalid('Voice sample symlink escapes the native cache directory')
  if ((await stat(target)).size !== asset.bytes)
    invalid('Voice sample size differs from the asset manifest')
  const bytes = await readFile(target)
  if (digest(bytes) !== asset.sha256)
    invalid('Voice sample checksum differs from the asset manifest')
  return { bytes, mimeType: asset.mimeType!, asset }
}

/** Select one reviewed registered sample; replacing a prior selection is explicit and revision checked. */
export async function runVoiceSelect(options: VoiceLibraryOptions & AdvVoiceSelectInput): Promise<AdvVoiceLibrarySnapshot> {
  const { root, voice } = await configuration(options)
  await withProjectWriteLock(root, async () => {
    const loaded = await readVoiceLibrary(root, voice?.library)
    if (typeof options.expectedRevision !== 'string' || !HASH.test(options.expectedRevision) || loaded.revision !== options.expectedRevision)
      invalid('VOICE_CONFLICT: The voice library changed; reload before selecting')
    const profile = loaded.library.voices.find(item => item.id === options.voiceId)
    if (!profile)
      invalid('Unknown voice identity')
    const sample = await readVoiceSample(options, options.assetId)
    if (sample.asset.state === 'rejected')
      invalid('Rejected audio cannot be selected')
    if (sample.asset.characterId !== profile.characterId)
      invalid('Voice sample belongs to a different character')
    if (profile.selectedSample && (profile.selectedSample.assetId !== sample.asset.id || profile.selectedSample.sha256 !== sample.asset.sha256) && !options.replaceSelected)
      invalid('VOICE_CONFLICT: Replacing an existing sample requires replaceSelected')
    profile.selectedSample = { assetId: sample.asset.id, sha256: sample.asset.sha256! }
    const temporary = `${loaded.target}.${randomUUID()}.tmp`
    try {
      await writeFile(temporary, `${JSON.stringify(loaded.library, null, 2)}\n`, { flag: 'wx' })
      if (digest(await readFile(loaded.target, 'utf8')) !== loaded.revision)
        invalid('VOICE_CONFLICT: The voice library changed during selection')
      await rename(temporary, loaded.target)
    }
    finally {
      await rm(temporary, { force: true })
    }
  })
  return await runVoiceSamples(options)
}
