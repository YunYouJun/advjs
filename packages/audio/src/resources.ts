import type { AdvAssetEntry, AdvAssetManifest, AdvMusicMetadata, AudioMixerConfig, AudioPronunciationDictionary, AudioVoiceProfiles, CharacterVoiceProfile, RuntimeProgram, VoiceLedger } from '@advjs/types'
import type { AudioProjectFileChange, AudioProjectFilePort, AudioProjectMedia } from './project-files'
import { audioFingerprint, canonicalAudioJson } from './fingerprint'
import { assertAudioId } from './ids'
import { inspectMusicReview, parseMusicMetadata } from './music'
import { audioProjectMediaPath } from './project-media'
import { activeAudioPronunciationDictionary, AUDIO_PRONUNCIATION_PATH, createAudioPronunciationDictionary, parseAudioPronunciationDictionary } from './pronunciation'
import { parseAudioMixerConfig } from './schema'
import { parseVoiceLedger, VOICE_LEDGER_PATH } from './voice-ledger'
import { activeAudioVoiceProfiles, AUDIO_VOICE_PROFILES_PATH, createAudioVoiceProfiles, parseAudioVoiceProfiles } from './voice-profiles'

export const AUDIO_MIXER_PATH = 'adv/audio/mixer.json'
export const audioAssetKinds = ['bgm', 'ambience', 'voice', 'sfx', 'ui', 'reference'] as const
export type AudioAssetKind = typeof audioAssetKinds[number]

/** The native catalog remains the only resource database. */
export interface ProjectAudioSnapshot {
  ledger: VoiceLedger
  catalog: AdvAssetManifest
  mixer: AudioMixerConfig
  pronunciation: AudioPronunciationDictionary
  voiceProfiles: AudioVoiceProfiles
  narratorProfile?: CharacterVoiceProfile
  /** Includes mixer and reference sources; voice read() retains its own revision. */
  revision: string
}

export interface AudioAssetMetadataPatch {
  title?: string | null
  alt?: string | null
  labels?: string[] | null
  license?: string | null
  kind?: AudioAssetKind
  duration?: number | null
  loop?: boolean | null
  bundle?: string | null
  music?: AdvMusicMetadata | null
}

export interface AudioAssetReference {
  type: 'voice-selected' | 'voice-history' | 'voice-reference' | 'mixer-ui' | 'runtime-operation' | 'derived-asset' | 'program-unavailable'
  location: string
  lineId?: string
  locale?: string
  takeId?: string
  chapterId?: string
  nodeId?: string
}

export interface AudioAssetRemovalPreflight {
  assetId: string
  blockingReferences: AudioAssetReference[]
}

export class AudioAssetReferencedError extends Error {
  readonly code = 'AUDIO_ASSET_REFERENCED'
  constructor(readonly preflight: AudioAssetRemovalPreflight) {
    super(`AUDIO_ASSET_REFERENCED: ${preflight.assetId} has ${preflight.blockingReferences.length} blocking reference(s)`)
    this.name = 'AudioAssetReferencedError'
  }
}

export interface AudioAssetRegisterInput {
  expectedRevision: string
  asset: AdvAssetEntry
}

export interface AudioAssetImportInput extends AudioAssetRegisterInput {
  /** File already staged inside the host project, never a browser file name. */
  source: AudioProjectMedia['candidate']
}

const MASTER_FIELDS = ['path', 'objectKey', 'url', 'sha256', 'bytes', 'mimeType', 'variants'] as const
const PATCH_FIELDS = ['title', 'alt', 'labels', 'license', 'kind', 'duration', 'loop', 'bundle', 'music'] as const
const ASSET_FIELDS = ['id', 'type', 'kind', ...MASTER_FIELDS, ...PATCH_FIELDS, 'chapterId', 'characterId', 'sceneId', 'state', 'source'] as const

function clean<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function stableId(value: string) {
  if (!/^\w[\w./-]*$/u.test(value) || value.split('/').some(part => !part || part === '.' || part === '..'))
    throw new Error('AUDIO_ASSET_ID_INVALID: A stable catalog ID is required')
}

function audioAsset(catalog: AdvAssetManifest, id: string) {
  stableId(id)
  const asset = catalog.assets.find(asset => asset.id === id)
  if (!asset || asset.type !== 'audio')
    throw new Error('AUDIO_ASSET_NOT_FOUND: The native audio resource does not exist')
  return asset
}

