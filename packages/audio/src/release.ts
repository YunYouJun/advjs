import type { AdvAssetManifest, AudioApprovedToolchainProfile, AudioProcessingReceipt, VoiceLedger, VoiceRights, VoiceTakeSource } from '@advjs/types'
import type { AudioProcessingKind } from './processing'
import { canonicalAudioJson } from './fingerprint'
import { assertAudioId } from './ids'
import { normalizeAudioLocale } from './locale'
import { audioObjectKey } from './object-key'
import { assertAudioProcessingReceipt, audioProcessingPresets } from './processing'
import { assertAudioReleaseToolchain } from './toolchain'
import { parseVoiceLedger, validateVoiceRights } from './voice-ledger'

export interface AudioVoicePublicationAuthorization {
  assetId: string
  lineId: string
  locale: string
  speakerId: string
  takeId: string
  masterSha256: string
  inputFingerprint: string
  voiceProfileRevision: string
  source: VoiceTakeSource
  rights?: VoiceRights
}

export interface AudioReleaseAssetRecord {
  /** Native coordinates let the trusted host re-read the canonical asset. */
  source: {
    catalogId: string
    assetId: string
    type: 'audio'
    kind: AudioProcessingKind
    masterSha256: string
    path?: string
    objectKey?: string
    bytes?: number
    mimeType?: string
  }
  receipt: AudioProcessingReceipt
  /** Private evidence; no dialogue prose or complete ledger is stored here. */
  voice?: AudioVoicePublicationAuthorization
}

export interface AudioReleaseObject {
  assetId: string
  variant: 'opus' | 'aac'
  path: string
  objectKey: string
  sha256: string
  bytes: number
  mimeType: string
  cacheControl: 'public, max-age=31536000, immutable'
}
export interface AudioReleasePlan {
  schemaVersion: 1
  projectPrefix: string
  assets: AudioReleaseAssetRecord[]
  objects: AudioReleaseObject[]
  /** Private host checks; never part of the public catalog manifest. */
  voiceAuthorizations: AudioVoicePublicationAuthorization[]
  manifest: { objectKey: string, content: string, cacheControl: 'public, max-age=60, must-revalidate' }
}

const kinds = ['bgm', 'ambience', 'voice', 'sfx', 'ui'] as const
const hash = /^[a-f0-9]{64}$/u

function validPath(value: string, media = false): boolean {
  return typeof value === 'string' && Boolean(value) && !value.includes('\\') && Array.from(value).every(char => char.charCodeAt(0) > 31 && char.charCodeAt(0) !== 127)
    && value.split('/').every(segment => (media ? Boolean(segment) && !segment.includes(':') : /^[a-zA-Z0-9][\w.-]*$/u.test(segment)) && !['.', '..', '.git', 'node_modules'].includes(segment.toLowerCase()))
}

function fields(value: unknown, allowed: string[]) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).every(key => allowed.includes(key))
}

function validateAuthorization(value: AudioVoicePublicationAuthorization) {
  if (!fields(value, ['assetId', 'lineId', 'locale', 'speakerId', 'takeId', 'masterSha256', 'inputFingerprint', 'voiceProfileRevision', 'source', 'rights'])
    || !hash.test(value.masterSha256) || !hash.test(value.inputFingerprint) || !hash.test(value.voiceProfileRevision)
    || !['system', 'designed', 'recorded', 'cloned'].includes(value.source)) {
    throw new Error('AUDIO_RELEASE_VOICE_PROVENANCE_REQUIRED')
  }
  assertAudioId(value.assetId, 'audio')
  assertAudioId(value.lineId, 'line')
  assertAudioId(value.takeId, 'take')
  if (normalizeAudioLocale(value.locale) !== value.locale || !validPath(value.speakerId) || value.speakerId.includes('/'))
    throw new Error('AUDIO_RELEASE_VOICE_PROVENANCE_REQUIRED')
  if (value.rights)
    validateVoiceRights(value.rights)
  if (value.source === 'cloned' && !value.rights)
    throw new Error('AUDIO_RELEASE_VOICE_CONSENT_REQUIRED')
}

