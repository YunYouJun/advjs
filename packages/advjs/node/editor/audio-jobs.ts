import type { VoiceGenerationJob, VoiceGenerationResolvedInput, VoiceGenerationTask } from '@advjs/audio'
import type { AdvConfig, VoiceAuthoringSnapshot } from '@advjs/types'
import type { EditorVoiceJobsPlanInput, EditorVoiceJobsPort, EditorVoiceJobsReviewedPlan, EditorVoiceJobsSnapshot } from '../../shared/editor-audio'
import type { HostedVoicePreparedInput, HostedVoicePrepareInput } from '../../shared/hosted-audio'
import { createHash } from 'node:crypto'
import { readFile, realpath, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { audioFingerprint, audioProjectMediaPath, createAudioId, createVoiceGenerationRunner, normalizeAudioLocale, parseVoiceDesignLibrary, planVoiceGeneration, resolveVoiceSpokenText, VOICE_DESIGN_LIBRARY_PATH, voiceDesignVersion, voiceGenerationInputFingerprint, VoiceGenerationNotDispatchedError } from '@advjs/audio'
import { isAbsolute, relative, resolve } from 'pathe'
import { createNodeVoiceGenerationStore } from '../audio/job-store'
import { withVoiceProviderPermit } from '../audio/provider-permit'
import { createNodeVoiceAuthoringService } from '../audio/voice'
import { assertVoiceSynthesisProvenance, canonicalVoiceGenerationParameters } from '../audio/voice-provenance'
import { runVoicePreview, runVoiceProviders } from '../commands/voice'
import { loadAdvConfig } from '../config'
import { loadProject } from '../project'

export interface EditorVoiceJobsHostOptions {
  projectRoot: string
  /** Trusted-host/test configuration only; never accepted in an HTTP body. */
  config?: Partial<AdvConfig>
  storeDirectory?: string
  validateProjectAccess?: () => Promise<void>
  /** Trusted hosted identity; HTTP callers cannot choose this scope. */
  scope?: { accountId: string, projectId: string }
  verifyProvider?: (providerId: string) => Promise<void>
  withProviderPermit?: <T>(providerId: string, signal: AbortSignal, operation: () => Promise<T>) => Promise<T>
}

export class EditorVoiceJobsError extends Error {
  readonly statusCode = 400
}

function fail(code: string): never {
  throw new EditorVoiceJobsError(code)
}

/** Provider errors can contain credentials, paths and prose. Expose only codes. */
export function editorVoiceJobsErrorCode(error: unknown) {
  const code = error instanceof Error ? error.message.match(/^([A-Z][A-Z0-9_]{0,79})(?::|$)/u)?.[1] : undefined
  return code ?? 'ADV_AUDIO_JOBS_FAILED'
}

function fields(value: unknown, keys: string[]): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).every(key => keys.includes(key)))
}

function validatePlanInput(input: EditorVoiceJobsPlanInput) {
  if (!fields(input, ['lineIds', 'locale', 'providerId', 'budget']) || !Array.isArray(input.lineIds) || !input.lineIds.length || input.lineIds.length > 200
    || new Set(input.lineIds).size !== input.lineIds.length || input.lineIds.some(id => typeof id !== 'string') || typeof input.locale !== 'string' || typeof input.providerId !== 'string'
    || !fields(input.budget, ['maxCharacters', 'maxCost', 'allowUnknownCost', 'concurrency']) || (input.budget.maxCost !== undefined && !fields(input.budget.maxCost, ['currency', 'amountMicros']))) {
    fail('ADV_AUDIO_JOB_INPUT_INVALID')
  }
}

