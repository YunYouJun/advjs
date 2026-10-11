import type { AudioProcessingKind, AudioReleaseAssetRecord, AudioReleaseObject, AudioVoicePublicationAuthorization } from '@advjs/audio'
import type { AdvAssetEntry, AdvAssetManifest, AudioApprovedToolchainProfile, VoiceAuthoringSnapshot, VoiceLedger } from '@advjs/types'
import type { HostedAudioPublication, HostedAudioReleasePreparation, HostedAudioReleaseReview } from '../../shared/hosted-audio'
import type { AudioProcessRunner } from './process'
import { Buffer } from 'node:buffer'
import { createHash, randomUUID } from 'node:crypto'
import { lstat, readFile, realpath } from 'node:fs/promises'
import { audioProjectMediaPath, canonicalAudioJson, parseAudioToolchainLock, planAudioRelease, publishAudioRelease } from '@advjs/audio'
import { createProjectGameConfig } from '@advjs/core'
import { isAbsolute, relative, resolve } from 'pathe'
import { loadProject } from '../project'
import { withProjectWriteLock } from '../project/write-lock'
import { processProjectAudio } from './process'
import { createAudioReleaseStore } from './release-store'
import { createNodeVoiceAuthoringService } from './voice'

/** Structural port implemented by the existing @advjs/plugin-cos CosStorage. */
export interface AudioReleaseStorage {
  assertImmutableBucket: () => Promise<void>
  head: (key: string) => Promise<{ etag?: string, contentLength?: number, contentType?: string, cacheControl?: string } | null>
  readBytes: (key: string, maxBytes: number, options?: { ifMatch?: string, signal?: AbortSignal }) => Promise<Uint8Array>
  putBytes: (key: string, bytes: Uint8Array, options: { contentType: string, cacheControl: string, metadata: Record<string, string>, forbidOverwrite: boolean }) => Promise<void>
}
export interface NodeAudioPublicationOptions {
  root: string
  stateDirectory?: string
  projectPrefix: string
  publicBaseUrl: string
  /** Deployment approval is supplied by the operator, never a browser/project file. */
  approvedProfiles: readonly AudioApprovedToolchainProfile[]
  /** CosStorage must use prefix: ''; the release plan supplies complete keys. */
  storage: AudioReleaseStorage
  /** Optional digest-locked container runner, using the identical FFmpeg arguments. */
  runner?: AudioProcessRunner
}
const digest = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex')
const kinds = ['bgm', 'ambience', 'voice', 'sfx', 'ui'] as const
const immutableCache = 'public, max-age=31536000, immutable'
// One execution pool across registered projects in this service process.
let processingWorkers = 0
const processingWaiters: Array<() => void> = []
async function processingPermit<T>(operation: () => Promise<T>) {
  if (processingWorkers >= 2)
    await new Promise<void>(resolve => processingWaiters.push(resolve))
  else processingWorkers++
  try {
    return await operation()
  }
  finally {
    const next = processingWaiters.shift()
    if (next)
      next()
    else processingWorkers--
  }
}
function object(value: unknown): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('AUDIO_RELEASE_INPUT_INVALID')
}
function revision(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value)
}
function inside(root: string, target: string) {
  const path = relative(root, target)
  return !isAbsolute(path) && path !== '..' && !path.startsWith('../')
}

