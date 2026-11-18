import type { VoiceProviderDiagnosis, VoiceProviderStatusPort, VoiceProviderStatusSnapshot } from '@advjs/types'
import { onBeforeUnmount, shallowReadonly, shallowRef, watch } from 'vue'

/** Metadata refresh is automatic; environment diagnostics only run from check(). */
export function useOfficialPluginStatus(port: () => VoiceProviderStatusPort | undefined, visible: () => boolean) {
  const snapshot = shallowRef<VoiceProviderStatusSnapshot>()
  const loading = shallowRef(false)
  const readFailed = shallowRef(false)
  const checking = shallowRef('')
  const diagnoses = shallowRef<Record<string, VoiceProviderDiagnosis>>({})
  const failures = shallowRef<Record<string, boolean>>({})
  let generation = 0
  let controller: AbortController | undefined
  function cancel() {
    generation++
    controller?.abort()
    loading.value = false
    checking.value = ''
  }
  async function reload() {
    cancel()
    const service = port()
    if (!service || !visible())
      return
    const current = generation
    const abort = new AbortController()
    controller = abort
    loading.value = true
    readFailed.value = false
    diagnoses.value = {}
    failures.value = {}
    try {
      const next = await service.read(abort.signal)
      if (current === generation && !abort.signal.aborted)
        snapshot.value = next
    }
    catch {
      if (current === generation && !abort.signal.aborted) {
        snapshot.value = undefined
        readFailed.value = true
      }
    }
    finally {
      if (current === generation)
        loading.value = false
    }
  }
  async function check(providerId: string) {
    const service = port()
    const provider = snapshot.value?.providers.find(item => item.id === providerId)
    if (!visible() || !service || loading.value || checking.value || !provider?.enabled || !provider.diagnostics)
      return
    const current = generation
    const abort = new AbortController()
    controller = abort
    checking.value = providerId
    failures.value = { ...failures.value, [providerId]: false }
    try {
      const result = await service.doctor(providerId, abort.signal)
      if (current === generation && !abort.signal.aborted && result.providerId === providerId)
        diagnoses.value = { ...diagnoses.value, [providerId]: result }
    }
    catch {
      if (current === generation && !abort.signal.aborted) {
        failures.value = { ...failures.value, [providerId]: true }
        const next = { ...diagnoses.value }
        delete next[providerId]
        diagnoses.value = next
      }
    }
    finally {
      if (current === generation)
        checking.value = ''
    }
  }
  watch([port, visible], ([next, shown], previous) => {
    cancel()
    if (next !== previous?.[0]) {
      snapshot.value = undefined
      diagnoses.value = {}
      failures.value = {}
      readFailed.value = false
    }
    if (shown)
      void reload()
  }, { immediate: true, flush: 'sync' })
  onBeforeUnmount(cancel)
  return { snapshot: shallowReadonly(snapshot), loading: shallowReadonly(loading), readFailed: shallowReadonly(readFailed), checking: shallowReadonly(checking), diagnoses: shallowReadonly(diagnoses), failures: shallowReadonly(failures), reload, check }
}
