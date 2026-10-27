import type { AdvVoiceCandidate } from '@advjs/types'
import type { StoredVoiceCandidate, VoiceGenerationJob, VoiceGenerationResolvedInput, VoiceGenerationRunnerOptions, VoiceGenerationTask, VoiceGenerationTaskStatus } from './contracts'
import { canonicalAudioJson } from '../fingerprint'
import { createAudioId } from '../ids'
import { audioProjectMediaPath } from '../project-media'
import { resolveVoiceSpokenText } from '../spoken-text'
import { parseVoiceAlignment } from '../voice-alignment'
import { findVoiceTakeByFingerprint, validateVoiceRights } from '../voice-ledger'
import { voiceGenerationInputFingerprint } from './planner'
import { reduceVoiceGenerationJob } from './reducer'
import { parseVoiceGenerationStore, pruneVoiceGenerationStore } from './store'

/** Trusted transports may use this only when no supplier call has begun. */
export class VoiceGenerationNotDispatchedError extends Error {
  constructor() {
    super('AUDIO_JOB_NOT_DISPATCHED')
  }
}

function storedCandidate(candidate: AdvVoiceCandidate): StoredVoiceCandidate {
  const { text: _text, characterId: _speaker, inputFingerprint: _fingerprint, alignment, ...safe } = candidate
  if (alignment) {
    const { text: _prose, ...timing } = parseVoiceAlignment(alignment, { text: candidate.text, sha256: candidate.sha256, durationSeconds: candidate.durationSeconds })
    Object.assign(safe, { alignment: timing })
  }
  canonicalAudioJson(JSON.parse(JSON.stringify(safe)))
  return JSON.parse(JSON.stringify(safe)) as StoredVoiceCandidate
}