function canonicalPath(path: string) {
  if (!path || /^(?:[a-z]+:|\/|\\)/iu.test(path) || path.includes('\\') || path.split('/').some(part => !part || ['.', '..', '.git', 'node_modules'].includes(part.toLowerCase())))
    throw new Error('AUDIO_MEDIA_PATH_INVALID: Media coordinates must stay inside the project')
}

function validPatch(patch: AudioAssetMetadataPatch) {
  for (const [key, value] of Object.entries(patch)) {
    if (!PATCH_FIELDS.includes(key as typeof PATCH_FIELDS[number]))
      throw new Error('AUDIO_MASTER_IMMUTABLE: Only reviewed resource metadata can change')
    if (value === null || value === undefined) {
      if (key === 'kind')
        throw new Error('AUDIO_ASSET_METADATA_INVALID: Resource kind cannot be cleared')
      continue
    }
    if (key === 'music') {
      parseMusicMetadata(value)
    }
    else if (key === 'kind') {
      if (!audioAssetKinds.includes(value as AudioAssetKind))
        throw new Error('AUDIO_ASSET_KIND_INVALID: Audio resources use one of the six native kinds')
    }
    else if (key === 'labels') {
      if (!Array.isArray(value) || value.some(label => typeof label !== 'string' || !label.trim()) || new Set(value).size !== value.length)
        throw new Error('AUDIO_ASSET_METADATA_INVALID: Labels must be unique nonempty strings')
    }
    else if (key === 'duration') {
      if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0)
        throw new Error('AUDIO_ASSET_METADATA_INVALID: Duration must be a positive number')
    }
    else if (key === 'loop') {
      if (typeof value !== 'boolean')
        throw new Error('AUDIO_ASSET_METADATA_INVALID: Loop must be a boolean')
    }
    else if (typeof value !== 'string' || !value.trim()) {
      throw new Error('AUDIO_ASSET_METADATA_INVALID: Resource metadata must contain nonempty strings')
    }
  }
  canonicalAudioJson(clean(patch))
}

function validateNewAsset(asset: AdvAssetEntry, catalog: AdvAssetManifest) {
  assertAudioId(asset.id, 'audio')
  if (asset.type !== 'audio' || !audioAssetKinds.includes(asset.kind as AudioAssetKind))
    throw new Error('AUDIO_ASSET_KIND_INVALID: Audio resources use one of the six native kinds')
  if (catalog.assets.some(existing => existing.id === asset.id))
    throw new Error('AUDIO_ASSET_EXISTS: Stable audio IDs cannot be replaced')
  for (const key of Object.keys(asset)) {
    if (!ASSET_FIELDS.includes(key as typeof ASSET_FIELDS[number]))
      throw new Error(`AUDIO_ASSET_METADATA_INVALID: Unsupported audio field ${key}`)
  }
  if (!asset.path || !/^[a-f0-9]{64}$/u.test(asset.sha256 ?? '') || !Number.isInteger(asset.bytes) || (asset.bytes ?? 0) <= 0 || !/^audio\/[\w.+-]+$/u.test(asset.mimeType ?? ''))
    throw new Error('AUDIO_MASTER_INVALID: Native audio requires its path, SHA-256, byte length and MIME type')
  audioProjectMediaPath(catalog, asset)
  validPatch(Object.fromEntries(PATCH_FIELDS.filter(key => key in asset).map(key => [key, asset[key]])))
  if (asset.music) {
    if (asset.kind !== 'bgm')
      throw new Error('MUSIC_ASSET_KIND_INVALID: Music author metadata belongs only to BGM')
    if (asset.music.review.status !== 'pending')
      throw new Error('MUSIC_REVIEW_REQUIRED: New music imports begin pending explicit review')
    if (asset.license && asset.music.rights && asset.license !== asset.music.rights.license)
      throw new Error('MUSIC_LICENSE_MISMATCH: Music license must match the native asset license')
  }
  if (asset.bundle && !catalog.bundles?.some(bundle => bundle.id === asset.bundle))
    throw new Error('AUDIO_ASSET_BUNDLE_INVALID: Unknown catalog bundle')
  canonicalAudioJson(asset)
}

