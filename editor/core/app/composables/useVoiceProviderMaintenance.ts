import type { VoiceCleanupPlan, VoiceCleanupResult, VoiceProviderMaintenanceSnapshot } from '@advjs/types'
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
  const messages: Record<string, string> = {
    VOICE_RESOURCES_IN_USE: '资源仍在使用。请先停止受管理的服务，再刷新并预览清理。',
    VOICE_SERVICE_STILL_RUNNING: '还有进程在使用资源。请停止其他生成任务后重新检查。',
    VOICE_CLEANUP_PLAN_STALE: '资源或供应商状态已变化，请刷新并重新预览。',
    VOICE_CLEANUP_PLAN_EXPIRED: '审核计划已过期或已经执行，请刷新后重新预览。',
    VOICE_SHARED_RESOURCE_CONFIRMATION_REQUIRED: '所选资源存在共享使用方，请先核对共享影响。',
    VOICE_INSTALLATION_UNTRUSTED: '本地安装未登记或清单不匹配，不能自动清理。',
  }
  async function action(operation: (signal: AbortSignal) => Promise<void>) {
    if (pending.value)
      return
    const workspace = project.workspace
    pending.value = true
    error.value = ''
    controller = new AbortController()
    try {
      await operation(controller.signal)
    }
    catch (cause) {
      if (workspace === project.workspace) {
        const code = cause instanceof Error && /VOICE_[A-Z_]+/u.exec(cause.message)?.[0]
        error.value = (code && messages[code]) || '操作未完成。请刷新资源状态；不要重复提交已经执行的清理计划。'
      }
    }
    finally {
      pending.value = false
    }
  }
  async function read(signal?: AbortSignal) {
    const workspace = project.workspace
    const value = await workspace?.voiceMaintenance?.read(signal)
    if (workspace === project.workspace) {
      snapshot.value = value
      if (!value?.providers.some(item => item.id === providerId.value))
        providerId.value = value?.providers[0]?.id ?? ''
    }
  }
  const reload = () => action(async signal => read(signal))
  async function plan() {
    await action(async (signal) => {
      result.value = undefined
      const value = await project.workspace!.voiceMaintenance!.plan({ providerId: providerId.value, resourceIds: selected.value, allowShared: allowShared.value }, signal)
      if (signal.aborted)
        return
      review.value = value
      reviewed.value = false
    })
  }
  async function execute() {
    const plan = review.value
    if (!plan || !reviewed.value)
      return
    await action(async (signal) => {
      const value = await project.workspace!.voiceMaintenance!.execute({ id: plan.id, hash: plan.hash }, signal)
      if (signal.aborted)
        return
      result.value = value
      review.value = undefined
      selected.value = []
      await read(signal)
    })
  }
  async function stop() {
    await action(async (signal) => {
      await project.workspace!.voiceMaintenance!.stop(providerId.value, signal)
      await read(signal)
    })
  }
  async function enable() {
    await action(async (signal) => {
      await project.workspace!.voiceMaintenance!.enable(providerId.value, signal)
      await read(signal)
    })
  }
  watch([providerId, selected, allowShared], () => {
    review.value = undefined
    reviewed.value = false
  })
  watch(() => project.workspace, () => {
    controller?.abort()
    snapshot.value = undefined
    review.value = undefined
    result.value = undefined
    selected.value = []
    reviewed.value = false
  }, { flush: 'sync' })
  watch([visible, () => project.workspace], () => {
    if (visible() && available.value)
      void reload()
  }, { immediate: true })
  onBeforeUnmount(() => controller?.abort())
  return { snapshot, providerId, selected, allowShared, pending, error, review, reviewed, result, provider, available, reload, plan, execute, stop, enable }
}
