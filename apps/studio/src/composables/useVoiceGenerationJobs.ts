import type { VoiceGenerationBudget, VoiceGenerationJob } from '@advjs/audio'
import type { VoiceAuthoringSnapshot } from '@advjs/types'
import type { Ref } from 'vue'
import type { IFileSystem } from '../utils/fs'
import type { StudioVoiceJobContext, StudioVoiceJobSelection } from '../utils/voiceGeneration'
import { createVoiceGenerationRunner, planVoiceGeneration } from '@advjs/audio'
import { computed, inject, onScopeDispose, shallowRef, watch } from 'vue'
import { useAuthStore } from '../stores/useAuthStore'
import { useStudioStore } from '../stores/useStudioStore'
import { createStudioAudioService } from '../utils/projectAudio'
import { prepareStudioVoiceJobInput, readStudioVoiceJobContext as readContext, resolveStudioVoiceJobInput, reviewStudioVoiceJobLines, studioVoiceGenerationTransportKey, studioVoiceJobLocales, studioVoiceJobProviders } from '../utils/voiceGeneration'
import { createStudioVoiceGenerationStore, voiceJobScopeKey } from '../utils/voiceGenerationStore'
import { useHostedVoiceJobs } from './useHostedVoiceJobs'
import { useManagedVoiceSession } from './useManagedVoiceSession'
import { useProjectContent } from './useProjectContent'

