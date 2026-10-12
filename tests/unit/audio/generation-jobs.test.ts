// @vitest-environment node
import type { AdvVoiceCandidate, VoiceAuthoringSnapshot } from '@advjs/types'
import type { VoiceGenerationPlanLine, VoiceGenerationResolvedInput, VoiceGenerationRunnerOptions } from '../../../packages/audio/src/jobs'
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { createNodeVoiceGenerationStore } from '../../../packages/advjs/node/audio/job-store'
import { createVoiceAuthoringService, voiceAuthoringRevision } from '../../../packages/audio/src/authoring'
import { createMemoryVoiceGenerationStore, createVoiceGenerationRunner, parseVoiceGenerationStore, planVoiceGeneration, pruneVoiceGenerationStore, reduceVoiceGenerationJob, VoiceGenerationNotDispatchedError } from '../../../packages/audio/src/jobs'

const now = Date.parse('2026-10-11T08:00:00.000Z')
const profileRevision = 'a'.repeat(64)
const lineIds = Array.from({ length: 8 }, (_, index) => `line_019d137e-7abc-7000-8000-${String(index + 1).padStart(12, '0')}`)

async function fixture() {
  const bytes = new Uint8Array(100).buffer
  const digest = async (input: ArrayBuffer) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', input)), byte => byte.toString(16).padStart(2, '0')).join('')
  const hash = await digest(bytes)
  const media = new Map<string, ArrayBuffer>([['adv/audio/.staging/preview.wav', bytes]])
  let snapshot: VoiceAuthoringSnapshot = { revision: '', ledger: { schemaVersion: 1, lines: {} }, catalog: { schemaVersion: 2, id: 'jobs', defaultProfile: 'local', profiles: { local: { provider: 'project', root: 'public' } }, assets: [] } }
  snapshot.revision = await voiceAuthoringRevision(snapshot.ledger, snapshot.catalog)
  let handler: ((candidate: AdvVoiceCandidate, signal?: AbortSignal) => Promise<void>) | undefined
  let failCommit = false
  let active = 0
  let maximumActive = 0
  const candidate = (line: VoiceGenerationResolvedInput): AdvVoiceCandidate => ({ id: 'candidate', characterId: line.speakerId, text: line.spokenText ?? line.displayText, path: 'adv/audio/.staging/preview.wav', sha256: hash, bytes: 100, mimeType: 'audio/wav', durationSeconds: 1, sampleRate: 24000, provider: 'fake-tts', model: 'fake-model', providerVoiceId: 'fake-voice' })
  const synthesize = vi.fn(async (input: { speakerId: string, text: string }, signal?: AbortSignal) => {
    active++
    maximumActive = Math.max(maximumActive, active)
    const output = candidate({ speakerId: input.speakerId, displayText: input.text } as VoiceGenerationResolvedInput)
    try {
      await handler?.(output, signal)
      return { provider: 'fake-tts', preset: 'fake', manifestPath: 'adv/audio/.staging/manifest.json', manifest: {}, candidates: [output] }
    }
    finally {
      active--
    }
  })
  const authoring = createVoiceAuthoringService({
    async read() { return structuredClone(snapshot) },
    synthesize,
    async verifyTake(input) {
      const take = snapshot.ledger.lines[input.lineId]?.locales[input.locale]?.takes.find(take => take.id === input.takeId)
      const asset = snapshot.catalog.assets.find(asset => asset.id === take?.assetId)
      const bytes = media.get(`public/${asset?.path}`)
      if (!take || !asset || !bytes || await digest(bytes) !== take.sha256)
        throw new Error('VOICE_AUDIO_CHANGED')
    },
    async commit(plan) {
      if (failCommit) {
        failCommit = false
        throw new Error('A deliberately sensitive provider failure must never be stored')
      }
      if (plan.expectedRevision !== snapshot.revision)
        throw new Error('VOICE_CONFLICT')
      for (const item of plan.media) {
        const bytes = media.get(item.candidate.path)
        if (!bytes || await digest(bytes) !== item.candidate.sha256)
          throw new Error('VOICE_AUDIO_CHANGED')
        media.set(`public/${item.asset.path}`, bytes.slice(0))
      }
      snapshot = { ledger: plan.ledger, catalog: plan.catalog, revision: await voiceAuthoringRevision(plan.ledger, plan.catalog) }
      return structuredClone(snapshot)
    },
  })
  const inputs = new Map<string, VoiceGenerationPlanLine>()
  function input(index: number, text = `Line ${index + 1}.`): VoiceGenerationPlanLine {
    const line: VoiceGenerationPlanLine = { lineId: lineIds[index]!, locale: 'en', speakerId: 'hero', displayText: text, assetPath: `audio/voice/${index}.wav`, providerId: 'fake-tts', voiceId: 'fake-voice', model: 'fake-model', voiceProfileRevision: profileRevision, source: 'system', estimatedCost: { currency: 'USD', amountMicros: 100 } }
    inputs.set(line.lineId, line)
    return line
  }
  const store = createMemoryVoiceGenerationStore()
  const query = vi.fn<NonNullable<VoiceGenerationRunnerOptions['query']>>(async () => ({ status: 'unknown' }))
  const options: VoiceGenerationRunnerOptions = {
    authoring,
    store,
    now: () => now,
    async resolve(task) {
      const source = inputs.get(task.lineId)!
      return { ...source, assetPath: `audio/voice/${task.id}.wav` }
    },
    query,
  }
  const runner = createVoiceGenerationRunner(options)
  async function plan(lines: VoiceGenerationPlanLine[], overrides: Partial<Parameters<typeof planVoiceGeneration>[0]> = {}) {
    return await planVoiceGeneration({ accountId: 'author', projectId: 'jobs', snapshot: await authoring.read(), lines, budget: { maxCharacters: 1000, allowUnknownCost: false, concurrency: 4, maxCost: { currency: 'USD', amountMicros: 10_000 } }, now, ...overrides })
  }
  return {
    store,
    runner,
    options,
    authoring,
    synthesize,
    query,
    input,
    inputs,
    candidate,
    plan,
    media,
    maxActive: () => maximumActive,
    handler(value: typeof handler) { handler = value },
    failCommit() { failCommit = true },
  }
}