/** One host runner for the project; all native writes use the existing locked authoring service. */
export async function createEditorVoiceJobsHost(options: EditorVoiceJobsHostOptions): Promise<EditorVoiceJobsPort & { prepare: (input: HostedVoicePrepareInput) => Promise<HostedVoicePreparedInput>, validateEnqueue: (input: { planId: string, planHash: string }) => Promise<VoiceGenerationJob>, close: () => Promise<void> }> {
  const root = await realpath(resolve(options.projectRoot))
  const projectId = options.scope?.projectId ?? createHash('sha256').update(root).digest('hex')
  const accountId = options.scope?.accountId ?? createHash('sha256').update(`advjs-local:${homedir()}`).digest('hex')
  if (!projectId.trim() || !accountId.trim())
    fail('ADV_AUDIO_JOB_SCOPE_INVALID')
  const store = await createNodeVoiceGenerationStore({ projectRoot: root, directory: options.storeDirectory })
  const authoring = await createNodeVoiceAuthoringService({ root, config: options.config })
  const reviews = new Map<string, { reviewed: EditorVoiceJobsReviewedPlan, expiresAt: number }>()
  const active = new Map<string, Promise<VoiceGenerationJob>>()
  const providerConcurrency: Record<string, number> = {}
  let closed = false

  async function access() {
    if (closed)
      fail('ADV_AUDIO_JOB_HOST_CLOSED')
    await options.validateProjectAccess?.()
    const project = await loadProject({ root, allowEmptyAssetManifest: true })
    if (project.result.project.root !== 'adv')
      fail('ADV_AUDIO_CONTENT_ROOT_UNSUPPORTED')
    return project
  }
  async function configured() {
    const { config } = await loadAdvConfig({ userRoot: root, advConfig: options.config })
    const voice = config.authoring?.voice
    if (!voice)
      fail('ADV_AUDIO_JOB_PROVIDER_UNCONFIGURED')
    const result = await runVoiceProviders({ root, config: options.config })
    const providers = result.providers.filter(provider => provider.capabilities?.synthesis).map(provider => ({ id: provider.id, backend: provider.capabilities!.backend, models: provider.capabilities!.models.map(model => model.id), default: provider.default }))
    if (!providers.length)
      fail('ADV_AUDIO_JOB_PROVIDER_UNCONFIGURED')
    for (const provider of providers)
      providerConcurrency[provider.id] = provider.backend === 'local' ? 1 : 3
    return { voice, providers }
  }
  async function resolveInput(target: Pick<VoiceGenerationTask, 'lineId' | 'locale' | 'providerId' | 'id'>, snapshot: VoiceAuthoringSnapshot): Promise<VoiceGenerationResolvedInput> {
    const project = await access()
    const { voice, providers } = await configured()
    if (!providers.some(provider => provider.id === target.providerId))
      fail('ADV_AUDIO_JOB_PROVIDER_UNCONFIGURED')
    const nodes = Object.values(project.result.project.program?.chapters ?? {}).flatMap(chapter => Object.values(chapter.nodes)).filter(node => ['dialog', 'narration'].includes(node.kind) && node.data?.lineId === target.lineId)
    if (nodes.length !== 1)
      fail('ADV_AUDIO_JOB_LINE_INVALID')
    const node = nodes[0]!
    const speakerId = String(node.data?.speakerId ?? 'narrator')
    const locale = normalizeAudioLocale(target.locale)
    const profile = speakerId === 'narrator' ? snapshot.narratorProfile : project.result.project.characters.find(character => character.id === speakerId)?.voiceProfile
    const implementation = profile?.locales?.[locale]?.providers[target.providerId]
    if (!profile || !implementation?.model || implementation.source === 'recorded')
      fail('ADV_AUDIO_JOB_PROFILE_REQUIRED')
    if (implementation.projectVoiceId) {
      const library = parseVoiceDesignLibrary(await readFile(resolve(root, VOICE_DESIGN_LIBRARY_PATH), 'utf8'))
      const design = voiceDesignVersion(library, implementation.projectVoiceId)
      if (design.version !== implementation.projectVoiceVersion || design.characterId !== speakerId)
        fail('ADV_AUDIO_JOB_PROFILE_MISMATCH')
    }
    const saved = snapshot.ledger.lines[target.lineId]
    const localized = saved?.locales[locale]
    const configuredLocale = project.result.project.game.locale
    const sourceLocale = normalizeAudioLocale(typeof configuredLocale === 'string' ? configuredLocale : 'zh-CN')
    const displayText = locale === sourceLocale ? String(node.data?.text ?? '') : localized?.displayText ?? String(node.data?.text ?? '')
    const spokenText = localized?.spokenText ?? saved?.spokenText
    const mapped = Object.entries(voice.presetProviders ?? {}).filter(([, provider]) => provider === target.providerId).map(([preset]) => preset)
    const defaultOwner = voice.presetProviders?.[voice.defaultPreset] ?? voice.defaultProvider
    const preset = defaultOwner === target.providerId || (!defaultOwner && !mapped.length)
      ? voice.defaultPreset
      : mapped.length === 1 ? mapped[0]! : undefined
    if (!preset && !implementation.projectVoiceId)
      fail('ADV_AUDIO_JOB_PRESET_AMBIGUOUS')
    const inspected = await runVoicePreview({ root, config: options.config, provider: target.providerId, ...(implementation.projectVoiceId ? { voice: implementation.projectVoiceId, locale } : { preset }), character: speakerId, text: resolveVoiceSpokenText(displayText, { override: spokenText, locale, pronunciation: snapshot.pronunciation }), list: true })
    if (!('characters' in inspected) || !('configPath' in inspected))
      fail('ADV_AUDIO_JOB_INSPECTION_REQUIRED')
    const actual = inspected.characters.find(character => character.id === speakerId)?.generation
    // Provider inspection owns this data. Never infer supplier IDs from filenames or provider names.
    if (!actual?.model || !actual.providerVoiceId || !actual.source || actual.model !== implementation.model || actual.providerVoiceId !== implementation.voiceId || actual.source !== implementation.source)
      fail('ADV_AUDIO_JOB_PROFILE_MISMATCH')
    if (!implementation.projectVoiceId && !providers.find(provider => provider.id === target.providerId)?.models.includes(actual.model))
      fail('ADV_AUDIO_JOB_MODEL_UNSUPPORTED')
    const presetHash = createHash('sha256').update(await readFile(inspected.configPath)).digest('hex')
    if (inspected.presetSha256 && inspected.presetSha256 !== presetHash)
      fail('ADV_AUDIO_JOB_REVIEW_STALE')
    const format = actual.mimeType
    const extension = ({ 'audio/wav': 'wav', 'audio/mpeg': 'mp3', 'audio/ogg': 'ogg', 'audio/mp4': 'm4a', 'audio/flac': 'flac', 'audio/webm': 'webm' } as Record<string, string>)[format ?? '']
    if (!extension)
      fail('ADV_AUDIO_JOB_FORMAT_UNSUPPORTED')
    return {
      lineId: target.lineId,
      locale,
      speakerId,
      displayText,
      pronunciation: snapshot.pronunciation,
      ...(spokenText === undefined ? {} : { spokenText }),
      providerId: target.providerId,
      voiceId: actual.providerVoiceId,
      providerVoiceId: actual.providerVoiceId,
      model: actual.model,
      voiceProfileRevision: await audioFingerprint(profile),
      source: actual.source,
      ...(implementation.rights ? { rights: implementation.rights } : {}),
      assetPath: `voice/${target.id}.${extension}`,
      parameters: { ...canonicalVoiceGenerationParameters(inspected, speakerId, presetHash), ...(implementation.projectVoiceId ? { projectVoiceId: implementation.projectVoiceId, projectVoiceVersion: implementation.projectVoiceVersion!, locale } : {}) },
    }
  }
  async function verifyInput(input: VoiceGenerationResolvedInput, snapshot?: VoiceAuthoringSnapshot) {
    await access()
    await options.verifyProvider?.(input.providerId)
    const { voice } = await configured()
    const preset = input.parameters?.preset
    let coordinate = typeof preset === 'string' ? voice.presets[preset] : undefined
    if (typeof input.parameters?.projectVoiceId === 'string') {
      const inspected = await runVoicePreview({ root, config: options.config, provider: input.providerId, voice: input.parameters.projectVoiceId, locale: input.locale, character: input.speakerId, list: true })
      if ('configPath' in inspected)
        coordinate = relative(root, inspected.configPath)
    }
    if (!coordinate || !input.parameters?.presetSha256)
      fail('ADV_AUDIO_JOB_REVIEW_STALE')
    const presetPath = await realpath(resolve(root, coordinate))
    const presetLocal = relative(root, presetPath)
    if (isAbsolute(presetLocal) || presetLocal === '..' || presetLocal.startsWith('../') || createHash('sha256').update(await readFile(presetPath)).digest('hex') !== input.parameters.presetSha256)
      fail('ADV_AUDIO_JOB_REVIEW_STALE')
    if (input.source !== 'cloned')
      return
    const consent = input.rights?.consentRecord
    if (!consent || consent.includes('\\') || consent.includes(':') || consent.split('/').some(part => !part || ['.', '..', '.git', 'node_modules'].includes(part.toLowerCase())))
      fail('ADV_AUDIO_VOICE_CONSENT_REQUIRED')
    const path = await realpath(resolve(root, consent)).catch(() => undefined)
    const local = path ? relative(root, path) : '..'
    if (!path || isAbsolute(local) || local === '..' || local.startsWith('../') || local.split('/').some(part => ['.git', 'node_modules'].includes(part.toLowerCase())) || !(await stat(path)).isFile())
      fail('ADV_AUDIO_VOICE_CONSENT_REQUIRED')
    const native = snapshot ?? await authoring.read()
    const reference = native.catalog.assets.find(asset => asset.id === input.parameters?.referenceAssetId)
    if (!reference || reference.type !== 'audio' || reference.kind !== 'reference' || reference.sha256 !== input.parameters?.referenceSha256)
      fail('ADV_AUDIO_VOICE_REFERENCE_REQUIRED')
    const profile = native.catalog.profiles[native.catalog.defaultProfile]
    const profileRoot = profile?.provider === 'project' ? await realpath(resolve(root, profile.root ?? '.')) : undefined
    const referencePath = await realpath(resolve(root, audioProjectMediaPath(native.catalog, reference)))
    const referenceLocal = relative(root, referencePath)
    const profileLocal = profileRoot ? relative(profileRoot, referencePath) : '..'
    const profileProjectLocal = profileRoot ? relative(root, profileRoot) : '..'
    if (!profileRoot || isAbsolute(referenceLocal) || referenceLocal === '..' || referenceLocal.startsWith('../') || referenceLocal.split('/').some(part => ['.git', 'node_modules'].includes(part.toLowerCase()))
      || isAbsolute(profileProjectLocal) || profileProjectLocal === '..' || profileProjectLocal.startsWith('../')
      || isAbsolute(profileLocal) || profileLocal === '..' || profileLocal.startsWith('../') || !(await stat(referencePath)).isFile() || createHash('sha256').update(await readFile(referencePath)).digest('hex') !== reference.sha256) {
      fail('ADV_AUDIO_VOICE_REFERENCE_REQUIRED')
    }
  }
  await configured().catch((error) => {
    if (editorVoiceJobsErrorCode(error) !== 'ADV_AUDIO_JOB_PROVIDER_UNCONFIGURED')
      throw error
  })
  const guardedAuthoring = {
    ...authoring,
    async register(input: Parameters<typeof authoring.register>[0]) {
      // The runner passes its ephemeral dictionary through registration; it never
      // enters the durable job. Freeze that exact dispatch before opening the lock.
      const model = input.candidate.model
      if (!model)
        fail('ADV_AUDIO_JOB_PROVENANCE_CHANGED')
      const pronunciation = (input as typeof input & Pick<VoiceGenerationResolvedInput, 'pronunciation'>).pronunciation
      const dispatched: VoiceGenerationResolvedInput = { ...input, providerId: input.candidate.provider, voiceId: input.providerVoiceId ?? input.candidate.providerVoiceId ?? '', model, pronunciation }
      const fingerprint = await voiceGenerationInputFingerprint(dispatched)
      const service = await createNodeVoiceAuthoringService({ root, config: options.config }, {
        async verifyBeforeCommit() {
          const snapshot = await authoring.read()
          const current = await resolveInput({ id: createAudioId('job'), lineId: input.lineId, locale: input.locale, providerId: input.candidate.provider }, snapshot)
          if (await voiceGenerationInputFingerprint(current) !== fingerprint)
            fail('ADV_AUDIO_JOB_REVIEW_STALE')
          await verifyInput(current, snapshot)
        },
      })
      return await service.register(input)
    },
  }
  const runner = createVoiceGenerationRunner({
    store,
    authoring: guardedAuthoring,
    resolve: resolveInput,
    verifyInput,
    providerConcurrency,
    async execute(input, context) {
      let dispatched = false
      let result: Awaited<ReturnType<typeof runVoicePreview>>
      try {
        context.signal.throwIfAborted()
        await verifyInput(input)
        const operation = async () => {
          context.signal.throwIfAborted()
          const snapshot = await authoring.read()
          const current = await resolveInput({ id: createAudioId('job'), lineId: input.lineId, locale: input.locale, providerId: input.providerId }, snapshot)
          if (current.lineId !== input.lineId || current.locale !== input.locale || current.speakerId !== input.speakerId || current.providerId !== input.providerId || await voiceGenerationInputFingerprint(current) !== await voiceGenerationInputFingerprint(input))
            fail('ADV_AUDIO_JOB_REVIEW_STALE')
          await verifyInput(current, snapshot)
          context.signal.throwIfAborted()
          dispatched = true
          return await runVoicePreview({ root, config: options.config, provider: current.providerId, ...(typeof current.parameters?.projectVoiceId === 'string' ? { voice: current.parameters.projectVoiceId, locale: current.locale } : { preset: String(current.parameters?.preset) }), character: current.speakerId, text: resolveVoiceSpokenText(current.displayText, { override: current.spokenText, locale: current.locale, pronunciation: current.pronunciation }), signal: context.signal })
        }
        result = options.withProviderPermit ? await options.withProviderPermit(input.providerId, context.signal, operation) : await withVoiceProviderPermit(input.providerId, providerConcurrency[input.providerId] ?? 1, context.signal, operation)
      }
      catch (error) {
        if (!dispatched)
          throw new VoiceGenerationNotDispatchedError()
        if (error instanceof VoiceGenerationNotDispatchedError)
          throw new Error('ADV_AUDIO_JOB_PROVIDER_RESULT_UNKNOWN')
        throw error
      }
      if (!('candidates' in result) || !result.candidates)
        fail('ADV_AUDIO_JOB_INSPECTION_REQUIRED')
      assertVoiceSynthesisProvenance({ ...result, candidates: result.candidates }, { providerId: input.providerId, preset: String(input.parameters?.preset), speakerId: input.speakerId, voiceId: input.voiceId, model: input.model, parameters: input.parameters ?? {} })
      return { ...result, candidates: result.candidates }
    },
  })
  async function scopedJob(id: string) {
    const job = await runner.read(id)
    if (job.accountId !== accountId || job.projectId !== projectId)
      fail('ADV_AUDIO_JOB_SCOPE_INVALID')
    return job
  }
  function pruneReviews() {
    for (const [id, review] of reviews) {
      if (review.expiresAt < Date.now())
        reviews.delete(id)
    }
  }
  async function validateEnqueue(input: { planId: string, planHash: string }) {
    if (!fields(input, ['planId', 'planHash']) || typeof input.planId !== 'string' || typeof input.planHash !== 'string')
      fail('ADV_AUDIO_JOB_REVIEW_REQUIRED')
    await access()
    pruneReviews()
    const stored = reviews.get(input.planId)?.reviewed
    if (!stored || stored.planHash !== input.planHash)
      fail('ADV_AUDIO_JOB_REVIEW_REQUIRED')
    if ((await authoring.read()).revision !== stored.snapshotRevision)
      fail('ADV_AUDIO_JOB_REVIEW_STALE')
    const snapshot = await authoring.read()
    const lines = await Promise.all(stored.plan.tasks.map(async task => ({ ...await resolveInput(task, snapshot), estimatedCost: task.estimatedCost })))
    for (const line of lines)
      await verifyInput(line, snapshot)
    const checked = await planVoiceGeneration({ accountId, projectId, snapshot, lines, budget: stored.plan.budget })
    if (checked.tasks.some((task, index) => task.inputFingerprint !== stored.plan.tasks[index]?.inputFingerprint))
      fail('ADV_AUDIO_JOB_REVIEW_STALE')
    return stored.plan
  }

  return {
    validateEnqueue,
    async prepare(input) {
      if (!fields(input, ['lineId', 'locale', 'providerId']) || typeof input.lineId !== 'string' || typeof input.locale !== 'string' || typeof input.providerId !== 'string')
        fail('ADV_AUDIO_JOB_INPUT_INVALID')
      const snapshot = await authoring.read()
      const resolved = await resolveInput({ ...input, id: createAudioId('job') }, snapshot)
      await verifyInput(resolved, snapshot)
      return {
        lineId: resolved.lineId,
        locale: resolved.locale,
        providerId: resolved.providerId,
        speakerId: resolved.speakerId,
        voiceId: resolved.voiceId,
        model: resolved.model,
        source: resolved.source,
        ...(resolved.rights ? { rights: resolved.rights } : {}),
        voiceProfileRevision: resolved.voiceProfileRevision,
        parameters: resolved.parameters,
        assetPath: resolved.assetPath,
        inputFingerprint: await voiceGenerationInputFingerprint(resolved),
        characterCount: Array.from(resolveVoiceSpokenText(resolved.displayText, { override: resolved.spokenText, locale: resolved.locale, pronunciation: resolved.pronunciation })).length,
      }
    },
    async read() {
      await access()
      const jobs = Object.values((await store.read()).jobs).filter(job => job.projectId === projectId && job.accountId === accountId).sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      try {
        const { voice, providers } = await configured()
        return { configured: true, defaultPreset: voice.defaultPreset, providers, jobs } satisfies EditorVoiceJobsSnapshot
      }
      catch (error) {
        if (editorVoiceJobsErrorCode(error) !== 'ADV_AUDIO_JOB_PROVIDER_UNCONFIGURED')
          throw error
        return { configured: false, unavailableCode: 'ADV_AUDIO_JOB_PROVIDER_UNCONFIGURED', providers: [], jobs }
      }
    },
    async plan(input) {
      validatePlanInput(input)
      await access()
      pruneReviews()
      if (reviews.size >= 20)
        fail('ADV_AUDIO_JOB_REVIEW_LIMIT')
      const snapshot = await authoring.read()
      const lines = await Promise.all(input.lineIds.map(async lineId => ({ ...await resolveInput({ id: createAudioId('job'), lineId, locale: input.locale, providerId: input.providerId }, snapshot), estimatedCost: null })))
      for (const line of lines)
        await verifyInput(line)
      const plan = await planVoiceGeneration({ accountId, projectId, snapshot, lines, budget: input.budget })
      const reviewed = { plan, planHash: await audioFingerprint(plan), snapshotRevision: snapshot.revision }
      reviews.set(plan.id, { reviewed: structuredClone(reviewed), expiresAt: Date.now() + 15 * 60_000 })
      return reviewed
    },
    async enqueue(input) {
      const result = await runner.enqueue(await validateEnqueue(input))
      reviews.delete(input.planId)
      return result
    },
    async command(input) {
      if (!fields(input, ['jobId', 'action', 'taskIds']) || typeof input.jobId !== 'string' || !['run', 'cancel', 'resume', 'retry'].includes(input.action) || (input.taskIds !== undefined && (!Array.isArray(input.taskIds) || input.taskIds.some(id => typeof id !== 'string'))))
        fail('ADV_AUDIO_JOB_INPUT_INVALID')
      await access()
      await scopedJob(input.jobId)
      if (input.action === 'cancel')
        return await runner.cancel(input.jobId)
      if (input.action === 'resume')
        return await runner.resume(input.jobId)
      if (input.action === 'retry')
        return await runner.retry(input.jobId, input.taskIds)
      if (!active.has(input.jobId)) {
        const operation = runner.run(input.jobId)
        active.set(input.jobId, operation)
        void operation.catch(() => {}).finally(() => active.delete(input.jobId))
      }
      return await scopedJob(input.jobId)
    },
    async close() {
      closed = true
      reviews.clear()
      for (const id of active.keys())
        await runner.cancel(id)
      await Promise.allSettled(active.values())
    },
  }
}
