import type { VoiceGenerationBudget, VoiceGenerationJob } from '@advjs/audio'
import type { VoiceAuthoringSnapshot } from '@advjs/types'
import type { Ref } from 'vue'
import type { HostedVoiceJobsSnapshot, HostedVoiceReviewedPlan } from '../../../../packages/advjs/shared/hosted-audio'
import type { ManagedVoiceClient } from '../utils/managedVoiceClient'
import type { StudioVoiceJobContext } from '../utils/voiceGeneration'
import { voiceGenerationInputFingerprint } from '@advjs/audio'
import { computed, onScopeDispose, shallowRef, watch } from 'vue'
import { importHostedVoiceReceipt } from '../utils/managedVoiceImport'
import { createStudioAudioService } from '../utils/projectAudio'
import { readStudioVoiceJobContext, resolveStudioVoiceJobInput, reviewStudioVoiceJobLines, studioVoiceJobLocales, studioVoiceJobProviders } from '../utils/voiceGeneration'
import { createStudioVoiceGenerationStore } from '../utils/voiceGenerationStore'
import { useProjectContent } from './useProjectContent'

/** The registered service alone dispatches suppliers; this host only imports receipts. */
export function useHostedVoiceJobs(active: Ref<boolean>, client: Ref<ManagedVoiceClient | undefined>, changed?: () => void) {
  const project = useProjectContent()
  const jobs = shallowRef<VoiceGenerationJob[]>([])
  const context = shallowRef<StudioVoiceJobContext>()
  const snapshot = shallowRef<VoiceAuthoringSnapshot>()
  const plan = shallowRef<VoiceGenerationJob>()
  const blocked = shallowRef<Array<{ lineId: string, code: string }>>([])
  const loading = shallowRef(false)
  const busy = shallowRef(false)
  const error = shallowRef('')
  const service = shallowRef<HostedVoiceJobsSnapshot>()
  const privateIds = shallowRef<string[]>([])
  const running = computed(() => service.value?.jobs.filter(job => !job.cancelled && job.tasks.some(task => task.status === 'running')).map(job => job.id) ?? [])
  const locales = computed(() => context.value && snapshot.value ? studioVoiceJobLocales(context.value, snapshot.value) : [])
  let epoch = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  let abort = new AbortController()
  let reviewed: HostedVoiceReviewedPlan | undefined
  let reviewedPrivateId: string | undefined
  let refresh: (() => Promise<void>) | undefined
  const imported = new Set<string>()
  const safeError = (cause: unknown) => {
    const code = cause instanceof Error ? cause.message.split(':')[0]! : ''
    return /^[A-Z][A-Z0-9_]{0,79}$/u.test(code) ? code : 'AUDIO_SERVICE_REQUEST_FAILED'
  }
  function invalidatePlan() {
    reviewed = undefined
    reviewedPrivateId = undefined
    plan.value = undefined
    blocked.value = []
  }
  async function reload() {
    const version = ++epoch
    clearTimeout(timer)
    abort.abort()
    abort = new AbortController()
    refresh = undefined
    imported.clear()
    invalidatePlan()
    jobs.value = []
    service.value = undefined
    context.value = undefined
    snapshot.value = undefined
    busy.value = false
    error.value = ''
    if (!active.value || !client.value)
      return
    loading.value = true
    const host = client.value
    const signal = abort.signal
    const valid = () => version === epoch && active.value && client.value === host
    try {
      await project.whenReady()
      const fs = project.getFs()
      if (!fs)
        throw new Error('ADV_AUDIO_PROJECT_REQUIRED')
      const assertCurrent = () => {
        host.assertCurrent()
        if (!valid() || project.getFs() !== fs)
          throw new Error('AUDIO_JOB_SCOPE_CHANGED')
      }
      const authoring = createStudioAudioService(fs, undefined, { validateAccess: assertCurrent })
      const store = createStudioVoiceGenerationStore(host.scope)
      const nextSnapshot = await authoring.read()
      const nextContext = await readStudioVoiceJobContext(fs, nextSnapshot)
      assertCurrent()
      snapshot.value = nextSnapshot
      context.value = nextContext
      let pending: Promise<void> | undefined
      refresh = () => pending ??= (async () => {
        const remote = await host.read(signal)
        const local = Object.values((await store.read()).jobs)
        assertCurrent()
        service.value = remote
        privateIds.value = local.filter(job => !remote.jobs.some(item => item.id === job.id)).map(job => job.id)
        jobs.value = [...remote.jobs, ...local.filter(job => privateIds.value.includes(job.id))].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        for (const job of remote.jobs) {
          if (!job.tasks.some(task => task.status === 'committed' && !imported.has(task.id)))
            continue
          const receipts = await host.receipts(job.id, signal)
          for (const receipt of receipts.receipts) {
            const task = job.tasks.find(task => task.id === receipt.taskId && task.status === 'committed')
            if (!task || imported.has(task.id))
              continue
            await importHostedVoiceReceipt({ client: host, fs, authoring, task, receipt, assertCurrent, signal, resolve: async (task, next) => resolveStudioVoiceJobInput(await readStudioVoiceJobContext(fs, next), next, task) })
            assertCurrent()
            imported.add(task.id)
            snapshot.value = await authoring.read()
            changed?.()
          }
          for (const task of job.tasks.filter(task => task.status === 'committed' && task.attempts === 0 && !imported.has(task.id))) {
            const current = await authoring.read()
            const take = current.ledger.lines[task.lineId]?.locales[task.locale]?.takes.find(take => take.id === task.takeId)
            if (!take || take.assetId !== task.assetId || take.inputFingerprint !== task.inputFingerprint)
              throw new Error('AUDIO_SERVICE_RECEIPT_INVALID')
            await authoring.verifyTake?.({ lineId: task.lineId, locale: task.locale, takeId: take.id })
            assertCurrent()
            imported.add(task.id)
          }
        }
      })().finally(() => { pending = undefined })
      const poll = async () => {
        if (!valid())
          return
        try {
          await refresh?.()
        }
        catch (cause) {
          if (valid())
            error.value = safeError(cause)
        }
        // Polling only reads durable outcomes. It never issues run/resume/retry.
        if (valid())
          timer = setTimeout(() => void poll(), 1500)
      }
      await refresh()
      if (valid())
        timer = setTimeout(() => void poll(), 1500)
    }
    catch (cause) {
      if (valid())
        error.value = safeError(cause)
    }
    finally {
      if (valid())
        loading.value = false
    }
  }
  async function perform(operation: (host: ManagedVoiceClient, signal: AbortSignal) => Promise<void>) {
    const host = client.value
    if (!host || !active.value || busy.value)
      return
    const version = epoch
    const signal = abort.signal
    busy.value = true
    error.value = ''
    try {
      await operation(host, signal)
    }
    catch (cause) {
      if (version === epoch)
        error.value = safeError(cause)
    }
    finally {
      if (version === epoch)
        busy.value = false
    }
  }
  async function inspect(host: ManagedVoiceClient, job: VoiceGenerationJob, signal: AbortSignal) {
    const fs = project.getFs()
    if (!fs)
      throw new Error('ADV_AUDIO_PROJECT_REQUIRED')
    const next = await host.syncNativeProject(fs, signal)
    for (const task of job.tasks.filter(task => task.status !== 'committed')) {
      const input = await resolveStudioVoiceJobInput(next.context, next.snapshot, task)
      const prepared = await host.prepare(input, next.snapshot, signal)
      if (await voiceGenerationInputFingerprint(prepared) !== task.inputFingerprint)
        throw new Error('AUDIO_JOB_INPUT_CHANGED')
    }
    return next
  }
  async function review(options: { chapterId: string, locale: string, providerId: string, mode: 'chapter' | 'missing' | 'stale', budget: VoiceGenerationBudget }) {
    invalidatePlan()
    await perform(async (host, signal) => {
      const fs = project.getFs()
      if (!fs)
        throw new Error('ADV_AUDIO_PROJECT_REQUIRED')
      const next = await host.syncNativeProject(fs, signal)
      const lines = await reviewStudioVoiceJobLines(next.context, next.snapshot, { ...options, prepareInput: input => host.prepare(input, next.snapshot, signal) })
      if (signal.aborted)
        return
      context.value = next.context
      snapshot.value = next.snapshot
      blocked.value = lines.blocked
      if (lines.blocked.length)
        throw new Error(lines.blocked[0]!.code)
      if (!lines.lines.length)
        throw new Error('AUDIO_JOB_NO_TARGETS')
      if (lines.lines.length > 200)
        throw new Error('AUDIO_SERVICE_PLAN_LIMIT')
      const proposed = await host.plan({ lineIds: lines.lines.map(line => line.lineId), locale: options.locale, providerId: options.providerId, budget: options.budget }, signal)
      if (proposed.plan.tasks.length !== lines.lines.length)
        throw new Error('AUDIO_JOB_INPUT_CHANGED')
      for (const input of lines.lines) {
        const task = proposed.plan.tasks.find(task => task.lineId === input.lineId && task.locale === input.locale && task.providerId === input.providerId)
        if (!task || task.inputFingerprint !== await voiceGenerationInputFingerprint(input))
          throw new Error('AUDIO_JOB_INPUT_CHANGED')
      }
      if (!signal.aborted) {
        reviewed = proposed
        plan.value = proposed.plan
      }
    })
  }
  async function enqueue() {
    if (!reviewed)
      return
    const proposed = reviewed
    const localId = reviewedPrivateId
    await perform(async (host, signal) => {
      await inspect(host, proposed.plan, signal)
      await host.enqueue(proposed, signal)
      if (localId) {
        await createStudioVoiceGenerationStore(host.scope).mutate((document) => {
          if (document.jobs[localId])
            document.jobs[localId]!.cancelled = true
        })
      }
      invalidatePlan()
      await refresh?.()
    })
  }
  async function reconcile(job: VoiceGenerationJob) {
    invalidatePlan()
    await perform(async (host, signal) => {
      if (!privateIds.value.includes(job.id) || job.cancelled || job.tasks.some(task => ['running', 'unknown', 'generated'].includes(task.status)))
        throw new Error('AUDIO_JOB_QUERY_REQUIRED')
      await inspect(host, job, signal)
      const tasks = job.tasks.filter(task => task.status === 'queued')
      if (!tasks.length || tasks.length > 200 || tasks.some(task => task.locale !== tasks[0]!.locale || task.providerId !== tasks[0]!.providerId))
        throw new Error('AUDIO_SERVICE_PLAN_LIMIT')
      const next = await host.plan({ lineIds: tasks.map(task => task.lineId), locale: tasks[0]!.locale, providerId: tasks[0]!.providerId, budget: job.budget }, signal)
      if (next.plan.tasks.length !== tasks.length || next.plan.tasks.some(task => !tasks.some(prior => prior.lineId === task.lineId && prior.inputFingerprint === task.inputFingerprint)))
        throw new Error('AUDIO_JOB_INPUT_CHANGED')
      reviewed = next
      reviewedPrivateId = job.id
      plan.value = next.plan
    })
  }
  const canRun = (job: VoiceGenerationJob) => Boolean(service.value?.configured && !privateIds.value.includes(job.id) && !job.cancelled && !running.value.includes(job.id) && job.tasks.some(task => ['queued', 'generated', 'blocked', 'unknown'].includes(task.status)) && (!job.tasks.some(task => task.status === 'unknown') || service.value.canQuery))
  async function command(id: string, action: 'run' | 'cancel' | 'resume' | 'retry') {
    const job = jobs.value.find(job => job.id === id)
    if (!job || privateIds.value.includes(id) || (action === 'run' && !canRun(job)))
      return
    await perform(async (host, signal) => {
      if (action === 'run')
        await inspect(host, job, signal)
      await host.command(id, action, action === 'retry' ? job.tasks.filter(task => task.status === 'failed').map(task => task.id) : undefined, signal)
      await refresh?.()
    })
  }
  watch([active, client], () => void reload(), { immediate: true })
  onScopeDispose(() => {
    epoch++
    clearTimeout(timer)
    abort.abort()
  })
  return { jobs, context, snapshot, plan, blocked, locales, loading, busy, error, running, canRun, reload, review, enqueue, command, invalidatePlan, reconcile, isPrivate: (job: VoiceGenerationJob) => privateIds.value.includes(job.id), providers: (locale: string) => context.value ? studioVoiceJobProviders(context.value, locale).filter(id => service.value?.providers.some(provider => provider.id === id)) : [], get canGenerate() {
    return Boolean(service.value?.configured)
  }, get canQuery() {
    return Boolean(service.value?.canQuery)
  } }
}