/** Only explicit run actions dispatch synthesis. Reconnect merely restores scope. */
function useLocalVoiceGenerationJobs(active: Ref<boolean>, changed?: () => void) {
  const project = useProjectContent()
  const studio = useStudioStore()
  const auth = useAuthStore()
  const transport = inject(studioVoiceGenerationTransportKey, undefined)
  const scope = computed(() => ({ accountId: auth.isLoggedIn && auth.userId ? auth.userId : 'local-device', projectId: studio.currentProjectId }))
  const scopeKey = computed(() => voiceJobScopeKey(scope.value))
  const online = shallowRef(navigator.onLine)
  const jobs = shallowRef<VoiceGenerationJob[]>([])
  const context = shallowRef<StudioVoiceJobContext>()
  const snapshot = shallowRef<VoiceAuthoringSnapshot>()
  const plan = shallowRef<VoiceGenerationJob>()
  const blocked = shallowRef<Array<{ lineId: string, code: string }>>([])
  const loading = shallowRef(false)
  const busy = shallowRef(false)
  const error = shallowRef('')
  const running = shallowRef<string[]>([])
  const locales = computed(() => context.value && snapshot.value ? studioVoiceJobLocales(context.value, snapshot.value) : [])
  let epoch = 0
  let reviewSequence = 0
  let current: {
    runner: ReturnType<typeof createVoiceGenerationRunner>
    refresh: () => Promise<void>
    valid: () => boolean
    fs: IFileSystem
  } | undefined

  function safeError(cause: unknown) {
    // Provider logs and credentials must never appear in task UI or persistence.
    const code = cause instanceof Error ? cause.message.split(':')[0]! : ''
    return /^[A-Z][A-Z0-9_]{0,79}$/u.test(code) ? code : 'AUDIO_JOB_OPERATION_FAILED'
  }

  function invalidatePlan() {
    reviewSequence++
    plan.value = undefined
    blocked.value = []
  }

  async function stopCurrent() {
    const old = current
    current = undefined
    const ids = [...running.value]
    running.value = []
    if (old)
      await Promise.allSettled(ids.map(id => old.runner.cancel(id)))
  }

  async function reload() {
    const request = ++epoch
    await stopCurrent()
    busy.value = false
    loading.value = false
    invalidatePlan()
    jobs.value = []
    context.value = undefined
    snapshot.value = undefined
    if (!active.value)
      return
    loading.value = true
    error.value = ''
    try {
      await project.whenReady()
      if (request !== epoch || !active.value)
        return
      const fs = project.getFs()
      if (!fs)
        throw new Error('ADV_AUDIO_PROJECT_REQUIRED')
      const capturedScope = { ...scope.value }
      const capturedKey = voiceJobScopeKey(capturedScope)
      const valid = () => request === epoch && capturedKey === scopeKey.value && fs === project.getFs() && active.value
      const authoring = createStudioAudioService(fs)
      let refresh!: () => Promise<void>
      const store = createStudioVoiceGenerationStore(capturedScope, { changed: () => {
        if (valid())
          void refresh().catch(cause => valid() && (error.value = safeError(cause)))
      } })
      let refreshEpoch = 0
      refresh = async () => {
        const read = ++refreshEpoch
        const document = await store.read()
        if (valid() && read === refreshEpoch)
          jobs.value = Object.values(document.jobs).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      }
      const assertCurrent = () => {
        if (!valid())
          throw new Error('AUDIO_JOB_SCOPE_CHANGED')
      }
      const runner = createVoiceGenerationRunner({
        store,
        authoring,
        async resolve(task, next) {
          assertCurrent()
          const input = await resolveStudioVoiceJobInput(await readContext(fs, next), next, task)
          const inspected = await prepareStudioVoiceJobInput(input, next, transport)
          assertCurrent()
          return inspected
        },
        async verifyInput(input, next) {
          assertCurrent()
          if (input.rights && !await fs.exists(input.rights.consentRecord))
            throw new Error('AUDIO_JOB_RIGHTS_REQUIRED')
          await transport?.verifyInput?.(input, next)
          assertCurrent()
        },
        ...(transport
          ? {
              async execute(input, dispatch) {
                assertCurrent()
                if (!transport.prepare)
                  throw new Error('AUDIO_JOB_INSPECTION_REQUIRED')
                if (!online.value)
                  throw new Error('AUDIO_JOB_OFFLINE')
                return await transport.execute(input, dispatch)
              },
              ...(transport.query
                ? { query: async (...args: Parameters<NonNullable<typeof transport.query>>) => {
                    assertCurrent()
                    return await transport.query!(...args)
                  } }
                : {}),
              providerConcurrency: transport.providerConcurrency,
            }
          : {}),
      })
      const nextSnapshot = await authoring.read()
      const nextContext = await readContext(fs, nextSnapshot)
      if (!valid())
        return
      current = { runner, refresh, valid, fs }
      context.value = nextContext
      snapshot.value = nextSnapshot
      await runner.prune()
      await refresh()
    }
    catch (cause) {
      if (request === epoch)
        error.value = safeError(cause)
    }
    finally {
      if (request === epoch)
        loading.value = false
    }
  }

  async function review(options: StudioVoiceJobSelection & { budget: VoiceGenerationBudget }) {
    const host = current
    if (!host || busy.value)
      return
    invalidatePlan()
    const sequence = reviewSequence
    const validReview = () => host.valid() && sequence === reviewSequence
    busy.value = true
    error.value = ''
    try {
      const authoring = createStudioAudioService(host.fs)
      const nextSnapshot = await authoring.read()
      if (!validReview())
        return
      const nextContext = await readContext(host.fs, nextSnapshot)
      if (!validReview())
        return
      const reviewed = await reviewStudioVoiceJobLines(nextContext, nextSnapshot, { ...options, prepareInput: input => prepareStudioVoiceJobInput(input, nextSnapshot, transport) })
      if (!validReview())
        return
      context.value = nextContext
      snapshot.value = nextSnapshot
      blocked.value = reviewed.blocked
      if (reviewed.blocked.length)
        throw new Error('AUDIO_JOB_PROFILE_REQUIRED')
      if (!reviewed.lines.length)
        throw new Error('AUDIO_JOB_NO_TARGETS')
      const lines = await Promise.all(reviewed.lines.map(async input => ({ ...input, estimatedCost: await transport?.quote?.(input) ?? null })))
      if (!validReview())
        return
      const next = await planVoiceGeneration({ ...scope.value, snapshot: nextSnapshot, lines, budget: options.budget })
      if (validReview())
        plan.value = next
    }
    catch (cause) {
      if (validReview())
        error.value = safeError(cause)
    }
    finally {
      if (host.valid())
        busy.value = false
    }
  }

  async function enqueue() {
    const host = current
    const reviewed = plan.value
    if (!host || !reviewed || busy.value)
      return
    busy.value = true
    error.value = ''
    try {
      // Scope/profile/text are rechecked by the shared runner before any bill.
      await host.runner.enqueue(reviewed)
      if (host.valid()) {
        invalidatePlan()
        await host.refresh()
      }
    }
    catch (cause) {
      if (host.valid())
        error.value = safeError(cause)
    }
    finally {
      if (host.valid())
        busy.value = false
    }
  }

  const canRun = (job: VoiceGenerationJob) => Boolean(current && online.value && active.value && !job.cancelled
    && !running.value.includes(job.id) && (transport?.prepare || !job.summary.newGenerations)
    && job.tasks.some(task => ['queued', 'unknown', 'generated', 'blocked', 'running'].includes(task.status))
    && (!job.tasks.some(task => ['unknown', 'running'].includes(task.status)) || transport?.query))

  async function command(id: string, action: 'run' | 'cancel' | 'resume' | 'retry') {
    const host = current
    const job = jobs.value.find(job => job.id === id)
    if (!host || !job)
      return
    error.value = ''
    if (action === 'run' && !canRun(job))
      return
    try {
      if (action === 'run') {
        running.value = [...running.value, id]
        await host.runner.run(id)
        if (host.valid()) {
          snapshot.value = await createStudioAudioService(host.fs).read()
          changed?.()
        }
      }
      else if (action === 'retry') {
        // Only proven failures can be retried; never include unknown dispatches.
        await host.runner.retry(id, job.tasks.filter(task => task.status === 'failed').map(task => task.id))
      }
      else {
        await host.runner[action](id)
      }
      if (host.valid())
        await host.refresh()
    }
    catch (cause) {
      if (host.valid())
        error.value = safeError(cause)
    }
    finally {
      if (host.valid() && action === 'run')
        running.value = running.value.filter(value => value !== id)
    }
  }

  function connectivity() {
    online.value = navigator.onLine
    if (!online.value) {
      const host = current
      if (host)
        void Promise.allSettled(running.value.map(id => host.runner.cancel(id)))
    }
    // Recover the same scope's local state, without dispatching queued work.
    else if (current) {
      void current.refresh().catch(cause => (error.value = safeError(cause)))
    }
  }
  window.addEventListener('online', connectivity)
  window.addEventListener('offline', connectivity)
  watch([active, scopeKey], () => void reload(), { immediate: true })
  onScopeDispose(() => {
    epoch++
    window.removeEventListener('online', connectivity)
    window.removeEventListener('offline', connectivity)
    void stopCurrent()
  })
  return { jobs, context, snapshot, plan, blocked, locales, providers: (locale: string) => context.value ? studioVoiceJobProviders(context.value, locale) : [], online, loading, busy, error, running, canRun, canGenerate: Boolean(transport?.prepare), canQuery: Boolean(transport?.query), reload, review, enqueue, command, invalidatePlan }
}

