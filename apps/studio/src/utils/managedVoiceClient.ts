import type { VoiceGenerationJob, VoiceGenerationResolvedInput } from '@advjs/audio'
import type { VoiceAuthoringSnapshot } from '@advjs/types'
import type { HostedVoiceJobsSnapshot, HostedVoicePlanInput, HostedVoicePreparedInput, HostedVoiceReceipts, HostedVoiceReviewedPlan, HostedVoiceSyncState } from '../../../../packages/advjs/shared/hosted-audio'
import type { IFileSystem } from './fs'
import type { ManagedVoiceHttpOptions } from './managedVoiceHttp'
import type { StudioVoiceJobContext } from './voiceGeneration'
import { audioProjectMediaPath, canonicalAudioJson, parseVoiceDesignLibrary, parseVoiceGenerationStore, verifyVoiceCandidateBytes, voiceGenerationInputFingerprint } from '@advjs/audio'
import { createManagedVoiceHttp } from './managedVoiceHttp'
import { commitStudioProjectFiles } from './nativeProjectMutation'
import { createStudioAudioService } from './projectAudio'
import { prepareStudioVoiceJobInput, readStudioVoiceJobContext } from './voiceGeneration'

const DOCUMENT = /^(?:adv\.config\.json|adv\/settings\/game\.json|adv\/chapters\/[\w./-]+\.(?:adv\.md|chapter\.json)|adv\/characters\/[\w./-]+\.character\.(?:md|json|ya?ml)|adv\/audio\/(?:voice-ledger|pronunciation|voice-profiles|mixer|toolchain)\.json|adv\/assets\.json|adv\/assets\/[\w./-]+\.json|authoring\/voices\/(?:library\.json|designs\/[\w.-]+\/[\w.-]+\/[\w-]+\/[\w.-]+\.json))$/u
const CANONICAL_PATH = /^(?!\/)(?!.*\\)(?!.*(?:^|\/)(?:\.|\.\.|\.git|node_modules)(?:\/|$))[\w./-]+$/u

/** Export only finite native authoring documents; no executable config or app storage. */
export function selectHostedVoiceFiles(files: Record<string, string>, context: StudioVoiceJobContext, snapshot: VoiceAuthoringSnapshot) {
  const consents = new Set([
    ...Object.values(context.profiles).flatMap(profile => Object.values(profile?.locales ?? {}).flatMap(locale => Object.values(locale.providers).flatMap(binding => binding.rights?.consentRecord ? [binding.rights.consentRecord] : []))),
    ...Object.values(snapshot.ledger.lines).flatMap(line => Object.values(line.locales).flatMap(locale => locale.takes.flatMap(take => take.rights?.consentRecord ? [take.rights.consentRecord] : []))),
  ])
  if (files['authoring/voices/library.json']) {
    const library = parseVoiceDesignLibrary(files['authoring/voices/library.json'])
    for (const voice of library.voices) {
      for (const locale of Object.values(voice.design?.locales ?? {})) {
        for (const definition of Object.values(locale.providers)) {
          if (definition.rights?.consentRecord)
            consents.add(definition.rights.consentRecord)
        }
      }
    }
  }
  const selected: Record<string, string> = {}
  let bytes = 0
  for (const [path, content] of Object.entries(files)) {
    if (!CANONICAL_PATH.test(path) || !(DOCUMENT.test(path) || (consents.has(path) && /\.(?:txt|md|json)$/u.test(path))))
      continue
    const count = new TextEncoder().encode(content).byteLength
    bytes += count
    if (count > 256 * 1024 || bytes > 2 * 1024 * 1024 || Object.keys(selected).length >= 256)
      throw new Error('AUDIO_SERVICE_SNAPSHOT_LIMIT')
    selected[path] = content
  }
  if (!selected['adv.config.json'] || !selected['adv/assets.json'])
    throw new Error('AUDIO_SERVICE_NATIVE_PROJECT_REQUIRED')
  return selected
}

