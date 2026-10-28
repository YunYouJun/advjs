import { computed, onScopeDispose, shallowRef, watch } from 'vue'
import { useAuthStore } from '../stores/useAuthStore'
import { useCreativeTeamStore } from '../stores/useCreativeTeamStore'
import { useStudioStore } from '../stores/useStudioStore'
import { createStudioCreativeWorkspace } from '../utils/creativeTeamWorkspace'
import { flushStudioFileMutations, studioFileMutationRevision, subscribeStudioFileMutations, whenStudioFileMutationsSettle } from '../utils/fs/mutations'
import { whenStudioProjectWritesSettle } from '../utils/projectAudio'
import { useProjectContent } from './useProjectContent'

/** A visible workspace reconciles saved sources without generating work or writing project files. */
export function useCreativeSourceSync(busy: () => boolean) {
  const store = useCreativeTeamStore()
  const studio = useStudioStore()
  const auth = useAuthStore()
  const content = useProjectContent()
  const status = shallowRef<'idle' | 'checking' | 'current' | 'failed' | 'deferred' | 'historical'>('idle')
  let epoch = 0
  let dirty = false
  let disposed = false
  let running: number | undefined
  let unsubscribe: (() => void) | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  const supported = () => Boolean(store.connected && store.run && store.run.accountId === auth.userId && store.run.plan.projectId === studio.currentProject?.projectId && store.availability?.authoring?.sourceSync)

  function schedule() {
    if (!supported() || disposed)
      return
    dirty = true
    status.value = 'checking'
    clearTimeout(timer)
    timer = setTimeout(() => void reconcile(), 150)
  }
  async function reconcile() {
    if (running === epoch || !dirty || busy() || store.mutating || !supported() || disposed)
      return
    const scope = epoch
    const runId = store.run!.id
    const projectId = studio.currentProject!.projectId
    dirty = false
    running = scope
    try {
      await content.whenReady()
      if (scope !== epoch || !supported() || disposed)
        return
      const fs = content.getFs()
      if (!fs)
        throw new Error('Creative filesystem unavailable')
      await whenStudioProjectWritesSettle(fs)
      await whenStudioFileMutationsSettle(fs)
      const revision = studioFileMutationRevision(fs)
      const isCurrent = () => !disposed && epoch === scope && supported() && store.run?.id === runId && content.getFs() === fs && revision === studioFileMutationRevision(fs)
      if (!isCurrent() || busy()) {
        if (scope === epoch)
          dirty = true
        return
      }
      await flushStudioFileMutations(fs)
      const snapshot = await createStudioCreativeWorkspace(fs, projectId, { assertCurrent() {
        if (!isCurrent())
          throw new Error('Creative source changed during capture')
      } }).snapshot()
      if (!isCurrent() || busy()) {
        if (scope === epoch)
          dirty = true
        return
      }
      const result = await store.checkSource({ id: projectId, revision: snapshot.revision, files: snapshot.files }, isCurrent)
      if (isCurrent()) {
        if (result === 'failed') {
          dirty = false
          status.value = 'failed'
        }
        else if (!dirty) {
          status.value = result === 'unsupported' ? 'idle' : result
        }
      }
    }
    catch {
      if (scope === epoch && !dirty)
        status.value = 'failed'
    }
    finally {
      if (running === scope)
        running = undefined
      if (dirty && scope === epoch && !busy() && !store.mutating)
        schedule()
    }
  }
  watch([() => auth.userId, () => studio.currentProject?.projectId, () => store.run?.id, () => store.availability?.authoring?.sourceSync, () => content.getFs()], () => {
    epoch += 1
    dirty = false
    clearTimeout(timer)
    unsubscribe?.()
    status.value = 'idle'
    const fs = content.getFs()
    if (!supported() || !fs)
      return
    unsubscribe = subscribeStudioFileMutations(fs, (event) => {
      if (event.external && status.value === 'failed')
        return
      if (event.path === 'adv' || event.path.startsWith('adv/') || event.path === 'adv.config.json')
        schedule()
    })
    schedule()
  }, { immediate: true, flush: 'sync' })
  watch([busy, () => store.mutating, () => store.run?.milestones?.some(item => item.status === 'prepared')], () => {
    if (dirty && !busy() && !store.mutating)
      schedule()
    else if (status.value === 'deferred' && !store.run?.milestones?.some(item => item.status === 'prepared'))
      schedule()
  })
  function resume() {
    if (typeof document !== 'undefined' && document.visibilityState !== 'hidden' && status.value !== 'failed')
      schedule()
  }
  // Broadcasts are hints and can be unavailable or missed while suspended.
  if (typeof window !== 'undefined') {
    window.addEventListener('focus', resume)
    window.addEventListener('pageshow', resume)
  }
  if (typeof document !== 'undefined')
    document.addEventListener('visibilitychange', resume)
  onScopeDispose(() => {
    disposed = true
    epoch += 1
    clearTimeout(timer)
    unsubscribe?.()
    if (typeof window !== 'undefined') {
      window.removeEventListener('focus', resume)
      window.removeEventListener('pageshow', resume)
    }
    if (typeof document !== 'undefined')
      document.removeEventListener('visibilitychange', resume)
  })
  return { status, blocked: computed(() => ['checking', 'failed', 'deferred'].includes(status.value)), retry: schedule }
}