/** Existing authoring services own synthesis, verified registration and catalog writes. */
export function createVoiceGenerationRunner(options: VoiceGenerationRunnerOptions) {
  const now = options.now ?? Date.now
  const controllers = new Map<string, AbortController>()
  const pending = new Map<string, Promise<VoiceGenerationJob>>()
  let registration = Promise.resolve()
  const providerInFlight = new Map<string, number>()
  const providerWaiters = new Map<string, Array<{ enter: () => void, signal: AbortSignal }>>()

  async function providerPermit(provider: string, signal: AbortSignal): Promise<() => void> {
    const limit = options.providerConcurrency?.[provider] ?? 32
    if (!Number.isInteger(limit) || limit < 1 || limit > 32)
      throw new Error('AUDIO_JOB_CONCURRENCY_INVALID')
    signal.throwIfAborted()
    return await new Promise<() => void>((resolvePermit, reject) => {
      let entered = false
      const waiters = providerWaiters.get(provider) ?? []
      providerWaiters.set(provider, waiters)
      const waiter = {
        signal,
        enter() {
          entered = true
          signal.removeEventListener('abort', abort)
          providerInFlight.set(provider, (providerInFlight.get(provider) ?? 0) + 1)
          let released = false
          resolvePermit(() => {
            if (released)
              return
            released = true
            providerInFlight.set(provider, providerInFlight.get(provider)! - 1)
            const next = waiters.shift()
            next?.enter()
          })
        },
      }
      function abort() {
        if (entered)
          return
        const index = waiters.indexOf(waiter)
        if (index >= 0)
          waiters.splice(index, 1)
        reject(new DOMException('Aborted', 'AbortError'))
      }
      if ((providerInFlight.get(provider) ?? 0) < limit) {
        waiter.enter()
      }
      else {
        waiters.push(waiter)
        signal.addEventListener('abort', abort, { once: true })
      }
    })
  }

  async function job(id: string) {
    const result = (await options.store.read()).jobs[id]
    if (!result)
      throw new Error('AUDIO_JOB_NOT_FOUND: The durable job does not exist')
    return result
  }

  async function change(id: string, taskId: string, status: VoiceGenerationTaskStatus, errorCode?: string, result?: { takeId: string, assetId: string }) {
    await options.store.mutate((state) => {
      const current = state.jobs[id]!
      state.jobs[id] = reduceVoiceGenerationJob(current, { type: 'task', taskId, status, ...(errorCode ? { errorCode } : {}), ...result }, now())
    })
  }

  async function taskInput(task: VoiceGenerationTask) {
    const snapshot = await options.authoring.read()
    const input = { ...await options.resolve(task, snapshot), pronunciation: snapshot.pronunciation }
    if (input.lineId !== task.lineId || input.locale !== task.locale || input.speakerId !== task.speakerId || input.providerId !== task.providerId || input.voiceId !== task.voiceId || input.model !== task.model || input.voiceProfileRevision !== task.voiceProfileRevision || await voiceGenerationInputFingerprint(input) !== task.inputFingerprint || Array.from(resolveVoiceSpokenText(input.displayText, { override: input.spokenText, locale: input.locale, pronunciation: input.pronunciation })).length !== task.characterCount)
      throw new Error('AUDIO_JOB_INPUT_CHANGED')
    if ((input.voiceId.startsWith('reference:') && input.source !== 'cloned') || (input.voiceId.startsWith('design:') && input.source !== 'designed') || (input.source === 'cloned' && !input.rights))
      throw new Error('AUDIO_JOB_RIGHTS_REQUIRED')
    if (input.rights)
      validateVoiceRights(input.rights)
    if (input.source === 'cloned' && !options.verifyInput)
      throw new Error('AUDIO_JOB_RIGHTS_VERIFICATION_REQUIRED')
    await options.verifyInput?.(input, snapshot)
    audioProjectMediaPath(snapshot.catalog, { id: task.id, type: 'audio', kind: 'voice', path: input.assetPath })
    return { snapshot, input }
  }

  async function registerCandidate(id: string, task: VoiceGenerationTask, safe: StoredVoiceCandidate, input: VoiceGenerationResolvedInput) {
    // A paid result is already durable. Recheck source/profile/dictionary after
    // synthesis before accepting it; recovery keeps the receipt without billing.
    await taskInput(task)
    const snapshot = await options.authoring.read()
    const existing = findVoiceTakeByFingerprint(snapshot.ledger, task.lineId, task.locale, task.inputFingerprint)
    let take = existing
    let catalog = snapshot.catalog
    if (!take) {
      const text = resolveVoiceSpokenText(input.displayText, { override: input.spokenText, locale: input.locale, pronunciation: input.pronunciation })
      const { alignment, ...receipt } = safe
      const candidate: AdvVoiceCandidate = { ...receipt, characterId: input.speakerId, text, ...(alignment ? { alignment: parseVoiceAlignment({ ...alignment, text }, { text, sha256: safe.sha256, durationSeconds: safe.durationSeconds }) } : {}) }
      const registered = await options.authoring.register({ ...input, candidate, providerVoiceId: input.voiceId, expectedRevision: snapshot.revision })
      catalog = registered.catalog
      take = findVoiceTakeByFingerprint(registered.ledger, task.lineId, task.locale, task.inputFingerprint)
      if (!take)
        throw new Error('AUDIO_JOB_PROVENANCE_CHANGED')
    }
    const asset = catalog.assets.find(asset => asset.id === take!.assetId)
    if (!asset || asset.sha256 !== safe.sha256)
      throw new Error('AUDIO_JOB_PROVENANCE_CHANGED')
    // Move the recovery receipt to the committed native master; temporary preview
    // cleanup cannot turn a completed fingerprint into a second paid request.
    const receipt = { ...safe, path: audioProjectMediaPath(catalog, asset) }
    await options.store.mutate((state) => {
      const record = state.idempotency[task.idempotencyKey]
      if (record) {
        record.status = 'committed'
        record.candidate = receipt
        record.updatedAt = new Date(now()).toISOString()
        record.expiresAt = new Date(Math.max(Date.parse(record.expiresAt), Date.parse(state.jobs[id]!.expiresAt))).toISOString()
        delete record.errorCode
      }
      state.jobs[id] = reduceVoiceGenerationJob(state.jobs[id]!, { type: 'task', taskId: task.id, status: 'committed', takeId: take!.id, assetId: take!.assetId }, now())
    })
  }

  async function register(id: string, task: VoiceGenerationTask, safe: StoredVoiceCandidate, input: VoiceGenerationResolvedInput) {
    const operation = registration.catch(() => {}).then(() => registerCandidate(id, task, safe, input))
    registration = operation
    return await operation
  }

  function verifyCandidate(task: VoiceGenerationTask, input: VoiceGenerationResolvedInput, candidate: AdvVoiceCandidate) {
    const text = resolveVoiceSpokenText(input.displayText, { override: input.spokenText, locale: input.locale, pronunciation: input.pronunciation })
    if (candidate.characterId !== task.speakerId || candidate.text !== text || candidate.provider !== task.providerId || candidate.model !== task.model || candidate.providerVoiceId !== task.voiceId || !/^[a-f0-9]{64}$/u.test(candidate.sha256) || !Number.isSafeInteger(candidate.bytes) || candidate.bytes <= 0 || !Number.isFinite(candidate.durationSeconds) || candidate.durationSeconds <= 0 || !Number.isInteger(candidate.sampleRate) || candidate.sampleRate < 1 || !/^audio\/[\w.+-]+$/u.test(candidate.mimeType))
      throw new Error('AUDIO_JOB_PROVENANCE_CHANGED')
    if (candidate.revision !== undefined && candidate.revision !== input.parameters?.modelRevision)
      throw new Error('AUDIO_JOB_MODEL_REVISION_CHANGED')
    return storedCandidate(candidate)
  }

  async function executeTask(id: string, original: VoiceGenerationTask) {
    let task = original
    const currentJob = await job(id)
    if (currentJob.cancelled || task.status === 'committed' || task.status === 'cancelled')
      return
    let resolved: Awaited<ReturnType<typeof taskInput>>
    try {
      resolved = await taskInput(task)
    }
    catch {
      await change(id, task.id, 'failed', 'INPUT_INVALID')
      return
    }
    const cached = findVoiceTakeByFingerprint(resolved.snapshot.ledger, task.lineId, task.locale, task.inputFingerprint)
    if (cached) {
      const asset = resolved.snapshot.catalog.assets.find(asset => asset.id === cached.assetId)
      if (!asset || asset.type !== 'audio' || asset.kind !== 'voice' || asset.sha256 !== cached.sha256 || asset.state === 'rejected') {
        await change(id, task.id, 'blocked', 'CACHE_MEDIA_INVALID')
        return
      }
      try {
        if (!options.authoring.verifyTake)
          throw new Error('AUDIO_JOB_CACHE_VERIFICATION_REQUIRED')
        await options.authoring.verifyTake({ lineId: task.lineId, locale: task.locale, takeId: cached.id })
      }
      catch {
        await change(id, task.id, 'blocked', 'CACHE_MEDIA_INVALID')
        return
      }
      await change(id, task.id, 'committed', undefined, { takeId: cached.id, assetId: cached.assetId })
      return
    }
    let record = (await options.store.read()).idempotency[task.idempotencyKey]
    if (record && (record.accountId !== currentJob.accountId || record.projectId !== currentJob.projectId || record.inputFingerprint !== task.inputFingerprint))
      throw new Error('AUDIO_JOB_SCOPE_INVALID: Idempotency scope does not match the reviewed job')
    if (record && ['running', 'unknown'].includes(record.status)) {
      let query
      try {
        query = options.query ? await options.query(task) : { status: 'unknown' as const }
      }
      catch {
        query = { status: 'unknown' as const }
      }
      if (query.status === 'unknown' || query.status === 'running') {
        await change(id, task.id, 'unknown', 'PROVIDER_RESULT_UNKNOWN')
        return
      }
      if (query.status === 'completed') {
        let candidate: StoredVoiceCandidate
        try {
          candidate = verifyCandidate(task, resolved.input, query.candidate)
        }
        catch {
          await change(id, task.id, 'blocked', 'PROVIDER_RECEIPT_INVALID')
          return
        }
        await options.store.mutate((state) => {
          state.idempotency[task.idempotencyKey]!.status = 'generated'
          state.idempotency[task.idempotencyKey]!.candidate = candidate
        })
        record = (await options.store.read()).idempotency[task.idempotencyKey]
      }
      else {
        await options.store.mutate((state) => {
          const item = state.idempotency[task.idempotencyKey]!
          item.status = 'failed'
          item.errorCode = query.status === 'not-started' ? 'PROVIDER_NOT_STARTED' : 'PROVIDER_FAILED'
          if (query.status === 'not-started') {
            const owner = state.jobs[item.ownerJobId]
            const ownerTask = owner?.tasks.find(task => task.id === item.ownerTaskId)
            if (owner && ownerTask) {
              owner.chargedCharacters = Math.max(0, owner.chargedCharacters - ownerTask.characterCount)
              owner.chargedCostMicros = Math.max(0, owner.chargedCostMicros - (ownerTask.estimatedCost?.amountMicros ?? 0))
            }
            state.jobs[id] = reduceVoiceGenerationJob(state.jobs[id]!, { type: 'task', taskId: task.id, status: 'queued' }, now())
          }
          else {
            state.jobs[id] = reduceVoiceGenerationJob(state.jobs[id]!, { type: 'task', taskId: task.id, status: 'failed', errorCode: 'PROVIDER_FAILED' }, now())
          }
        })
        if (query.status === 'failed')
          return
        record = (await options.store.read()).idempotency[task.idempotencyKey]
        task = (await job(id)).tasks.find(item => item.id === task.id)!
      }
    }
    if (record && ['generated', 'committed'].includes(record.status)) {
      if (!record.candidate) {
        await change(id, task.id, 'blocked', 'RECOVERY_MEDIA_REQUIRED')
        return
      }
      try {
        await register(id, task, record.candidate, resolved.input)
      }
      catch {
        await change(id, task.id, 'failed', 'REGISTRATION_FAILED')
      }
      return
    }
    const controller = new AbortController()
    controllers.set(task.id, controller)
    let release: () => void
    try {
      release = await providerPermit(task.providerId, controller.signal)
    }
    catch {
      controllers.delete(task.id)
      return
    }
    // A queued provider permit may outlive unrelated catalog/ledger commits.
    // Recheck the reviewed fingerprint and capture the current document revision
    // before reserving budget or invoking a provider.
    try {
      resolved = await taskInput(task)
    }
    catch {
      release()
      controllers.delete(task.id)
      await change(id, task.id, 'failed', 'INPUT_INVALID')
      return
    }
    const claim = await options.store.mutate((state) => {
      const next = state.jobs[id]!
      const durableTask = next.tasks.find(item => item.id === task.id)!
      const existing = state.idempotency[task.idempotencyKey]
      if (next.cancelled || (existing && existing.status !== 'failed'))
        return undefined
      if (next.chargedCharacters + task.characterCount > next.budget.maxCharacters) {
        state.jobs[id] = reduceVoiceGenerationJob(next, { type: 'task', taskId: task.id, status: 'blocked', errorCode: 'CHARACTER_BUDGET_EXCEEDED' }, now())
        return undefined
      }
      if (next.budget.maxCost && (!task.estimatedCost || task.estimatedCost.currency !== next.budget.maxCost.currency || next.chargedCostMicros + task.estimatedCost.amountMicros > next.budget.maxCost.amountMicros)) {
        state.jobs[id] = reduceVoiceGenerationJob(next, { type: 'task', taskId: task.id, status: 'blocked', errorCode: 'COST_BUDGET_EXCEEDED' }, now())
        return undefined
      }
      if (!task.estimatedCost && !next.budget.allowUnknownCost) {
        state.jobs[id] = reduceVoiceGenerationJob(next, { type: 'task', taskId: task.id, status: 'blocked', errorCode: 'UNKNOWN_COST_NOT_APPROVED' }, now())
        return undefined
      }
      const dispatchId = createAudioId('job')
      durableTask.attempts += 1
      next.chargedCharacters += task.characterCount
      next.chargedCostMicros += task.estimatedCost?.amountMicros ?? 0
      state.jobs[id] = reduceVoiceGenerationJob(next, { type: 'task', taskId: task.id, status: 'running' }, now())
      const time = new Date(now()).toISOString()
      state.idempotency[task.idempotencyKey] = { key: task.idempotencyKey, accountId: next.accountId, projectId: next.projectId, inputFingerprint: task.inputFingerprint, ownerJobId: id, ownerTaskId: task.id, dispatchId, status: 'running', createdAt: existing?.createdAt ?? time, updatedAt: time, expiresAt: state.jobs[id]!.expiresAt }
      return dispatchId
    }).catch((error) => {
      release()
      controllers.delete(task.id)
      throw error
    })
    if (!claim) {
      release()
      controllers.delete(task.id)
      return
    }
    try {
      controller.signal.throwIfAborted()
      const result = options.execute
        ? await options.execute(resolved.input, { idempotencyKey: task.idempotencyKey, signal: controller.signal })
        : await options.authoring.synthesize({ lineId: task.lineId, locale: task.locale, speakerId: task.speakerId, displayText: resolved.input.displayText, expectedRevision: resolved.snapshot.revision, ...(resolved.input.spokenText === undefined ? {} : { spokenText: resolved.input.spokenText }) }, controller.signal)
      if (result.candidates.length !== 1)
        throw new Error('AUDIO_JOB_PROVENANCE_CHANGED')
      const candidate = verifyCandidate(task, resolved.input, result.candidates[0]!)
      const saved = await options.store.mutate((state) => {
        const item = state.idempotency[task.idempotencyKey]!
        if (item.dispatchId !== claim)
          return false
        item.status = 'generated'
        item.candidate = candidate
        item.updatedAt = new Date(now()).toISOString()
        state.jobs[id] = reduceVoiceGenerationJob(state.jobs[id]!, { type: 'task', taskId: task.id, status: 'generated' }, now())
        return true
      })
      if (saved && !(await job(id)).cancelled) {
        try {
          await register(id, task, candidate, resolved.input)
        }
        catch {
          await change(id, task.id, 'failed', 'REGISTRATION_FAILED')
        }
      }
    }
    catch (error) {
      // A host can reject a stale input after waiting for its global permit.
      // Refund only its explicit pre-dispatch proof, never supplier error text.
      let notDispatched = false
      if (options.execute && error instanceof VoiceGenerationNotDispatchedError) {
        try {
          notDispatched = await options.store.mutate((state) => {
            const item = state.idempotency[task.idempotencyKey]!
            if (item.dispatchId !== claim || item.status !== 'running')
              return false
            const current = state.jobs[id]!
            const currentTask = current.tasks.find(entry => entry.id === task.id)!
            current.chargedCharacters = Math.max(0, current.chargedCharacters - task.characterCount)
            current.chargedCostMicros = Math.max(0, current.chargedCostMicros - (task.estimatedCost?.amountMicros ?? 0))
            currentTask.attempts = Math.max(0, currentTask.attempts - 1)
            item.status = 'failed'
            item.errorCode = 'INPUT_INVALID'
            item.updatedAt = new Date(now()).toISOString()
            state.jobs[id] = reduceVoiceGenerationJob(current, { type: 'task', taskId: task.id, status: 'failed', errorCode: 'INPUT_INVALID' }, now())
            return true
          })
        }
        catch {
          // A failed atomic refund leaves the existing reservation uncertain.
        }
      }
      if (!notDispatched) {
        await options.store.mutate((state) => {
          const item = state.idempotency[task.idempotencyKey]!
          if (item.dispatchId !== claim)
            return
          item.status = 'unknown'
          item.errorCode = 'PROVIDER_RESULT_UNKNOWN'
          item.updatedAt = new Date(now()).toISOString()
          state.jobs[id] = reduceVoiceGenerationJob(state.jobs[id]!, { type: 'task', taskId: task.id, status: 'unknown', errorCode: 'PROVIDER_RESULT_UNKNOWN' }, now())
        })
      }
    }
    finally {
      release()
      controllers.delete(task.id)
    }
  }

  async function runBatch(id: string) {
    const initial = await job(id)
    if (initial.cancelled)
      return initial
    const queue = initial.tasks.filter(task => !['committed', 'cancelled', 'failed'].includes(task.status))
    const active = new Map<Promise<void>, string>()
    const providerActive = new Map<string, number>()
    while (queue.length || active.size) {
      let index = 0
      while (index < queue.length && active.size < initial.budget.concurrency) {
        const task = queue[index]!
        const limit = options.providerConcurrency?.[task.providerId] ?? initial.budget.concurrency
        if (!Number.isInteger(limit) || limit < 1 || limit > 32)
          throw new Error('AUDIO_JOB_CONCURRENCY_INVALID: Provider concurrency must be in 1..32')
        if ((providerActive.get(task.providerId) ?? 0) >= limit) {
          index++
          continue
        }
        queue.splice(index, 1)
        providerActive.set(task.providerId, (providerActive.get(task.providerId) ?? 0) + 1)
        const operation = executeTask(id, task).finally(() => {
          active.delete(operation)
          providerActive.set(task.providerId, providerActive.get(task.providerId)! - 1)
        })
        active.set(operation, task.providerId)
      }
      if (active.size)
        await Promise.race(active.keys())
    }
    // Tasks sharing a fingerprint may have observed another live dispatch.
    // Revisit only confirmed receipts, never dispatch an uncertain request again.
    const state = await options.store.read()
    for (const task of state.jobs[id]!.tasks) {
      if (['unknown', 'blocked', 'queued'].includes(task.status) && ['generated', 'committed'].includes(state.idempotency[task.idempotencyKey]?.status ?? ''))
        await executeTask(id, task)
    }
    return await job(id)
  }

  return {
    async enqueue(plan: VoiceGenerationJob) {
      parseVoiceGenerationStore({ schemaVersion: 1, jobs: { [plan.id]: plan }, idempotency: {} })
      return await options.store.mutate((state) => {
        if (state.jobs[plan.id]) {
          if (JSON.stringify(state.jobs[plan.id]) !== JSON.stringify(plan))
            throw new Error('AUDIO_JOB_EXISTS: Durable plans cannot be overwritten')
          return state.jobs[plan.id]!
        }
        state.jobs[plan.id] = structuredClone(plan)
        return plan
      })
    },
    read: job,
    async run(id: string) {
      const existing = pending.get(id)
      if (existing)
        return await existing
      const operation = runBatch(id)
      pending.set(id, operation)
      try {
        return await operation
      }
      finally {
        pending.delete(id)
      }
    },
    async cancel(id: string) {
      const result = await options.store.mutate((state) => {
        state.jobs[id] = reduceVoiceGenerationJob(state.jobs[id]!, { type: 'cancel' }, now())
        return state.jobs[id]!
      })
      for (const task of result.tasks)
        controllers.get(task.id)?.abort()
      return result
    },
    async resume(id: string) {
      return await options.store.mutate((state) => {
        state.jobs[id] = reduceVoiceGenerationJob(state.jobs[id]!, { type: 'resume' }, now())
        return state.jobs[id]!
      })
    },
    async retry(id: string, taskIds?: string[]) {
      return await options.store.mutate((state) => {
        let next = state.jobs[id]!
        for (const task of next.tasks) {
          if ((!taskIds || taskIds.includes(task.id)) && ['running', 'unknown'].includes(task.status))
            throw new Error('AUDIO_JOB_QUERY_REQUIRED: Resolve the uncertain provider outcome before retrying')
          if (task.status !== 'failed' || (taskIds && !taskIds.includes(task.id)))
            continue
          const record = state.idempotency[task.idempotencyKey]
          if (record && ['running', 'unknown'].includes(record.status))
            throw new Error('AUDIO_JOB_QUERY_REQUIRED: Resolve the uncertain provider outcome before retrying')
          next = reduceVoiceGenerationJob(next, { type: 'task', taskId: task.id, status: 'queued' }, now())
        }
        state.jobs[id] = next
        return next
      })
    },
    async prune() {
      return await options.store.mutate((state) => {
        const next = pruneVoiceGenerationStore(state, now())
        Object.assign(state, next)
        return Object.keys(next.jobs).length
      })
    },
  }
}