/** Repeat all planner checks at publication: client JSON confers no authority. */
function releaseObjects(record: AudioReleaseAssetRecord, projectPrefix: string, approvedProfiles: readonly AudioApprovedToolchainProfile[]): AudioReleaseObject[] {
  canonicalAudioJson(record)
  const source = record.source
  if (!source || !fields(record, ['source', 'receipt', 'voice']) || !fields(source, ['catalogId', 'assetId', 'type', 'kind', 'masterSha256', 'path', 'objectKey', 'bytes', 'mimeType'])
    || typeof source.catalogId !== 'string' || !source.catalogId.trim() || source.type !== 'audio' || !kinds.includes(source.kind)
    || !hash.test(source.masterSha256) || (source.path !== undefined && !validPath(source.path, true)) || (source.objectKey !== undefined && !validPath(source.objectKey))
    || (source.bytes !== undefined && (!Number.isSafeInteger(source.bytes) || source.bytes <= 0)) || (source.mimeType !== undefined && !/^audio\/[\w.+-]+$/u.test(source.mimeType))) {
    throw new Error('AUDIO_RELEASE_SOURCE_INVALID')
  }
  const receipt = assertAudioProcessingReceipt(record.receipt)
  if (receipt.masterSha256 !== source.masterSha256 || receipt.presetId !== audioProcessingPresets[source.kind].id)
    throw new Error('AUDIO_RELEASE_PRESET_MISMATCH')
  if (receipt.purpose !== 'release' || !receipt.toolchain)
    throw new Error('AUDIO_RELEASE_PREVIEW_FORBIDDEN: Preview output cannot mutate public manifests')
  assertAudioReleaseToolchain(receipt.toolchain, receipt.ffmpegBuildFingerprint, approvedProfiles)
  if (source.kind === 'voice') {
    if (!record.voice || record.voice.assetId !== source.assetId || record.voice.masterSha256 !== source.masterSha256)
      throw new Error('AUDIO_RELEASE_VOICE_PROVENANCE_REQUIRED')
    validateAuthorization(record.voice)
  }
  else if (record.voice) {
    throw new Error('AUDIO_RELEASE_VOICE_PROVENANCE_REQUIRED')
  }
  return receipt.outputs.map((output) => {
    if (!validPath(output.path, true))
      throw new Error('AUDIO_RELEASE_PLAN_INVALID')
    const objectKey = audioObjectKey({ projectPrefix, kind: source.kind, assetId: source.assetId, sha256: output.metadata.sha256, extension: output.variant === 'opus' ? 'webm' : 'm4a', ...(record.voice ? { locale: record.voice.locale, speakerId: record.voice.speakerId, lineId: record.voice.lineId, takeId: record.voice.takeId } : {}) })
    return { assetId: source.assetId, variant: output.variant, path: output.path, objectKey, sha256: output.metadata.sha256, bytes: output.metadata.bytes, mimeType: output.metadata.mimeType, cacheControl: 'public, max-age=31536000, immutable' }
  })
}

function validateManifest(plan: Pick<AudioReleasePlan, 'projectPrefix' | 'assets' | 'objects' | 'manifest'>) {
  const catalog = JSON.parse(plan.manifest.content) as AdvAssetManifest
  canonicalAudioJson(catalog)
  if (!catalog || catalog.schemaVersion !== 2 || typeof catalog.id !== 'string' || !catalog.id.trim() || !Array.isArray(catalog.assets)
    || !catalog.profiles || catalog.profiles[catalog.defaultProfile]?.provider !== 'http'
    || Object.values(catalog.profiles).some(profile => profile.provider !== 'http' || profile.root !== undefined)
    || !fields(catalog, ['schemaVersion', 'id', 'defaultProfile', 'profiles', 'bundles', 'release', 'manifestObjectKey', 'assets'])
    || new Set(catalog.assets.map(asset => asset.id)).size !== catalog.assets.length
    || !validPath(plan.manifest.objectKey) || !plan.manifest.objectKey.startsWith(`${plan.projectPrefix}/`) || !plan.manifest.objectKey.endsWith('.json')
    || plan.manifest.cacheControl !== 'public, max-age=60, must-revalidate') {
    throw new Error('AUDIO_RELEASE_MANIFEST_INVALID: Use a public native Asset Catalog')
  }
  for (const asset of catalog.assets) {
    if (asset.kind === 'reference')
      throw new Error('AUDIO_RELEASE_REFERENCE_FORBIDDEN: Reference masters are private authoring inputs')
    if (asset.kind === 'voice' && asset.type !== 'audio')
      throw new Error('AUDIO_RELEASE_MANIFEST_INVALID: Voice assets must match verified native audio records')
    if (asset.type !== 'audio')
      continue
    const record = plan.assets.find(record => record.source.assetId === asset.id)
    if (!record || record.source.kind !== asset.kind || !kinds.includes(asset.kind as AudioProcessingKind)
      || !fields(asset, ['id', 'type', 'kind', 'bundle', 'labels', 'title', 'alt', 'chapterId', 'characterId', 'sceneId', 'state', 'duration', 'loop', 'license', 'sha256', 'bytes', 'mimeType', 'variants'])
      || !asset.variants || Object.keys(asset.variants).some(variant => !['opus', 'aac'].includes(variant))) {
      throw new Error('AUDIO_RELEASE_MANIFEST_INVALID: Every public audio asset requires a verified receipt')
    }
    for (const [name, variant] of Object.entries(asset.variants)) {
      const object = plan.objects.find(object => object.assetId === asset.id && object.variant === name)
      if (!object || !fields(variant, ['objectKey', 'sha256', 'bytes', 'mimeType']) || variant.objectKey !== object.objectKey || variant.sha256 !== object.sha256 || variant.bytes !== object.bytes || variant.mimeType !== object.mimeType)
        throw new Error('AUDIO_RELEASE_MANIFEST_INVALID: Public variants must match verified release objects')
    }
  }
  for (const object of plan.objects) {
    const asset = catalog.assets.find(asset => asset.id === object.assetId)
    const variant = asset?.variants?.[object.variant]
    if (asset?.type !== 'audio' || variant?.objectKey !== object.objectKey || variant.sha256 !== object.sha256 || variant.bytes !== object.bytes || variant.mimeType !== object.mimeType)
      throw new Error('AUDIO_RELEASE_MANIFEST_INVALID: Public variants must match every verified release object')
  }
}