export function createManagedVoiceClient(options: ManagedVoiceHttpOptions) {
  const http = createManagedVoiceHttp(options)
  function checkedJob(job: VoiceGenerationJob) {
    const checked = parseVoiceGenerationStore({ schemaVersion: 1, jobs: { [job.id]: job }, idempotency: {} }).jobs[job.id]!
    if (checked.accountId !== options.accountId || checked.projectId !== options.projectId)
      throw new Error('AUDIO_JOB_SCOPE_MISMATCH')
    return checked
  }
  async function read(signal?: AbortSignal) {
    const value = await http.json<HostedVoiceJobsSnapshot>('/jobs', 'GET', undefined, signal)
    if (value.accountId !== options.accountId || value.projectId !== options.projectId || !Array.isArray(value.jobs) || !Array.isArray(value.providers))
      throw new Error('AUDIO_JOB_SCOPE_MISMATCH')
    canonicalAudioJson(value)
    if (new Set(value.jobs.map(job => job.id)).size !== value.jobs.length)
      throw new Error('AUDIO_SERVICE_RESPONSE_INVALID')
    return { ...value, jobs: value.jobs.map(checkedJob) }
  }
  async function prepare(input: VoiceGenerationResolvedInput, snapshot: VoiceAuthoringSnapshot, signal?: AbortSignal) {
    const expected = await http.json<HostedVoicePreparedInput>('/prepare', 'POST', { lineId: input.lineId, locale: input.locale, providerId: input.providerId }, signal)
    const inspected = await prepareStudioVoiceJobInput(input, snapshot, { prepare: async source => ({ ...source, ...expected }) })
    if (await voiceGenerationInputFingerprint(inspected) !== expected.inputFingerprint)
      throw new Error('AUDIO_JOB_INPUT_CHANGED')
    return inspected
  }
  async function synchronize(fs: IFileSystem, context: StudioVoiceJobContext, snapshot: VoiceAuthoringSnapshot, signal?: AbortSignal) {
    const baseline = await http.json<HostedVoiceSyncState>('/sync', 'GET', undefined, signal)
    const files = selectHostedVoiceFiles(Object.fromEntries((await fs.collectAllFiles()).map(file => [file.path, file.content])), context, snapshot)
    const synced = await http.json<HostedVoiceSyncState>('/sync', 'POST', { expectedRevision: baseline.revision, files }, signal)
    if (synced.changes?.length) {
      await commitStudioProjectFiles(fs, synced.changes, { assertCurrent: options.assertCurrent, acceptsPath: path => CANONICAL_PATH.test(path) && (DOCUMENT.test(path) || Object.hasOwn(files, path)) })
    }
    for (const asset of synced.missingMedia) {
      const local = snapshot.catalog.assets.find(item => item.id === asset.assetId)
      if (!local || local.type !== 'audio' || !['bgm', 'ambience', 'voice', 'sfx', 'ui', 'reference'].includes(local.kind) || local.kind !== asset.kind || local.sha256 !== asset.sha256)
        throw new Error('AUDIO_SERVICE_REFERENCE_MISSING')
      const blob = await fs.readBlob(audioProjectMediaPath(snapshot.catalog, local))
      const bytes = await blob.arrayBuffer()
      await verifyVoiceCandidateBytes({ sha256: asset.sha256, bytes: asset.bytes }, bytes)
      options.assertCurrent()
      await http.upload(asset.assetId, blob.slice(0, blob.size, asset.mimeType || blob.type), asset.sha256, signal)
    }
    return synced
  }
  async function plan(input: HostedVoicePlanInput, signal?: AbortSignal) {
    const reviewed = await http.json<HostedVoiceReviewedPlan>('/plan', 'POST', input, signal)
    checkedJob(reviewed.plan)
    if (!/^[a-f0-9]{64}$/u.test(reviewed.planHash) || !/^[a-f0-9]{64}$/u.test(reviewed.snapshotRevision))
      throw new Error('AUDIO_SERVICE_RESPONSE_INVALID')
    return reviewed
  }
  async function enqueue(reviewed: HostedVoiceReviewedPlan, signal?: AbortSignal) {
    return checkedJob(await http.json<VoiceGenerationJob>('/enqueue', 'POST', { planId: reviewed.plan.id, planHash: reviewed.planHash }, signal))
  }
  async function command(jobId: string, action: 'run' | 'cancel' | 'resume' | 'retry', taskIds?: string[], signal?: AbortSignal) {
    return checkedJob(await http.json<VoiceGenerationJob>('/command', 'POST', { jobId, action, ...(taskIds ? { taskIds } : {}) }, signal))
  }
  async function receipts(jobId: string, signal?: AbortSignal) {
    if (!(await read(signal)).jobs.some(job => job.id === jobId))
      throw new Error('AUDIO_JOB_NOT_FOUND')
    const value = await http.json<HostedVoiceReceipts>(`/jobs/${jobId}/receipts`, 'GET', undefined, signal)
    checkedJob(value.job)
    canonicalAudioJson(value)
    if (!Array.isArray(value.receipts) || value.job.id !== jobId)
      throw new Error('AUDIO_SERVICE_RECEIPT_INVALID')
    return value
  }
  async function syncNativeProject(fs: IFileSystem, signal?: AbortSignal) {
    const authoring = createStudioAudioService(fs)
    const snapshot = await authoring.read()
    const context = await readStudioVoiceJobContext(fs, snapshot)
    options.assertCurrent()
    const synced = await synchronize(fs, context, snapshot, signal)
    if (synced.changes?.length) {
      const current = await authoring.read()
      return { ...synced, snapshot: current, context: await readStudioVoiceJobContext(fs, current) }
    }
    return { ...synced, snapshot, context }
  }
  return { read, prepare, synchronize, syncNativeProject, plan, enqueue, command, receipts, media: http.media, request: http.json, scope: Object.freeze({ accountId: options.accountId, projectId: options.projectId }), assertCurrent: options.assertCurrent }
}

export type ManagedVoiceClient = ReturnType<typeof createManagedVoiceClient>