/** Actual FFmpeg processing -> durable receipts -> verified immutable COS objects -> pointer CAS. */
export async function createNodeAudioPublicationHost(options: NodeAudioPublicationOptions) {
  const root = await realpath(options.root)
  if (!/^[a-zA-Z0-9][\w.-]*(?:\/[a-zA-Z0-9][\w.-]*)*$/u.test(options.projectPrefix)
    || options.projectPrefix.split('/').some(part => ['.', '..', '.git', 'node_modules'].includes(part.toLowerCase()))) {
    throw new Error('AUDIO_RELEASE_PREFIX_INVALID')
  }
  const base = new URL(options.publicBaseUrl)
  if (!['https:', 'http:'].includes(base.protocol) || base.username || base.password || base.search || base.hash)
    throw new Error('AUDIO_RELEASE_PUBLIC_URL_INVALID')
  if (!base.pathname.endsWith('/'))
    base.pathname += '/'
  const approvedProfiles = structuredClone(options.approvedProfiles)
  if (!approvedProfiles.length || new Set(approvedProfiles.map(profile => profile.id)).size !== approvedProfiles.length)
    throw new Error('AUDIO_TOOLCHAIN_PROFILE_UNAPPROVED')
  for (const profile of approvedProfiles)
    parseAudioToolchainLock({ schemaVersion: 1, profileId: profile.id, ffmpegBuildFingerprint: profile.ffmpegBuildFingerprint, workerImageDigest: profile.workerImageDigest })
  const storage = options.storage
  const store = await createAudioReleaseStore(root, options.stateDirectory)
  const native = await createNodeVoiceAuthoringService({ root })

  async function media(path: string, max = 512 * 1024 * 1024): Promise<Buffer> {
    if (!path || isAbsolute(path) || path.includes('\\') || path.includes(':') || path.split('/').some(part => !part || ['.', '..', '.git', 'node_modules'].includes(part.toLowerCase())))
      throw new Error('AUDIO_RELEASE_MEDIA_INVALID')
    const target = resolve(root, path)
    const info = await lstat(target)
    if (!info.isFile() || info.isSymbolicLink() || info.size > max || !inside(root, await realpath(target)))
      throw new Error('AUDIO_RELEASE_MEDIA_INVALID')
    return await readFile(target)
  }
  async function currentProgram() {
    const loaded = await loadProject({ root, allowEmptyAssetManifest: true })
    const program = loaded.result.project.program
    if (!program || loaded.result.diagnostics.some(item => item.severity === 'error'))
      throw new Error('AUDIO_RELEASE_PROJECT_INVALID')
    const ledger = createProjectGameConfig(loaded.result, loaded.files).audio?.voiceLedger ?? { schemaVersion: 1 as const, lines: {} }
    // RuntimeProgram has only canonical execution data: no compilation clock,
    // source-map paths or generated receipt/preview metadata.
    return { ledger, sha256: digest(canonicalAudioJson(JSON.parse(JSON.stringify(program)))) }
  }
  async function assertCurrentProgram(expected: unknown) {
    if (!revision(expected))
      throw new Error('AUDIO_RELEASE_SOURCE_CONFLICT')
    const current = await currentProgram()
    if (current.sha256 !== expected)
      throw new Error('AUDIO_RELEASE_SOURCE_CONFLICT')
    return current
  }
  function selected(ledger: VoiceLedger, assetId: string) {
    const matches: Array<{ lineId: string, locale: string, speakerId: string, takeId: string }> = []
    for (const [lineId, line] of Object.entries(ledger.lines)) {
      for (const [locale, binding] of Object.entries(line.locales)) {
        const take = binding.takes.find(take => take.id === binding.selectedTake)
        if (take?.assetId === assetId)
          matches.push({ lineId, locale, speakerId: line.speakerId, takeId: take.id })
      }
    }
    if (matches.length !== 1)
      throw new Error('AUDIO_RELEASE_VOICE_SELECTED_TAKE_REQUIRED')
    return matches[0]!
  }
  async function consent(authorization: AudioVoicePublicationAuthorization): Promise<string | undefined> {
    if (authorization.source === 'cloned' && !authorization.rights)
      throw new Error('AUDIO_RELEASE_VOICE_CONSENT_REQUIRED')
    if (authorization.rights)
      return digest(await media(authorization.rights.consentRecord, 256 * 1024))
  }
  function publicCatalog(snapshot: VoiceAuthoringSnapshot, objects: readonly AudioReleaseObject[], durations: ReadonlyMap<string, number>): AdvAssetManifest {
    return {
      schemaVersion: 2,
      id: snapshot.catalog.id,
      defaultProfile: 'published',
      profiles: { published: { provider: 'http', baseUrl: base.href } },
      release: { provider: 'tencent-cos', objectPrefix: options.projectPrefix },
      assets: [...new Set(objects.map(object => object.assetId))].map((id) => {
        const original = snapshot.catalog.assets.find(asset => asset.id === id)!
        const asset: AdvAssetEntry = { id, type: 'audio', kind: original.kind, sha256: original.sha256, duration: durations.get(id) }
        // Public author-facing metadata is an explicit allowlist. No master paths,
        // prompts, reference audio, private license evidence or immutable ledger.
        for (const field of ['labels', 'title', 'alt', 'chapterId', 'characterId', 'sceneId', 'loop', 'license'] as const) {
          if (original[field] !== undefined)
            Object.assign(asset, { [field]: structuredClone(original[field]) })
        }
        asset.variants = Object.fromEntries(objects.filter(object => object.assetId === id).map(object => [object.variant, { objectKey: object.objectKey, sha256: object.sha256, bytes: object.bytes, mimeType: object.mimeType }]))
        return asset
      }),
    }
  }
  async function verifyStoredObject(key: string, bytes: number, sha256: string, mimeType: string, cacheControl: string) {
    const info = await storage.head(key)
    if (!info)
      return 'missing' as const
    // A strong quoted entity tag is required for the If-Match read. COS MD5
    // and multipart tags are both opaque strings; never infer SHA from ETag.
    if (typeof info.etag !== 'string' || !/^"[\x21\x23-\x7E\x80-\xFF]+"$/u.test(info.etag))
      throw new Error('AUDIO_RELEASE_OBJECT_ETAG_REQUIRED')
    if (info.contentLength !== bytes || info.contentType !== mimeType || info.cacheControl !== cacheControl
      || digest(await storage.readBytes(key, bytes, { ifMatch: info.etag })) !== sha256) {
      throw new Error('AUDIO_RELEASE_IMMUTABLE_OBJECT_CONFLICT')
    }
    return 'verified' as const
  }
  async function immutablePut(key: string, bytes: Uint8Array, mimeType: string, cacheControl: string) {
    try {
      await storage.putBytes(key, bytes, { contentType: mimeType, cacheControl, metadata: { sha256: digest(bytes) }, forbidOverwrite: true })
    }
    catch (error) {
      // Another process may have uploaded exactly the same immutable object.
      // A conflict is recoverable only after verifying the actual remote bytes.
      if (!error || typeof error !== 'object' || !('statusCode' in error) || error.statusCode !== 409)
        throw new Error('AUDIO_RELEASE_STORAGE_UNAVAILABLE')
    }
    if (await verifyStoredObject(key, bytes.byteLength, digest(bytes), mimeType, cacheControl) !== 'verified')
      throw new Error('AUDIO_RELEASE_OBJECT_UNVERIFIED')
  }

  function preparationInput(input: unknown) {
    object(input)
    if (Object.keys(input).some(key => !['assetIds', 'expectedSourceRevision'].includes(key))
      || (input.expectedSourceRevision !== undefined && !revision(input.expectedSourceRevision))
      || (input.assetIds !== undefined && (!Array.isArray(input.assetIds) || !input.assetIds.length || input.assetIds.length > 200 || input.assetIds.some(id => typeof id !== 'string') || new Set(input.assetIds).size !== input.assetIds.length))) {
      throw new Error('AUDIO_RELEASE_INPUT_INVALID')
    }
    return structuredClone(input) as { assetIds?: string[], expectedSourceRevision?: string }
  }
  async function prepare(raw: unknown, signal?: AbortSignal): Promise<HostedAudioReleaseReview> {
    const input = preparationInput(raw)
    signal?.throwIfAborted()
    const snapshot = await native.read()
    const reviewedProgram = await currentProgram()
    if (input.expectedSourceRevision !== undefined && input.expectedSourceRevision !== snapshot.revision)
      throw new Error('AUDIO_RELEASE_SOURCE_CONFLICT')
    const adopted = new Set(Object.values(reviewedProgram.ledger.lines).flatMap(line => Object.values(line.locales).flatMap(binding => binding.takes.filter(take => binding.selectedTake === take.id).map(take => take.assetId))))
    const candidates = snapshot.catalog.assets.filter(asset => asset.type === 'audio' && kinds.includes(asset.kind as AudioProcessingKind) && asset.state !== 'rejected' && (asset.kind !== 'voice' || adopted.has(asset.id)))
    const assets = input.assetIds === undefined ? candidates : (input.assetIds as string[]).map(id => candidates.find(asset => asset.id === id)!)
    if (!assets.length || assets.length > 200 || assets.some(asset => !asset))
      throw new Error('AUDIO_RELEASE_ASSET_INVALID')
    const toolchain = parseAudioToolchainLock(JSON.parse((await media('adv/audio/toolchain.json', 64 * 1024)).toString('utf8')))
    const receipts: Array<Parameters<typeof planAudioRelease>[0]['assets'][number]> = []
    for (const asset of assets) {
      const bytes = await media(audioProjectMediaPath(snapshot.catalog, asset))
      if (digest(bytes) !== asset.sha256 || (asset.bytes !== undefined && bytes.byteLength !== asset.bytes))
        throw new Error('AUDIO_RELEASE_MASTER_CHANGED')
      const receipt = await processProjectAudio({ root, inputPath: audioProjectMediaPath(snapshot.catalog, asset), outputDirectory: '.advjs/audio-release/variants', kind: asset.kind as AudioProcessingKind, purpose: 'release', toolchain, approvedProfiles, signal, runner: options.runner })
      await store.mutate(state => (state.receipts[digest(canonicalAudioJson(receipt))] = receipt))
      receipts.push({ assetId: asset.id, kind: asset.kind as AudioProcessingKind, receipt, ...(asset.kind === 'voice' ? selected(reviewedProgram.ledger, asset.id) : {}) })
    }
    const plan = planAudioRelease({
      projectPrefix: options.projectPrefix,
      approvedProfiles,
      sourceCatalog: snapshot.catalog,
      voiceLedger: reviewedProgram.ledger,
      assets: receipts,
      manifest: (objects) => {
        const catalog = publicCatalog(snapshot, objects, new Map(receipts.map(record => [record.assetId, Math.max(...record.receipt.outputs.map(output => output.metadata.duration))])))
        return { catalog, objectKey: `${options.projectPrefix}/manifests/assets.${digest(`${canonicalAudioJson(catalog)}\n`)}.json` }
      },
    })
    const consentHashes: Record<string, string> = {}
    for (const authorization of plan.voiceAuthorizations) {
      const sha256 = await consent(authorization)
      if (sha256)
        consentHashes[authorization.takeId] = sha256
    }
    return await withProjectWriteLock(root, async () => {
      signal?.throwIfAborted()
      if ((await native.read()).revision !== snapshot.revision)
        throw new Error('AUDIO_RELEASE_SOURCE_CONFLICT')
      await assertCurrentProgram(reviewedProgram.sha256)
      return await store.mutate((state) => {
        const now = Date.now()
        state.plans = Object.fromEntries(Object.entries(state.plans).filter(([, value]) => Date.parse(value.review.expiresAt) > now))
        if (Object.keys(state.plans).length >= 20)
          throw new Error('AUDIO_RELEASE_REVIEW_LIMIT')
        const review: HostedAudioReleaseReview = { planId: randomUUID(), sourceRevision: snapshot.revision, expectedManifestRevision: state.current?.revision ?? null, expiresAt: new Date(now + 30 * 60_000).toISOString(), assetCount: assets.length, objectCount: plan.objects.length, bytes: plan.objects.reduce((total, object) => total + object.bytes, 0), assets: assets.map(asset => ({ id: asset.id, kind: asset.kind, title: asset.title ?? asset.id })) }
        state.plans[review.planId] = { review, plan, consentHashes, reviewedProgramSha256: reviewedProgram.sha256 }
        return review
      })
    })
  }

  const workers = new Map<string, { promise: Promise<void>, controller: AbortController }>()
  let closed = false
  function schedule(id: string) {
    if (closed || workers.has(id))
      return
    const controller = new AbortController()
    const promise = processingPermit(async () => {
      controller.signal.throwIfAborted()
      const task = (await store.read()).preparations[id]
      if (!task || !['queued', 'running'].includes(task.state.status))
        return
      await store.mutate(state => (state.preparations[id]!.state = { id, status: 'running' }))
      const review = await prepare(task.input, controller.signal)
      await store.mutate(state => (state.preparations[id]!.state = { id, status: 'ready', review }))
    }).catch(async (error) => {
      const code = error instanceof Error ? error.message.match(/^([A-Z][A-Z0-9_]{0,79})(?::|$)/u)?.[1] : undefined
      await store.mutate(state => (state.preparations[id]!.state = { id, status: 'failed', error: controller.signal.aborted ? 'AUDIO_RELEASE_PREPARATION_INTERRUPTED' : code ?? 'AUDIO_RELEASE_PREPARATION_FAILED' })).catch(() => {})
    }).finally(() => workers.delete(id))
    workers.set(id, { promise, controller })
  }
  async function beginPrepare(raw: unknown): Promise<HostedAudioReleasePreparation> {
    if (closed)
      throw new Error('AUDIO_RELEASE_WORKER_CLOSED')
    const input = preparationInput(raw)
    const snapshot = await native.read()
    if (input.expectedSourceRevision !== undefined && input.expectedSourceRevision !== snapshot.revision)
      throw new Error('AUDIO_RELEASE_SOURCE_CONFLICT')
    input.expectedSourceRevision = snapshot.revision
    const state = await store.mutate((state) => {
      for (const [id, task] of Object.entries(state.preparations)) {
        if (['queued', 'running'].includes(task.state.status) && canonicalAudioJson(task.input) === canonicalAudioJson(input))
          return task.state
        if (Date.parse(task.createdAt) < Date.now() - 30 * 60_000 && !['queued', 'running'].includes(task.state.status))
          delete state.preparations[id]
      }
      if (Object.keys(state.preparations).length >= 20)
        throw new Error('AUDIO_RELEASE_REVIEW_LIMIT')
      const id = randomUUID()
      const task: HostedAudioReleasePreparation = { id, status: 'queued' }
      state.preparations[id] = { state: task, input, createdAt: new Date().toISOString() }
      return task
    })
    schedule(state.id)
    return state
  }
  async function preparation(id: string): Promise<HostedAudioReleasePreparation> {
    if (!/^[a-f0-9-]{36}$/u.test(id))
      throw new Error('AUDIO_RELEASE_INPUT_INVALID')
    const task = (await store.read()).preparations[id]
    if (!task)
      throw new Error('AUDIO_RELEASE_PREPARATION_NOT_FOUND')
    return task.state
  }
  for (const [id, task] of Object.entries((await store.read()).preparations)) {
    if (['queued', 'running'].includes(task.state.status))
      schedule(id)
  }

  async function publish(input: unknown): Promise<HostedAudioPublication> {
    object(input)
    if (Object.keys(input).some(key => !['planId', 'expectedManifestRevision', 'expectedSourceRevision'].includes(key)) || typeof input.planId !== 'string' || !/^[a-f0-9-]{36}$/u.test(input.planId)
      || !(input.expectedManifestRevision === null || revision(input.expectedManifestRevision)) || (input.expectedSourceRevision !== undefined && !revision(input.expectedSourceRevision))) {
      throw new Error('AUDIO_RELEASE_INPUT_INVALID')
    }
    return await withProjectWriteLock(root, async () => {
      const state = await store.read()
      const stored = state.plans[input.planId as string]
      if (!stored || Date.parse(stored.review.expiresAt) <= Date.now())
        throw new Error('AUDIO_RELEASE_REVIEW_EXPIRED')
      if ((await native.read()).revision !== stored.review.sourceRevision || (input.expectedSourceRevision !== undefined && input.expectedSourceRevision !== stored.review.sourceRevision))
        throw new Error('AUDIO_RELEASE_SOURCE_CONFLICT')
      const currentSource = await assertCurrentProgram(stored.reviewedProgramSha256)
      const verifyReceipt = async (record: AudioReleaseAssetRecord) => {
        const receipt = (await store.read()).receipts[digest(canonicalAudioJson(record.receipt))]
        const current = await native.read()
        if (current.revision !== stored.review.sourceRevision)
          throw new Error('AUDIO_RELEASE_SOURCE_CONFLICT')
        const asset = current.catalog.assets.find(asset => asset.id === record.source.assetId)
        if (!receipt || !asset || asset.sha256 !== record.source.masterSha256 || digest(await media(audioProjectMediaPath(current.catalog, asset))) !== asset.sha256)
          throw new Error('AUDIO_RELEASE_RECEIPT_UNTRUSTED')
        for (const output of receipt.outputs) {
          const bytes = await media(output.path)
          if (bytes.byteLength !== output.metadata.bytes || digest(bytes) !== output.metadata.sha256)
            throw new Error('AUDIO_RELEASE_OUTPUT_CHANGED')
        }
        if (record.voice && canonicalAudioJson(selected(currentSource.ledger, asset.id)) !== canonicalAudioJson({ lineId: record.voice.lineId, locale: record.voice.locale, speakerId: record.voice.speakerId, takeId: record.voice.takeId }))
          throw new Error('AUDIO_RELEASE_VOICE_SELECTED_TAKE_REQUIRED')
        return { ...record, receipt }
      }
      const authorizeVoice = async (authorization: AudioVoicePublicationAuthorization) => {
        if (await consent(authorization) !== stored.consentHashes[authorization.takeId])
          throw new Error('AUDIO_RELEASE_VOICE_CONSENT_CHANGED')
      }
      const verifyReviewedSources = async () => {
        const current = await native.read()
        if (current.revision !== stored.review.sourceRevision)
          throw new Error('AUDIO_RELEASE_SOURCE_CONFLICT')
        await assertCurrentProgram(stored.reviewedProgramSha256)
        for (const record of stored.plan.assets) {
          const asset = current.catalog.assets.find(asset => asset.id === record.source.assetId)
          if (!asset || digest(await media(audioProjectMediaPath(current.catalog, asset))) !== record.source.masterSha256)
            throw new Error('AUDIO_RELEASE_MASTER_CHANGED')
        }
        for (const authorization of stored.plan.voiceAuthorizations)
          await authorizeVoice(authorization)
      }
      const nextRevision = digest(stored.plan.manifest.content)
      if (input.expectedManifestRevision !== stored.review.expectedManifestRevision)
        throw new Error('AUDIO_RELEASE_MANIFEST_CONFLICT')
      // Recover an acknowledged-or-lost HTTP response without reuploading.
      if (state.current?.revision === nextRevision) {
        for (const record of stored.plan.assets)
          await verifyReceipt(record)
        for (const authorization of stored.plan.voiceAuthorizations)
          await authorizeVoice(authorization)
        return state.current
      }
      if ((state.current?.revision ?? null) !== input.expectedManifestRevision)
        throw new Error('AUDIO_RELEASE_MANIFEST_CONFLICT')
      await publishAudioRelease(stored.plan, {
        verifyProcessingReceipt: verifyReceipt,
        authorizeVoice,
        verify: async (object) => {
          await storage.assertImmutableBucket()
          return await verifyStoredObject(object.objectKey, object.bytes, object.sha256, object.mimeType, object.cacheControl)
        },
        uploadImmutable: async (object) => {
          const bytes = await media(object.path)
          if (bytes.byteLength !== object.bytes || digest(bytes) !== object.sha256)
            throw new Error('AUDIO_RELEASE_OUTPUT_CHANGED')
          await immutablePut(object.objectKey, bytes, object.mimeType, object.cacheControl)
        },
        commitManifest: async (manifest, expectedRevision) => {
          await verifyReviewedSources()
          // Immutable manifest bytes go last; the durable host pointer is the CAS.
          // COS PUT has no assumed If-Match operation. Failed CAS leaves only a
          // harmless unreferenced immutable object, never a replaced public file.
          const bytes = Buffer.from(manifest.content)
          if (await verifyStoredObject(manifest.objectKey, bytes.byteLength, digest(bytes), 'application/json; charset=utf-8', immutableCache) !== 'verified')
            await immutablePut(manifest.objectKey, bytes, 'application/json; charset=utf-8', immutableCache)
          await verifyReviewedSources()
          await store.mutate((latest) => {
            if ((latest.current?.revision ?? null) !== expectedRevision)
              throw new Error('AUDIO_RELEASE_MANIFEST_CONFLICT')
            latest.current = { revision: nextRevision, manifestObjectKey: manifest.objectKey, manifestUrl: new URL(manifest.objectKey, base).href, publishedAt: new Date().toISOString() }
          })
        },
      }, { approvedProfiles, expectedManifestRevision: input.expectedManifestRevision as string | null })
      return (await store.read()).current!
    })
  }
  return {
    prepare,
    beginPrepare,
    preparation,
    preparations: async () => Object.values((await store.read()).preparations).map(task => task.state),
    publish,
    current: async () => (await store.read()).current,
    async close() {
      closed = true
      for (const worker of workers.values())
        worker.controller.abort()
      await Promise.allSettled([...workers.values()].map(worker => worker.promise))
    },
  }
}