/** Planning checks the native selected binding; it never invents a selected ledger. */
export function planAudioRelease(options: {
  projectPrefix: string
  approvedProfiles: readonly AudioApprovedToolchainProfile[]
  sourceCatalog: AdvAssetManifest
  voiceLedger?: VoiceLedger
  manifest: (objects: readonly AudioReleaseObject[]) => { objectKey: string, catalog: AdvAssetManifest }
  assets: Array<{ assetId: string, kind: AudioProcessingKind, receipt: AudioProcessingReceipt, locale?: string, speakerId?: string, lineId?: string, takeId?: string }>
}): AudioReleasePlan {
  const records: AudioReleaseAssetRecord[] = []
  if (!options.sourceCatalog || options.sourceCatalog.schemaVersion !== 2 || !Array.isArray(options.sourceCatalog.assets)
    || new Set(options.sourceCatalog.assets.map(asset => asset.id)).size !== options.sourceCatalog.assets.length) {
    throw new Error('AUDIO_RELEASE_SOURCE_INVALID: The canonical native asset catalog is required')
  }
  for (const input of options.assets) {
    const asset = options.sourceCatalog.assets.find(asset => asset.id === input.assetId)
    if (!asset || asset.type !== 'audio' || asset.kind !== input.kind || !kinds.includes(input.kind) || !asset.sha256 || asset.sha256 !== input.receipt.masterSha256 || asset.state === 'rejected')
      throw new Error('AUDIO_RELEASE_SOURCE_INVALID: Canonical master identity, kind and hash must match')
    const source: AudioReleaseAssetRecord['source'] = { catalogId: options.sourceCatalog.id, assetId: asset.id, type: 'audio', kind: input.kind, masterSha256: asset.sha256, ...(asset.path === undefined ? {} : { path: asset.path }), ...(asset.objectKey === undefined ? {} : { objectKey: asset.objectKey }), ...(asset.bytes === undefined ? {} : { bytes: asset.bytes }), ...(asset.mimeType === undefined ? {} : { mimeType: asset.mimeType }) }
    const record: AudioReleaseAssetRecord = { source, receipt: structuredClone(input.receipt) }
    if (input.kind === 'voice') {
      if (!options.voiceLedger || !input.lineId || !input.locale || !input.speakerId || !input.takeId)
        throw new Error('AUDIO_RELEASE_VOICE_PROVENANCE_REQUIRED')
      const ledger = parseVoiceLedger(options.voiceLedger)
      const locale = normalizeAudioLocale(input.locale)
      const line = ledger.lines[input.lineId]
      const binding = line?.locales[locale]
      const take = binding?.takes.find(take => take.id === input.takeId)
      if (!take || line?.speakerId !== input.speakerId || binding?.selectedTake !== input.takeId || take.assetId !== input.assetId || take.sha256 !== source.masterSha256)
        throw new Error('AUDIO_RELEASE_VOICE_SELECTED_TAKE_REQUIRED: Publish only the exact adopted native dialogue take')
      record.voice = { assetId: input.assetId, lineId: input.lineId, locale, speakerId: line.speakerId, takeId: take.id, masterSha256: take.sha256, inputFingerprint: take.inputFingerprint, voiceProfileRevision: take.voiceProfileRevision, source: take.source, ...(take.rights ? { rights: structuredClone(take.rights) } : {}) }
    }
    records.push(record)
  }
  if (!records.length)
    throw new Error('AUDIO_RELEASE_EMPTY')
  if (new Set(records.map(record => record.source.assetId)).size !== records.length)
    throw new Error('AUDIO_RELEASE_ASSET_DUPLICATE')
  const objects = records.flatMap(record => releaseObjects(record, options.projectPrefix, options.approvedProfiles))
  const manifest = options.manifest(structuredClone(objects))
  const plan: AudioReleasePlan = { schemaVersion: 1, projectPrefix: options.projectPrefix, assets: records, objects, voiceAuthorizations: records.flatMap(record => record.voice ? [record.voice] : []), manifest: { objectKey: manifest.objectKey, content: `${canonicalAudioJson(manifest.catalog)}\n`, cacheControl: 'public, max-age=60, must-revalidate' } }
  validateManifest(plan)
  canonicalAudioJson(plan)
  return plan
}

