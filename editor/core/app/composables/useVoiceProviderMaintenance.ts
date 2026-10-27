import type { VoiceCleanupPlan, VoiceCleanupResult, VoiceProviderMaintenancePort, VoiceProviderMaintenanceSnapshot } from '@advjs/types'
import { computed, onBeforeUnmount, shallowRef, watch } from 'vue'
import { useProjectStore } from '../stores/useProjectStore'

export function useVoiceProviderMaintenance(visible: () => boolean) {
  const project = useProjectStore()
  const snapshot = shallowRef<VoiceProviderMaintenanceSnapshot>()
  const providerId = shallowRef('')
  const selected = shallowRef<string[]>([])
  const allowShared = shallowRef(false)
  const pending = shallowRef(false)
  const error = shallowRef('')
  const review = shallowRef<VoiceCleanupPlan>()
  const reviewed = shallowRef(false)
  const result = shallowRef<VoiceCleanupResult>()
  const provider = computed(() => snapshot.value?.providers.find(item => item.id === providerId.value))
  const available = computed(() => Boolean(project.workspace?.voiceMaintenance))
  let controller: AbortController | undefined
  let epoch = 0
  let disposed = false
  const messages: Record<string, string> = {
    VOICE_RESOURCES_IN_USE: '资源仍在使用。请先停止受管理的服务，再刷新并预览清理。',
    VOICE_SERVICE_STILL_RUNNING: '还有进程在使用资源。请停止其他生成任务后重新检查。',
    VOICE_CLEANUP_PLAN_STALE: '资源或供应商状态已变化，请刷新并重新预览。',
    VOICE_CLEANUP_PLAN_EXPIRED: '审核计划已过期或已经执行，请刷新后重新预览。',
    VOICE_SHARED_RESOURCE_CONFIRMATION_REQUIRED: '所选资源存在共享使用方，请先核对共享影响。',
    VOICE_INSTALLATION_UNTRUSTED: '本地安装未登记或清单不匹配，不能自动清理。',
  }
  async function action(operation: (port: VoiceProviderMaintenancePort, signal: AbortSignal, current: () => boolean) => Promise<void>) {
    const workspace = project.workspace
    const port = workspace?.voiceMaintenance
    if (disposed || pending.value || !visible() || !port)
      return
    const requestEpoch = epoch
    const abort = new AbortController()
    const current = () => !disposed && requestEpoch === epoch && workspace === project.workspace && !abort.signal.aborted
    pending.value = true
    error.value = ''
    controller = abort
    try {
      await operation(port, abort.signal, current)
    }
    catch (cause) {
      if (current()) {
        const code = cause instanceof Error && /VOICE_[A-Z_]+/u.exec(cause.message)?.[0]
        error.value = (code && messages[code]) || '操作未完成。停止等待不代表已经开始的服务端清理已撤销；请刷新资源状态，不要重复提交清理计划。'
      }
    }
    finally {
      if (current()) {
        pending.value = false
        controller = undefined
      }
    }
  }
  async function read(port: VoiceProviderMaintenancePort, signal: AbortSignal, current: () => boolean) {
    if (!current())
      return
    const value = await port.read(signal)
    if (current()) {
      snapshot.value = value
      if (!value.providers.some(item => item.id === providerId.value))
        providerId.value = value.providers[0]?.id ?? ''
    }
  }
  const reload = () => action(read)
  async function plan() {
    await action(async (port, signal, current) => {
      result.value = undefined
      const value = await port.plan({ providerId: providerId.value, resourceIds: [...selected.value], allowShared: allowShared.value }, signal)
      if (!current())
        return
      review.value = value
      reviewed.value = false
    })
  }
  async function execute() {
    const plan = review.value
    if (!plan || !reviewed.value)
      return
    await action(async (port, signal, current) => {
      const value = await port.execute({ id: plan.id, hash: plan.hash }, signal)
      if (!current())
        return
      result.value = value
      review.value = undefined
      selected.value = []
      await read(port, signal, current)
    })
  }
  async function stop() {
    await action(async (port, signal, current) => {
      await port.stop(providerId.value, signal)
      await read(port, signal, current)
    })
  }
  async function enable() {
    await action(async (port, signal, current) => {
      await port.enable(providerId.value, signal)
      await read(port, signal, current)
    })
  }
  watch([providerId, selected, allowShared], () => {
    review.value = undefined
    reviewed.value = false
  })
  function cancel() {
    epoch++
    controller?.abort()
    controller = undefined
    pending.value = false
  }
  function reset() {
    cancel()
    snapshot.value = undefined
    providerId.value = ''
    review.value = undefined
    result.value = undefined
    selected.value = []
    allowShared.value = false
    reviewed.value = false
    error.value = ''
  }
  watch([visible, () => project.workspace], ([shown, workspace], previous) => {
    if (!previous || previous[1] !== workspace)
      reset()
    else if (!shown)
      cancel()
    if (visible() && available.value)
      void reload()
  }, { immediate: true, flush: 'sync' })
  onBeforeUnmount(() => {
    disposed = true
    cancel()
  })
  return { snapshot, providerId, selected, allowShared, pending, error, review, reviewed, result, provider, available, reload, plan, execute, stop, enable }
}