/** Every take is immutable, including unselected history and clone conditioning. */
export function findAudioAssetReferences(snapshot: Pick<ProjectAudioSnapshot, 'ledger' | 'catalog' | 'mixer'>, assetId: string, program?: RuntimeProgram): AudioAssetReference[] {
  const result: AudioAssetReference[] = []
  for (const [lineId, line] of Object.entries(snapshot.ledger.lines)) {
    for (const [locale, binding] of Object.entries(line.locales)) {
      for (const take of binding.takes) {
        const location = `${VOICE_LEDGER_PATH}#lines/${lineId}/locales/${locale}/takes/${take.id}`
        if (take.assetId === assetId)
          result.push({ type: binding.selectedTake === take.id ? 'voice-selected' : 'voice-history', location, lineId, locale, takeId: take.id })
        if (take.voiceId.startsWith(`reference:${assetId}:`))
          result.push({ type: 'voice-reference', location, lineId, locale, takeId: take.id })
      }
    }
  }
  for (const [cue, id] of Object.entries(snapshot.mixer.ui ?? {})) {
    if (id === assetId)
      result.push({ type: 'mixer-ui', location: `${AUDIO_MIXER_PATH}#ui/${cue}` })
  }
  for (const asset of snapshot.catalog.assets) {
    if (asset.id !== assetId && asset.source?.derivedFrom === assetId)
      result.push({ type: 'derived-asset', location: `adv/assets.json#assets/${asset.id}/source/derivedFrom` })
  }
  for (const chapter of Object.values(program?.chapters ?? {})) {
    for (const node of Object.values(chapter.nodes)) {
      function visit(value: unknown, path: string) {
        if (!value || typeof value !== 'object')
          return
        if (Array.isArray(value)) {
          value.forEach((item, index) => visit(item, `${path}/${index}`))
          return
        }
        const entry = value as Record<string, unknown>
        if ((audioAssetKinds.includes(entry.type as AudioAssetKind) || (typeof entry.type === 'string' && entry.type.startsWith('audio.'))) && (entry.asset === assetId || entry.assetId === assetId || (entry.args as Record<string, unknown> | undefined)?.assetId === assetId))
          result.push({ type: 'runtime-operation', location: `${chapter.id}#${node.id}${path}`, chapterId: chapter.id, nodeId: node.id })
        for (const [key, child] of Object.entries(entry))
          visit(child, `${path}/${key}`)
      }
      visit(node, '')
    }
  }
  return result
}

function catalogFiles(files: Record<string, string>) {
  const rootPath = 'adv/assets.json'
  if (!files[rootPath])
    throw new Error('AUDIO_CATALOG_REQUIRED: Explicitly initialize the canonical asset catalog before editing resources')
  const root = JSON.parse(files[rootPath]) as { schemaVersion: number, includes?: string[], assets?: AdvAssetEntry[] }
  if (root.schemaVersion !== 2 || Boolean(Array.isArray(root.includes)) === Boolean(Array.isArray(root.assets)))
    throw new Error('AUDIO_CATALOG_INVALID: A native v2 inline or split catalog is required')
  const paths = [rootPath]
  if (root.includes) {
    for (const include of root.includes) {
      canonicalPath(include)
      if (!/^assets\/.*\.json$/u.test(include))
        throw new Error('AUDIO_CATALOG_INVALID: Catalog includes must use canonical asset fragments')
      const path = `adv/${include}`
      if (!files[path])
        throw new Error('AUDIO_CATALOG_INVALID: A catalog fragment is missing')
      paths.push(path)
    }
  }
  return { root, paths }
}

