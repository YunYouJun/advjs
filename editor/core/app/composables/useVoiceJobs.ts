import type { VoiceGenerationJob } from '@advjs/audio'
import type { EditorVoiceJobAction, EditorVoiceJobsPort, EditorVoiceJobsReviewedPlan, EditorVoiceJobsSnapshot } from '../../../../packages/advjs/shared/editor-audio'
import { parseAudioVoiceProfiles } from '@advjs/audio'
import { computed, onBeforeUnmount, shallowRef, watch } from 'vue'
import { useAudioStore } from '../stores/useAudioStore'
import { useProjectStore } from '../stores/useProjectStore'

export interface VoiceJobsDraft {
  providerId: string
  locale: string
  lineIds: string[]
  maxCharacters: string
  concurrency: string
  allowUnknownCost: boolean
}

export function useVoiceJobs(visible: () => boolean) {
  const project = useProjectStore()
  const audio = useAudioStore()
  const snapshot = shallowRef<EditorVoiceJobsSnapshot>()
  const review = shallowRef<EditorVoiceJobsReviewedPlan>()
  const draft = shallowRef<VoiceJobsDraft>({ providerId: '', locale: 'zh-CN', lineIds: [], maxCharacters: '10000', concurrency: '1', allowUnknownCost: false })
  const budgetReviewed = shallowRef(false)
  const pending = shallowRef(false)
  const loading = shallowRef(false)
  const error = shallowRef('')
  const status = shallowRef('')
  const running = new Set<string>()
  let epoch = 0
  let readController: AbortController | undefined
  let actionController: AbortController | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  let refreshing: Promise<void> | undefined

  const sourceLines = computed(() => Object.values(project.project?.compilation.project.program?.chapters ?? {}).flatMap(chapter => Object.values(chapter.nodes)).filter(node => node.kind === 'dialog' || node.kind === 'narration'))
  const lines = computed(() => sourceLines.value.flatMap(node => typeof node.data?.lineId === 'string' ? [{ id: node.data.lineId, speakerId: String(node.data.speakerId ?? 'narrator'), text: String(node.data.text ?? '') }] : []))
  const unboundCount = computed(() => sourceLines.value.length - lines.value.length)
  const jobs = computed(() => snapshot.value?.jobs ?? [])
  const available = computed(() => audio.supportedRoot && Boolean(snapshot.value?.configured))
  const hasTransport = computed(() => audio.supportedRoot && Boolean(audio.voiceJobs()))
  const narratorLocales = computed(() => {
    try {
      const source = project.project?.files['adv/audio/voice-profiles.json']
      return source ? Object.keys(parseAudioVoiceProfiles(JSON.parse(source)).narrator?.locales ?? {}) : []
    }
    catch { return [] }
  })
  const localeOptions = computed(() => [...new Set(['zh-CN', draft.value.locale, ...narratorLocales.value, ...(project.project?.compilation.project.characters ?? []).flatMap(character => Object.keys(character.voiceProfile?.locales ?? {}))])].filter(Boolean))
  const providerOptions = computed(() => (snapshot.value?.providers ?? []).map(provider => ({ value: provider.id, label: `${provider.id} · ${provider.backend === 'local' ? '本地' : '云端'}` })))
  const canPlan = computed(() => available.value && !pending.value && draft.value.lineIds.length > 0 && draft.value.lineIds.length <= 200 && Boolean(draft.value.providerId) && Number.isSafeInteger(Number(draft.value.maxCharacters)) && Number(draft.value.maxCharacters) > 0 && Number.isInteger(Number(draft.value.concurrency)) && Number(draft.value.concurrency) >= 1 && Number(draft.value.concurrency) <= 32)

  function showError(failure: unknown) {
    const code = failure instanceof Error ? failure.message.match(/^([A-Z][A-Z0-9_]{0,79})(?::|$)/u)?.[1] : undefined
    const explanations: Record<string, string> = {
      ADV_AUDIO_JOB_PROVIDER_UNCONFIGURED: '本地宿主尚未配置合成插件与默认预设。请配置项目 authoring.voice 后重新连接。',
      ADV_AUDIO_JOB_PROFILE_REQUIRED: '角色需要所选语言、插件和模型的声音配置；录制声音请通过资源导入。',
      ADV_AUDIO_JOB_PROFILE_MISMATCH: '角色声音配置与插件预设的真实模型、声音或来源不一致，请先审核配置。',
      ADV_AUDIO_JOB_REVIEW_STALE: '台词、词典、声音配置或预设已经变化，请重新创建并审核计划。',
      ADV_AUDIO_JOB_REVIEW_REQUIRED: '计划已过期或未被宿主审核，请重新创建计划。',
      AUDIO_JOB_UNKNOWN_COST: '插件没有费用估算。需明确同意未知费用，才能创建新生成计划。',
      AUDIO_JOB_QUERY_REQUIRED: '调用结果未知，必须先查询供应商结果；当前插件未提供查询，不能重复生成。',
      ADV_AUDIO_VOICE_CONSENT_REQUIRED: '克隆声音需要有效许可和项目中实际存在的同意记录。',
      ADV_AUDIO_VOICE_REFERENCE_REQUIRED: '参考声音必须是项目内已登记且校验通过的私有原始媒体。',
      ADV_AUDIO_CONTENT_ROOT_UNSUPPORTED: '配音任务目前需要项目使用 adv 内容根。',
    }
    error.value = code ? `${explanations[code] ?? '操作未完成，请检查已保存的项目配置。'} (${code})` : '配音任务操作未完成。宿主错误细节不会显示在此面板。'
  }
  function stopPolling() {
    clearTimeout(timer)
    timer = undefined
  }
  function schedule() {
    stopPolling()
    if (visible() && (running.size || jobs.value.some(job => job.tasks.some(task => task.status === 'running' || task.status === 'generated'))))
      timer = setTimeout(() => { void reload() }, 1000)
  }
  async function reload() {
    if (refreshing)
      return await refreshing
    const source = project.workspace
    const current = epoch
    let port
    try {
      port = audio.supportedRoot ? audio.voiceJobs() : undefined
    }
    catch { return }
    if (!source || !port)
      return
    readController?.abort()
    readController = new AbortController()
    const signal = readController.signal
    loading.value = true
    const operation = (async () => {
      try {
        const result = await port.read(signal)
        if (current !== epoch || project.workspace !== source)
          return
        const previous = jobs.value.flatMap(job => job.tasks.filter(task => task.status === 'committed').map(task => task.id)).join(',')
        snapshot.value = result
        for (const id of running) {
          const job = result.jobs.find(job => job.id === id)
          if (!job || job.cancelled || job.tasks.every(task => ['committed', 'failed', 'unknown', 'blocked', 'cancelled'].includes(task.status)))
            running.delete(id)
        }
        if (!draft.value.providerId || !result.providers.some(provider => provider.id === draft.value.providerId))
          draft.value = { ...draft.value, providerId: result.providers.find(provider => provider.default)?.id ?? result.providers[0]?.id ?? '' }
        if (result.unavailableCode)
          showError(new Error(result.unavailableCode))
        else
          error.value = ''
        if (previous !== result.jobs.flatMap(job => job.tasks.filter(task => task.status === 'committed').map(task => task.id)).join(','))
          await project.refreshProject()
      }
      catch (failure) {
        if (current === epoch && !signal.aborted)
          showError(failure)
      }
      finally {
        if (current === epoch) {
          loading.value = false
          schedule()
        }
      }
    })()
    refreshing = operation
    await operation
    if (refreshing === operation)
      refreshing = undefined
  }
  async function action(operation: (port: EditorVoiceJobsPort, signal: AbortSignal) => Promise<void>) {
    if (pending.value || !audio.supportedRoot)
      return
    const source = project.workspace
    const port = audio.voiceJobs()
    if (!source || !port)
      return
    const current = epoch
    const abort = new AbortController()
    actionController?.abort()
    actionController = abort
    pending.value = true
    error.value = status.value = ''
    try {
      await operation(port, abort.signal)
    }
    catch (failure) {
      if (current === epoch && !abort.signal.aborted)
        showError(failure)
    }
    finally {
      if (current === epoch)
        pending.value = false
    }
  }
  async function plan() {
    if (!canPlan.value)
      return
    review.value = undefined
    budgetReviewed.value = false
    const input = structuredClone(draft.value)
    await action(async (port, signal) => {
      const result = await port.plan({ lineIds: input.lineIds, locale: input.locale, providerId: input.providerId, budget: { maxCharacters: Number(input.maxCharacters), concurrency: Number(input.concurrency), allowUnknownCost: input.allowUnknownCost } }, signal)
      if (!signal.aborted)
        review.value = result
    })
  }
  async function enqueue() {
    if (!review.value || !budgetReviewed.value)
      return
    const approved = review.value
    await action(async (port, signal) => {
      await port.enqueue({ planId: approved.plan.id, planHash: approved.planHash }, signal)
      if (!signal.aborted) {
        review.value = undefined
        budgetReviewed.value = false
        status.value = '计划已入队。点击开始后才会调用合成插件，生成结果不会自动选用。'
        await reload()
      }
    })
  }
  async function command(job: VoiceGenerationJob, type: EditorVoiceJobAction) {
    await action(async (port, signal) => {
      await port.command({ jobId: job.id, action: type, ...(type === 'retry' ? { taskIds: job.tasks.filter(task => task.status === 'failed').map(task => task.id) } : {}) }, signal)
      if (!signal.aborted) {
        if (type === 'run')
          running.add(job.id)
        await reload()
      }
    })
  }
  function reset() {
    epoch++
    readController?.abort()
    actionController?.abort()
    stopPolling()
    running.clear()
    refreshing = undefined
    snapshot.value = review.value = undefined
    budgetReviewed.value = pending.value = loading.value = false
    error.value = status.value = ''
    draft.value = { ...draft.value, lineIds: [], providerId: '' }
  }
  watch(draft, () => {
    review.value = undefined
    budgetReviewed.value = false
  })
  watch(() => project.workspace, () => {
    reset()
    if (visible())
      void reload()
  }, { immediate: true })
  watch(visible, (value) => {
    if (value)
      void reload()
    else stopPolling()
  })
  watch(() => project.project?.files, () => {
    review.value = undefined
    budgetReviewed.value = false
  })
  onBeforeUnmount(reset)
  return { snapshot, review, draft, budgetReviewed, pending, loading, error, status, lines, unboundCount, jobs, available, hasTransport, localeOptions, providerOptions, canPlan, reload, plan, enqueue, command }
}