export interface AudioPublicationPort {
  /**
   * Re-read the host's stored processing receipt and canonical native asset.
   * Voice records must reflect the current exact-locale selected take. Return
   * that trusted record after verifying media hashes, never echo client JSON.
   */
  verifyProcessingReceipt: (record: AudioReleaseAssetRecord, approvedProfiles: readonly AudioApprovedToolchainProfile[]) => Promise<AudioReleaseAssetRecord>
  /** Re-read the current selected binding and rights before any upload. */
  authorizeVoice?: (authorization: AudioVoicePublicationAuthorization) => Promise<void>
  verify: (object: AudioReleaseObject) => Promise<'missing' | 'verified'>
  uploadImmutable: (object: AudioReleaseObject, signal?: AbortSignal) => Promise<void>
  commitManifest: (manifest: AudioReleasePlan['manifest'], expectedRevision: string | null, signal?: AbortSignal) => Promise<void>
}

/** Finish all receipt, binding and rights checks before object storage I/O. */
export async function publishAudioRelease(input: AudioReleasePlan, port: AudioPublicationPort, options: { approvedProfiles: readonly AudioApprovedToolchainProfile[], expectedManifestRevision: string | null, signal?: AbortSignal }) {
  const plan = structuredClone(input)
  canonicalAudioJson(plan)
  if (!plan || plan.schemaVersion !== 1 || !fields(plan, ['schemaVersion', 'projectPrefix', 'assets', 'objects', 'voiceAuthorizations', 'manifest'])
    || !validPath(plan.projectPrefix) || !Array.isArray(plan.assets) || !plan.assets.length || !Array.isArray(plan.objects) || !Array.isArray(plan.voiceAuthorizations)
    || new Set(plan.assets.map(record => record.source.assetId)).size !== plan.assets.length || !Array.isArray(options.approvedProfiles) || !options.approvedProfiles.length) {
    throw new Error('AUDIO_RELEASE_PLAN_INVALID')
  }
  const approvedProfiles = structuredClone(options.approvedProfiles)
  const expectedObjects = plan.assets.flatMap(record => releaseObjects(record, plan.projectPrefix, approvedProfiles))
  const authorizations = plan.assets.flatMap(record => record.voice ? [record.voice] : [])
  if (canonicalAudioJson(expectedObjects) !== canonicalAudioJson(plan.objects) || canonicalAudioJson(authorizations) !== canonicalAudioJson(plan.voiceAuthorizations)
    || new Set(plan.objects.map(object => object.objectKey)).size !== plan.objects.length) {
    throw new Error('AUDIO_RELEASE_PLAN_INVALID: Objects and authorizations must follow verified receipt provenance')
  }
  validateManifest(plan)
  if (typeof port.verifyProcessingReceipt !== 'function')
    throw new Error('AUDIO_RELEASE_RECEIPT_VERIFICATION_REQUIRED: A trusted host must re-read durable processing records')
  if (authorizations.length && typeof port.authorizeVoice !== 'function')
    throw new Error('AUDIO_RELEASE_VOICE_CONSENT_REQUIRED: A trusted host must authorize every adopted voice')
  for (const record of plan.assets) {
    options.signal?.throwIfAborted()
    const trusted = await port.verifyProcessingReceipt(structuredClone(record), structuredClone(approvedProfiles))
    releaseObjects(trusted, plan.projectPrefix, approvedProfiles)
    if (canonicalAudioJson(trusted) !== canonicalAudioJson(record))
      throw new Error('AUDIO_RELEASE_RECEIPT_UNTRUSTED: The plan differs from the stored receipt or current native binding')
  }
  for (const authorization of authorizations) {
    options.signal?.throwIfAborted()
    await port.authorizeVoice!(structuredClone(authorization))
  }
  for (const object of plan.objects) {
    options.signal?.throwIfAborted()
    if (await port.verify(object) !== 'verified') {
      await port.uploadImmutable(object, options.signal)
      if (await port.verify(object) !== 'verified')
        throw new Error('AUDIO_RELEASE_OBJECT_UNVERIFIED')
    }
  }
  options.signal?.throwIfAborted()
  await port.commitManifest(plan.manifest, options.expectedManifestRevision, options.signal)
}