describe('reviewed durable generation jobs', () => {
  it('refunds only explicit host proof of no dispatch, retaining uncertain reservations when an atomic refund fails', async () => {
    for (const failure of ['none', 'refund', 'supplier', 'direct-supplier'] as const) {
      const project = await fixture()
      const plan = await project.plan([project.input(0)])
      let rejectRefund = failure === 'refund'
      const store = {
        ...project.store,
        async mutate<T>(mutation: Parameters<typeof project.store.mutate<T>>[0]) {
          return await project.store.mutate((state) => {
            const result = mutation(state)
            if (rejectRefund && Object.values(state.idempotency).some(record => record.status === 'failed')) {
              rejectRefund = false
              throw new Error('Atomic storage unavailable')
            }
            return result
          })
        },
      }
      const execute = vi.fn(async () => {
        if (failure === 'supplier')
          throw new Error('AUDIO_JOB_NOT_DISPATCHED: Supplier prose is not trusted proof')
        throw new VoiceGenerationNotDispatchedError()
      })
      if (failure === 'direct-supplier')
        project.handler(async () => { throw new VoiceGenerationNotDispatchedError() })
      const runner = createVoiceGenerationRunner({ ...project.options, store, execute: failure === 'direct-supplier' ? undefined : execute })
      await runner.enqueue(plan)
      const result = await runner.run(plan.id)
      expect(execute).toHaveBeenCalledTimes(failure === 'direct-supplier' ? 0 : 1)
      expect(project.synthesize).toHaveBeenCalledTimes(failure === 'direct-supplier' ? 1 : 0)
      if (failure === 'none') {
        expect(result).toMatchObject({ chargedCharacters: 0, chargedCostMicros: 0, tasks: [{ status: 'failed', errorCode: 'INPUT_INVALID', attempts: 0 }] })
        expect(Object.values((await project.store.read()).idempotency)[0]).toMatchObject({ status: 'failed', errorCode: 'INPUT_INVALID' })
      }
      else {
        expect(result).toMatchObject({ chargedCharacters: plan.tasks[0]!.characterCount, chargedCostMicros: 100, tasks: [{ status: 'unknown', errorCode: 'PROVIDER_RESULT_UNKNOWN', attempts: 1 }] })
        expect(Object.values((await project.store.read()).idempotency)[0]).toMatchObject({ status: 'unknown', errorCode: 'PROVIDER_RESULT_UNKNOWN' })
      }
    }
  })

  it('rejects array collections and malformed summaries instead of silently losing durable state', async () => {
    const project = await fixture()
    const plan = await project.plan([project.input(0)])
    for (const key of ['jobs', 'idempotency']) {
      const state = { schemaVersion: 1, jobs: {}, idempotency: {}, [key]: [] }
      expect(() => parseVoiceGenerationStore(state)).toThrow('STORE_INVALID')
    }
    const jobs = Object.assign([], { [plan.id]: plan })
    expect(() => parseVoiceGenerationStore({ schemaVersion: 1, jobs, idempotency: {} })).toThrow('STORE_INVALID')
    for (const summary of [
      { ...plan.summary, lines: 1.5 },
      { ...plan.summary, characters: -1 },
      { ...plan.summary, cacheHits: 2 },
      { ...plan.summary, newGenerations: Number.MAX_SAFE_INTEGER + 1 },
      { ...plan.summary, estimatedCost: 0 },
      { ...plan.summary, estimatedCost: { currency: 'USD', amountMicros: 100, prompt: 'Never persist prose' } },
    ]) {
      expect(() => parseVoiceGenerationStore({ schemaVersion: 1, jobs: { [plan.id]: { ...plan, summary } }, idempotency: {} })).toThrow('STORE_INVALID')
    }
    expect(parseVoiceGenerationStore({ schemaVersion: 1, jobs: { [plan.id]: plan }, idempotency: {} }).jobs[plan.id]?.summary).toEqual(plan.summary)
  })

  it('reviews Unicode character counts, cost caps, unknown estimates and minimum retention before dispatch', async () => {
    const project = await fixture()
    const line = project.input(0, '🙂你好')
    await expect(project.plan([line], { budget: { maxCharacters: 2, allowUnknownCost: false, concurrency: 1 } })).rejects.toThrow('CHARACTER_LIMIT')
    await expect(project.plan([line], { budget: { maxCharacters: 10, allowUnknownCost: false, concurrency: 1, maxCost: { currency: 'USD', amountMicros: 99 } } })).rejects.toThrow('COST_LIMIT')
    await expect(project.plan([{ ...line, estimatedCost: null }])).rejects.toThrow('UNKNOWN_COST')
    const reviewed = await project.plan([{ ...line, estimatedCost: null }], { budget: { maxCharacters: 10, allowUnknownCost: true, concurrency: 1 } })
    expect(reviewed.summary).toEqual({ lines: 1, characters: 3, cacheHits: 0, newGenerations: 1, estimatedCost: null })
    await expect(project.plan([line], { retentionDays: 29 })).rejects.toThrow('RETENTION_INVALID')
    expect(project.synthesize).not.toHaveBeenCalled()
  })

  it('persists plans without dialogue prose/prompts, constrains provider concurrency, and commits unselected immutable takes', async () => {
    const project = await fixture()
    const lines = Array.from({ length: 4 }, (_, index) => project.input(index, `Private dialogue ${index}.`))
    project.handler(async () => await new Promise(resolveWait => setTimeout(resolveWait, 5)))
    const runner = createVoiceGenerationRunner({ ...project.options, providerConcurrency: { 'fake-tts': 2 } })
    const plan = await project.plan(lines)
    await runner.enqueue(plan)
    expect(JSON.stringify(await project.store.read())).not.toContain('Private dialogue')
    const result = await runner.run(plan.id)
    expect(result.tasks.every(task => task.status === 'committed')).toBe(true)
    expect(project.maxActive()).toBe(2)
    expect(project.synthesize).toHaveBeenCalledTimes(4)
    for (const line of Object.values((await project.authoring.read()).ledger.lines))
      expect(line.locales.en?.selectedTake).toBeNull()
    expect(JSON.stringify(await project.store.read())).not.toContain('Private dialogue')
    const cached = await project.plan(lines)
    expect(cached.summary.cacheHits).toBe(4)
    expect(cached.summary.newGenerations).toBe(0)
    await runner.enqueue(cached)
    await runner.run(cached.id)
    expect(project.synthesize).toHaveBeenCalledTimes(4)
  })

  it('uses one paid result across duplicate fingerprints and future jobs while scoping reuse by account/project', async () => {
    const project = await fixture()
    const first = await project.plan([project.input(0, 'Identical.'), project.input(1, 'Identical.')])
    expect(first.summary).toMatchObject({ cacheHits: 1, newGenerations: 1 })
    await project.runner.enqueue(first)
    expect((await project.runner.run(first.id)).tasks.every(task => task.status === 'committed')).toBe(true)
    expect(project.synthesize).toHaveBeenCalledTimes(1)
    const next = await project.plan([project.input(2, 'Identical.')])
    await project.runner.enqueue(next)
    expect((await project.runner.run(next.id)).tasks[0]?.status).toBe('committed')
    expect(project.synthesize).toHaveBeenCalledTimes(1)
    const independent = await project.plan([project.input(3, 'Identical.')], { accountId: 'another-account' })
    await project.runner.enqueue(independent)
    await project.runner.run(independent.id)
    expect(project.synthesize).toHaveBeenCalledTimes(2)
  })

  it('enforces one provider gate across two concurrently running jobs', async () => {
    const project = await fixture()
    const plans = await Promise.all([project.plan([project.input(0)]), project.plan([project.input(1)])])
    project.handler(async () => await new Promise(resolveWait => setTimeout(resolveWait, 10)))
    const runner = createVoiceGenerationRunner({ ...project.options, providerConcurrency: { 'fake-tts': 1 } })
    for (const plan of plans)
      await runner.enqueue(plan)
    const results = await Promise.all(plans.map(plan => runner.run(plan.id)))
    expect(results.every(result => result.tasks.every(task => task.status === 'committed'))).toBe(true)
    expect(project.maxActive()).toBe(1)
    expect(project.synthesize).toHaveBeenCalledTimes(2)
  })

  it('verifies planned cache bytes before committed state and blocks tampered or unverifiable media without another paid request', async () => {
    const project = await fixture()
    const line = project.input(0)
    const first = await project.plan([line])
    await project.runner.enqueue(first)
    await project.runner.run(first.id)
    const cached = await project.plan([line])
    expect(cached.summary.cacheHits).toBe(1)
    expect(cached.tasks[0]?.status).toBe('queued')
    await project.runner.enqueue(cached)
    const snapshot = await project.authoring.read()
    const path = snapshot.catalog.assets[0]!.path!
    project.media.set(`public/${path}`, new TextEncoder().encode('modified after cache review').buffer)
    expect((await project.runner.run(cached.id)).tasks[0]).toMatchObject({ status: 'blocked', errorCode: 'CACHE_MEDIA_INVALID' })
    expect(project.synthesize).toHaveBeenCalledTimes(1)
    const withoutVerifier = createVoiceGenerationRunner({ ...project.options, authoring: { ...project.authoring, verifyTake: undefined } })
    expect((await withoutVerifier.run(cached.id)).tasks[0]?.status).toBe('blocked')
    expect(project.synthesize).toHaveBeenCalledTimes(1)
  })

  it('retries registration failures from durable verified receipts without invoking TTS again', async () => {
    const project = await fixture()
    const plan = await project.plan([project.input(0)])
    await project.runner.enqueue(plan)
    project.failCommit()
    expect((await project.runner.run(plan.id)).tasks[0]).toMatchObject({ status: 'failed', errorCode: 'REGISTRATION_FAILED' })
    expect(Object.values((await project.store.read()).idempotency)[0]?.status).toBe('generated')
    await project.runner.retry(plan.id)
    expect((await project.runner.run(plan.id)).tasks[0]?.status).toBe('committed')
    expect(project.synthesize).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(await project.store.read())).not.toContain('sensitive provider failure')
  })

  it('retains a paid receipt when source changes during synthesis and only registers it after the reviewed input is restored', async () => {
    const project = await fixture()
    const line = project.input(0)
    const plan = await project.plan([line])
    await project.runner.enqueue(plan)
    project.handler(async () => {
      project.inputs.set(line.lineId, { ...line, displayText: 'Changed during the provider call.' })
    })
    expect((await project.runner.run(plan.id)).tasks[0]).toMatchObject({ status: 'failed', errorCode: 'REGISTRATION_FAILED' })
    expect((await project.authoring.read()).catalog.assets).toHaveLength(0)
    expect(Object.values((await project.store.read()).idempotency)[0]?.status).toBe('generated')
    project.inputs.set(line.lineId, line)
    await project.runner.retry(plan.id)
    expect((await project.runner.run(plan.id)).tasks[0]?.status).toBe('committed')
    expect(project.synthesize).toHaveBeenCalledTimes(1)
  })

  it('recovers an uncertain crashed request by querying its completed result before any retry', async () => {
    const project = await fixture()
    const line = project.input(0)
    const plan = await project.plan([line])
    await project.runner.enqueue(plan)
    await project.store.mutate((state) => {
      const task = state.jobs[plan.id]!.tasks[0]!
      task.status = 'running'
      task.attempts = 1
      state.idempotency[task.idempotencyKey] = { key: task.idempotencyKey, accountId: plan.accountId, projectId: plan.projectId, inputFingerprint: task.inputFingerprint, ownerJobId: plan.id, ownerTaskId: task.id, status: 'running', createdAt: plan.createdAt, updatedAt: plan.updatedAt, expiresAt: plan.expiresAt }
    })
    const withoutQuery = createVoiceGenerationRunner({ ...project.options, query: undefined })
    expect((await withoutQuery.run(plan.id)).tasks[0]?.status).toBe('unknown')
    await expect(withoutQuery.retry(plan.id)).rejects.toThrow('QUERY_REQUIRED')
    expect(project.synthesize).not.toHaveBeenCalled()
    project.query.mockResolvedValue({ status: 'completed', candidate: project.candidate(line) })
    expect((await project.runner.run(plan.id)).tasks[0]?.status).toBe('committed')
    expect(project.query).toHaveBeenCalledTimes(1)
    expect(project.synthesize).not.toHaveBeenCalled()
  })

  it('cancels in-flight requests, retains uncertainty and resumes only after a not-started query', async () => {
    const project = await fixture()
    const plan = await project.plan([project.input(0)])
    await project.runner.enqueue(plan)
    let started!: () => void
    const didStart = new Promise<void>(resolveStarted => started = resolveStarted)
    project.handler(async (_candidate, signal) => {
      started()
      await new Promise<void>((_resolve, reject) => signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true }))
    })
    const running = project.runner.run(plan.id)
    await didStart
    await project.runner.cancel(plan.id)
    const cancelled = await running
    expect(cancelled.cancelled).toBe(true)
    expect(cancelled.tasks[0]?.status).toBe('unknown')
    project.handler(undefined)
    await project.runner.resume(plan.id)
    expect((await project.runner.run(plan.id)).tasks[0]?.status).toBe('unknown')
    expect(project.synthesize).toHaveBeenCalledTimes(1)
    project.query.mockResolvedValue({ status: 'not-started' })
    const completed = await project.runner.run(plan.id)
    expect(completed.tasks[0]?.status).toBe('committed')
    expect(completed.chargedCharacters).toBe(plan.tasks[0]!.characterCount)
    expect(project.synthesize).toHaveBeenCalledTimes(2)
  })

  it('retains a successful late cancelled candidate for resume without paying twice', async () => {
    const project = await fixture()
    const plan = await project.plan([project.input(0)])
    await project.runner.enqueue(plan)
    let finish!: () => void
    let started!: () => void
    const didStart = new Promise<void>(resolveStarted => started = resolveStarted)
    project.handler(async () => {
      started()
      await new Promise<void>(resolveFinish => finish = resolveFinish)
    })
    // Some transports cannot abort an accepted provider request. Their receipt
    // still reaches the runner; the shared service itself checks abort on return.
    const runner = createVoiceGenerationRunner({ ...project.options, execute: async input => await project.authoring.synthesize(input) })
    const running = runner.run(plan.id)
    await didStart
    await runner.cancel(plan.id)
    finish()
    const paused = await running
    expect(paused.tasks[0]?.status).toBe('generated')
    expect((await project.authoring.read()).catalog.assets).toEqual([])
    await runner.resume(plan.id)
    expect((await runner.run(plan.id)).tasks[0]?.status).toBe('committed')
    expect(project.synthesize).toHaveBeenCalledTimes(1)
  })

  it('prevents two cooperating runners from dispatching the same fingerprint twice', async () => {
    const project = await fixture()
    const plan = await project.plan([project.input(0)])
    await project.runner.enqueue(plan)
    project.handler(async () => await new Promise(resolveWait => setTimeout(resolveWait, 10)))
    const other = createVoiceGenerationRunner(project.options)
    await Promise.all([project.runner.run(plan.id), other.run(plan.id)])
    expect(project.synthesize).toHaveBeenCalledTimes(1)
    expect((await other.run(plan.id)).tasks[0]?.status).toBe('committed')
  })

  it('keeps uncertain failed requests charged and blocks retries exceeding the reviewed character budget', async () => {
    const project = await fixture()
    const line = project.input(0, 'Hello')
    const plan = await project.plan([line], { budget: { maxCharacters: 5, concurrency: 1, allowUnknownCost: false } })
    await project.runner.enqueue(plan)
    project.handler(async () => {
      throw new Error('Provider transport failed; billing outcome unknown')
    })
    expect((await project.runner.run(plan.id)).tasks[0]?.status).toBe('unknown')
    project.query.mockResolvedValue({ status: 'failed' })
    expect((await project.runner.run(plan.id)).tasks[0]?.status).toBe('failed')
    await project.runner.retry(plan.id)
    expect((await project.runner.run(plan.id)).tasks[0]).toMatchObject({ status: 'blocked', errorCode: 'CHARACTER_BUDGET_EXCEEDED' })
    expect(project.synthesize).toHaveBeenCalledTimes(1)
  })

  it('rejects stale input before dispatch and never rewinds completed reducer state', async () => {
    const project = await fixture()
    const line = project.input(0)
    const plan = await project.plan([line])
    await project.runner.enqueue(plan)
    project.inputs.set(line.lineId, { ...line, displayText: 'Changed while queued.' })
    expect((await project.runner.run(plan.id)).tasks[0]).toMatchObject({ status: 'failed', errorCode: 'INPUT_INVALID' })
    expect(project.synthesize).not.toHaveBeenCalled()
    const committed = reduceVoiceGenerationJob(plan, { type: 'task', taskId: plan.tasks[0]!.id, status: 'committed' }, now)
    expect(() => reduceVoiceGenerationJob(committed, { type: 'task', taskId: plan.tasks[0]!.id, status: 'queued' }, now)).toThrow('TRANSITION_INVALID')
    expect(() => parseVoiceGenerationStore({ schemaVersion: 1, jobs: { [plan.id]: { ...plan, prompt: 'Do not persist this' } }, idempotency: {} })).toThrow('STORE_INVALID')
  })

  it('requires a host consent-document check before dispatching cloned voice work', async () => {
    const project = await fixture()
    const line = { ...project.input(0), source: 'cloned' as const, rights: { license: 'Performer permission', subject: 'Hero performer', consentRecord: 'docs/consent/hero.json' } }
    project.inputs.set(line.lineId, line)
    const plan = await project.plan([line])
    await project.runner.enqueue(plan)
    expect((await project.runner.run(plan.id)).tasks[0]).toMatchObject({ status: 'failed', errorCode: 'INPUT_INVALID' })
    expect(project.synthesize).not.toHaveBeenCalled()
    const verifyInput = vi.fn(async () => {
      throw new Error('Consent document missing from current native files')
    })
    const verifiedRunner = createVoiceGenerationRunner({ ...project.options, verifyInput })
    await verifiedRunner.retry(plan.id)
    expect((await verifiedRunner.run(plan.id)).tasks[0]?.status).toBe('failed')
    expect(verifyInput).toHaveBeenCalledOnce()
    expect(project.synthesize).not.toHaveBeenCalled()
  })

  it('prunes expired terminal state after 30 days while retaining unresolved recoverable requests', async () => {
    const project = await fixture()
    const plan = await project.plan([project.input(0)])
    await project.runner.enqueue(plan)
    await project.runner.run(plan.id)
    expect(Object.keys(pruneVoiceGenerationStore(await project.store.read(), now + 29 * 86_400_000).jobs)).toHaveLength(1)
    const expired = pruneVoiceGenerationStore(await project.store.read(), now + 31 * 86_400_000)
    expect(expired.jobs).toEqual({})
    expect(expired.idempotency).toEqual({})
    await project.store.mutate((state) => {
      state.jobs[plan.id]!.tasks[0]!.status = 'unknown'
      Object.values(state.idempotency)[0]!.status = 'unknown'
    })
    expect(Object.keys(pruneVoiceGenerationStore(await project.store.read(), now + 365 * 86_400_000).jobs)).toHaveLength(1)
  })

  it('persists local state outside project exports, resumes after reopening and serializes separate store instances', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'adv-audio-jobs-'))
    const projectRoot = join(directory, 'project')
    const appData = join(directory, 'application-data')
    await mkdir(projectRoot)
    try {
      await expect(createNodeVoiceGenerationStore({ projectRoot, directory: join(projectRoot, '.jobs') })).rejects.toThrow('PROJECT_PATH')
      const first = await createNodeVoiceGenerationStore({ projectRoot, directory: appData })
      const second = await createNodeVoiceGenerationStore({ projectRoot, directory: appData })
      const project = await fixture()
      const plans = await Promise.all([project.plan([project.input(0)]), project.plan([project.input(1)])])
      await Promise.all(plans.map((plan, index) => [first, second][index]!.mutate(state => state.jobs[plan.id] = plan)))
      const reopened = await createNodeVoiceGenerationStore({ projectRoot, directory: appData })
      expect(Object.keys((await reopened.read()).jobs)).toHaveLength(2)
      expect(await readFile(join(appData, 'audio-jobs.json'), 'utf8')).not.toContain('Line 1.')
    }
    finally {
      await rm(directory, { recursive: true, force: true })
    }
  })
})