/** Preserve authored root/profile/fragment metadata; edit only the owning assets array. */
function catalogChanges(files: Record<string, string>, asset: AdvAssetEntry, action: 'add' | 'update' | 'remove'): AudioProjectFileChange[] {
  const { root, paths } = catalogFiles(files)
  const changed = new Map<string, unknown>()
  const rootPath = 'adv/assets.json'
  if (root.assets) {
    root.assets = action === 'add' ? [...root.assets, asset] : root.assets.flatMap(item => item.id === asset.id ? action === 'remove' ? [] : [asset] : [item])
    changed.set(rootPath, root)
  }
  else {
    let found = false
    for (const path of paths.slice(1)) {
      const fragment = JSON.parse(files[path]!) as { schemaVersion: number, assets: AdvAssetEntry[] }
      if (fragment.schemaVersion !== 2 || !Array.isArray(fragment.assets))
        throw new Error('AUDIO_CATALOG_INVALID: A native v2 fragment is required')
      if (!fragment.assets.some(item => item.id === asset.id))
        continue
      if (found || action === 'add')
        throw new Error('AUDIO_CATALOG_INVALID: Duplicate resource IDs are forbidden')
      found = true
      fragment.assets = fragment.assets.flatMap(item => item.id === asset.id ? action === 'remove' ? [] : [asset] : [item])
      changed.set(path, fragment)
    }
    if (action === 'add') {
      const path = 'adv/assets/audio.json'
      const fragment = files[path] ? JSON.parse(files[path]) : { schemaVersion: 2, assets: [] }
      if (fragment.schemaVersion !== 2 || !Array.isArray(fragment.assets))
        throw new Error('AUDIO_CATALOG_INVALID: Audio fragment must use native v2 assets')
      fragment.assets.push(asset)
      changed.set(path, fragment)
      if (!root.includes!.includes('assets/audio.json')) {
        root.includes!.push('assets/audio.json')
        changed.set(rootPath, root)
      }
    }
    else if (!found) {
      throw new Error('AUDIO_CATALOG_INVALID: Resource is missing from its authored catalog')
    }
  }
  return [...changed].map(([path, content]) => ({ path, expected: files[path] ?? null, content: `${JSON.stringify(content, null, 2)}\n` }))
}

function referenceSource(path: string) {
  return /\.(?:adv\.md|adv\.json)$/u.test(path) || /^(?:adv\.config\.json|game\.config\.json|adv\/(?:settings|characters|scenes)\/.*\.json)$/u.test(path)
}

async function digest(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('')
}