/** Managed endpoints use the server queue exclusively; offline drafts stay private. */
export function useVoiceGenerationJobs(active: Ref<boolean>, changed?: () => void) {
  const session = useManagedVoiceSession()
  const online = shallowRef(navigator.onLine)
  const connectivity = () => {
    online.value = navigator.onLine
  }
  window.addEventListener('online', connectivity)
  window.addEventListener('offline', connectivity)
  onScopeDispose(() => {
    window.removeEventListener('online', connectivity)
    window.removeEventListener('offline', connectivity)
  })
  const remoteActive = computed(() => active.value && online.value && Boolean(session.client.value))
  const local = useLocalVoiceGenerationJobs(computed(() => active.value && !remoteActive.value), changed)
  const remote = useHostedVoiceJobs(remoteActive, session.client, changed)
  const selected = computed(() => remoteActive.value ? remote : local)
  return {
    jobs: computed(() => selected.value.jobs.value),
    context: computed(() => selected.value.context.value),
    snapshot: computed(() => selected.value.snapshot.value),
    plan: computed(() => selected.value.plan.value),
    blocked: computed(() => selected.value.blocked.value),
    locales: computed(() => selected.value.locales.value),
    loading: computed(() => selected.value.loading.value),
    busy: computed(() => selected.value.busy.value),
    error: computed(() => selected.value.error.value),
    running: computed(() => selected.value.running.value),
    online,
    managed: session.configured,
    loginRequired: session.loginRequired,
    remoteActive,
    get canGenerate() { return remoteActive.value ? remote.canGenerate : !session.configured.value && local.canGenerate },
    get canQuery() { return selected.value.canQuery },
    canRun: (job: VoiceGenerationJob) => remoteActive.value ? remote.canRun(job) : !session.configured.value && local.canRun(job),
    isPrivate: (job: VoiceGenerationJob) => remoteActive.value && remote.isPrivate(job),
    reconcile: (job: VoiceGenerationJob) => remote.reconcile(job),
    providers: (locale: string) => selected.value.providers(locale),
    reload: () => selected.value.reload(),
    review: (...args: Parameters<typeof local.review>) => selected.value.review(...args),
    enqueue: () => selected.value.enqueue(),
    command: (...args: Parameters<typeof local.command>) => selected.value.command(...args),
    invalidatePlan: () => {
      local.invalidatePlan()
      remote.invalidatePlan()
    },
  }
}