/** Separate resource CAS covers reference documents and mixer without changing voice CAS. */
export function createProjectAudioResourceService(port: AudioProjectFilePort) {
  async function current() {
    const document = await port.read()
    const catalog = clean(document.catalog)
    const ledger = parseVoiceLedger(document.files[VOICE_LEDGER_PATH] ? JSON.parse(document.files[VOICE_LEDGER_PATH]) : { schemaVersion: 1, lines: {} })
    const mixer = parseAudioMixerConfig(document.files[AUDIO_MIXER_PATH] ? JSON.parse(document.files[AUDIO_MIXER_PATH]) : { schemaVersion: 1 })
    const pronunciation = parseAudioPronunciationDictionary(document.files[AUDIO_PRONUNCIATION_PATH] ?? createAudioPronunciationDictionary())
    const activePronunciation = activeAudioPronunciationDictionary(pronunciation)
    const voiceProfiles = parseAudioVoiceProfiles(document.files[AUDIO_VOICE_PROFILES_PATH] ?? createAudioVoiceProfiles())
    const activeProfiles = activeAudioVoiceProfiles(voiceProfiles)
    const sources = Object.entries(document.files).filter(([path]) => referenceSource(path)).sort(([left], [right]) => left.localeCompare(right, 'en'))
    const sourceRevision = await digest(new TextEncoder().encode(JSON.stringify(sources)).buffer)
    const revision = await audioFingerprint({ ledger, catalog, mixer, programHash: document.program?.hash ?? null, sourceRevision, ...(activePronunciation ? { pronunciation: activePronunciation } : {}), ...(activeProfiles ? { voiceProfiles: activeProfiles } : {}) })
    return { ...document, snapshot: { ledger, catalog, mixer, pronunciation, voiceProfiles, ...(voiceProfiles.narrator ? { narratorProfile: voiceProfiles.narrator } : {}), revision } }
  }

  async function readProjectAudio(): Promise<ProjectAudioSnapshot> {
    return (await current()).snapshot
  }

  async function checked(expectedRevision: string) {
    const document = await current()
    if (!expectedRevision || document.snapshot.revision !== expectedRevision)
      throw new Error('AUDIO_CONFLICT: Reload the resource documents before applying changes')
    return document
  }

  function references(document: Awaited<ReturnType<typeof current>>, assetId: string) {
    audioAsset(document.snapshot.catalog, assetId)
    const blockingReferences = findAudioAssetReferences(document.snapshot, assetId, document.program)
    if (!document.program && Object.entries(document.files).some(([path, content]) => /\.adv\.md$/u.test(path) && content.trim()))
      blockingReferences.push({ type: 'program-unavailable', location: 'compiledProgram' })
    return { assetId, blockingReferences }
  }

  async function commit(document: Awaited<ReturnType<typeof current>>, changes: AudioProjectFileChange[], media: AudioProjectMedia[] = []) {
    // File-level guards close the gap between read/validation and the host's
    // queued atomic transaction, even when another host edits story references.
    const guards = new Set([...catalogFiles(document.files).paths, VOICE_LEDGER_PATH, AUDIO_MIXER_PATH, AUDIO_PRONUNCIATION_PATH, AUDIO_VOICE_PROFILES_PATH, ...Object.keys(document.files).filter(referenceSource)])
    for (const path of guards) {
      if (!changes.some(change => change.path === path))
        changes.push({ path, expected: document.files[path] ?? null, content: document.files[path] ?? null })
    }
    await port.commit(changes, media)
    return await readProjectAudio()
  }

  async function verify(asset: AdvAssetEntry, catalog: AdvAssetManifest, path: string) {
    if (!port.readMedia)
      throw new Error('AUDIO_MEDIA_VERIFICATION_REQUIRED: This host must verify native resource bytes')
    canonicalPath(path)
    const bytes = await port.readMedia(path)
    if (bytes.byteLength !== asset.bytes || await digest(bytes) !== asset.sha256)
      throw new Error('AUDIO_MEDIA_CHANGED: Resource bytes differ from the reviewed immutable master')
    audioProjectMediaPath(catalog, asset)
  }

  return {
    readProjectAudio,
    async importAsset(input: AudioAssetImportInput) {
      const document = await checked(input.expectedRevision)
      const asset = clean(input.asset)
      validateNewAsset(asset, document.snapshot.catalog)
      const source = clean(input.source)
      if (source.sha256 !== asset.sha256 || source.bytes !== asset.bytes)
        throw new Error('AUDIO_MEDIA_CHANGED: Import provenance differs from the catalog master')
      if (source.path === audioProjectMediaPath(document.snapshot.catalog, asset))
        throw new Error('AUDIO_IMPORT_DESTINATION_EXISTS: Use registerAsset for an existing native master')
      await verify(asset, document.snapshot.catalog, source.path)
      return await commit(document, catalogChanges(document.files, asset, 'add'), [{ candidate: source, asset }])
    },
    async registerAsset(input: AudioAssetRegisterInput) {
      const document = await checked(input.expectedRevision)
      const asset = clean(input.asset)
      validateNewAsset(asset, document.snapshot.catalog)
      await verify(asset, document.snapshot.catalog, audioProjectMediaPath(document.snapshot.catalog, asset))
      return await commit(document, catalogChanges(document.files, asset, 'add'), [{ candidate: { path: audioProjectMediaPath(document.snapshot.catalog, asset), sha256: asset.sha256!, bytes: asset.bytes! }, asset, operation: 'verify' }])
    },
    async updateAsset(input: { expectedRevision: string, assetId: string, patch: AudioAssetMetadataPatch }) {
      const document = await checked(input.expectedRevision)
      const asset = audioAsset(document.snapshot.catalog, input.assetId)
      validPatch(input.patch)
      const patch = clean(input.patch)
      if (!audioAssetKinds.includes(asset.kind as AudioAssetKind) && !patch.kind)
        throw new Error('AUDIO_LEGACY_CLASSIFICATION_REQUIRED: Explicitly choose a native audio kind before editing legacy metadata')
      if (asset.music && patch.kind && patch.kind !== asset.kind)
        throw new Error('MUSIC_ASSET_KIND_INVALID: Retain the music classification and review history of a musical resource')
      if (patch.kind && patch.kind !== asset.kind && references(document, asset.id).blockingReferences.length)
        throw new Error('AUDIO_ASSET_KIND_REFERENCED: Referenced resource kinds cannot change')
      if (patch.bundle && !document.snapshot.catalog.bundles?.some(bundle => bundle.id === patch.bundle))
        throw new Error('AUDIO_ASSET_BUNDLE_INVALID: Unknown catalog bundle')
      const next = { ...asset }
      for (const [key, value] of Object.entries(patch)) {
        if (value === null)
          delete next[key as keyof AdvAssetEntry]
        else
          Object.assign(next, { [key]: value })
      }
      if (asset.music && !next.music)
        throw new Error('MUSIC_METADATA_REQUIRED: Retain music provenance when editing a musical resource')
      if (next.music) {
        if (next.kind !== 'bgm')
          throw new Error('MUSIC_ASSET_KIND_INVALID: Music author metadata belongs only to BGM')
        const music = parseMusicMetadata(next.music)
        if (next.license && music.rights && next.license !== music.rights.license)
          throw new Error('MUSIC_LICENSE_MISMATCH: Music license must match the native asset license')
        const authored = (value: AdvMusicMetadata) => {
          const { review: _review, ...content } = value
          return canonicalAudioJson(content)
        }
        const contentChanged = !asset.music || authored(parseMusicMetadata(asset.music)) !== authored(music) || next.license !== asset.license
        // Only the dedicated review action can approve an imported master.
        // Titles and labels preserve approval; changed intent/source/rights do not.
        next.music = { ...music, review: contentChanged ? { status: 'pending' } : { ...asset.music!.review } }
      }
      return await commit(document, catalogChanges(document.files, next, 'update'))
    },
    async reviewMusicAsset(input: { expectedRevision: string, assetId: string, expectedSha256: string, status: 'approved' | 'rejected' }) {
      const document = await checked(input.expectedRevision)
      const original = audioAsset(document.snapshot.catalog, input.assetId)
      if (original.kind !== 'bgm' || !original.music)
        throw new Error('MUSIC_METADATA_REQUIRED: Explicitly record musical intent and provenance before reviewing')
      if (!['approved', 'rejected'].includes(input.status))
        throw new Error('MUSIC_REVIEW_INVALID: Review must explicitly approve or reject')
      if (!/^[a-f0-9]{64}$/u.test(input.expectedSha256) || original.sha256 !== input.expectedSha256)
        throw new Error('MUSIC_AUDIO_CHANGED: Reload the immutable music master before reviewing')
      const music = parseMusicMetadata(original.music)
      if (input.status === 'approved' && !music.rights)
        throw new Error('MUSIC_LICENSE_REQUIRED: Review the imported file license before approval')
      const asset: AdvAssetEntry = {
        ...original,
        music: parseMusicMetadata({ ...music, review: { status: input.status, sha256: original.sha256, reviewedAt: new Date().toISOString() } }),
      }
      if (input.status === 'approved' && !inspectMusicReview(asset).canBind)
        throw new Error('MUSIC_REVIEW_INVALID: Rejected or inconsistent music cannot be approved')
      const path = audioProjectMediaPath(document.snapshot.catalog, asset)
      await verify(asset, document.snapshot.catalog, path)
      // Host commits recheck bytes atomically with the catalog CAS; a file
      // replacement during review cannot become approved from a stale read.
      return await commit(document, catalogChanges(document.files, asset, 'update'), [{ candidate: { path, sha256: asset.sha256!, bytes: asset.bytes! }, asset, operation: 'verify' }])
    },
    async preflightRemoveAsset(assetId: string): Promise<AudioAssetRemovalPreflight> {
      return references(await current(), assetId)
    },
    async removeAsset(input: { expectedRevision: string, assetId: string }) {
      const document = await checked(input.expectedRevision)
      const preflight = references(document, input.assetId)
      if (preflight.blockingReferences.length)
        throw new AudioAssetReferencedError(preflight)
      // Remove catalog coordinates only. Immutable files belong to later,
      // explicit garbage collection after all revisions have been reviewed.
      return await commit(document, catalogChanges(document.files, audioAsset(document.snapshot.catalog, input.assetId), 'remove'))
    },
    async saveMixer(input: { expectedRevision: string, mixer: AudioMixerConfig }) {
      const document = await checked(input.expectedRevision)
      const mixer = parseAudioMixerConfig(input.mixer)
      for (const id of Object.values(mixer.ui ?? {})) {
        if (audioAsset(document.snapshot.catalog, id).kind !== 'ui')
          throw new Error('AUDIO_MIXER_UI_KIND_INVALID: Semantic UI cues must reference UI audio resources')
      }
      return await commit(document, [{ path: AUDIO_MIXER_PATH, expected: document.files[AUDIO_MIXER_PATH] ?? null, content: `${JSON.stringify(mixer, null, 2)}\n` }])
    },
  }
}
