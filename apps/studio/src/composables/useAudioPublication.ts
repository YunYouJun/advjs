import type { Ref } from 'vue'
import type { HostedAudioPublication, HostedAudioReleasePreparation, HostedAudioReleaseReview } from '../../../../packages/advjs/shared/hosted-audio'
import { computed, onScopeDispose, shallowRef, watch } from 'vue'
import { useStudioStore } from '../stores/useStudioStore'
import { useManagedVoiceSession } from './useManagedVoiceSession'
import { useProjectContent } from './useProjectContent'

/** Explicit review/publish state, sharing the authenticated TTS native-project sync. */
export function useAudioPublication(active: Ref<boolean>) {
  const session = useManagedVoiceSession()
  const project = useProjectContent()
  const studio = useStudioStore()
  const review = shallowRef<HostedAudioReleaseReview>()
  const current = shallowRef<HostedAudioPublication | null>(null)
  const busy = shallowRef(false)
  const error = shallowRef('')
  const canReview = computed(() => Boolean(active.value && session.client.value && !busy.value))
  let epoch = 0
  let controller: AbortController | undefined
  async function waitForReview(task: HostedAudioReleasePreparation, client: NonNullable<typeof session.client.value>, signal: AbortSignal) {
    const deadline = Date.now() + 60 * 60_000
    while (['queued', 'running'].includes(task.status)) {
      if (Date.now() >= deadline)
        throw new Error('AUDIO_RELEASE_REQUEST_FAILED')
      await new Promise<void>((resolve, reject) => {
        let timer: ReturnType<typeof setTimeout>
        const abort = () => {
          clearTimeout(timer)
          reject(new Error('AUDIO_RELEASE_REQUEST_CANCELLED'))
        }
        timer = setTimeout(() => {
          signal.removeEventListener('abort', abort)
          resolve()
        }, 750)
        signal.addEventListener('abort', abort, { once: true })
        if (signal.aborted)
          abort()
      })
      task = await client.request<HostedAudioReleasePreparation>(`/releases/preparations/${task.id}`, 'GET', undefined, signal)
    }
    if (task.status !== 'ready' || !task.review)
      throw new Error(task.error ?? 'AUDIO_RELEASE_PREPARATION_FAILED')
    return task.review
  }
  function invalidate() {
    epoch++
    controller?.abort()
    review.value = undefined
    current.value = null
    error.value = ''
    busy.value = false
  }
  async function run(operation: 'review' | 'publish' | 'current') {
    const client = session.client.value
    if (!client || !active.value || busy.value)
      return
    const taskEpoch = ++epoch
    controller = new AbortController()
    const signal = controller.signal
    busy.value = true
    error.value = ''
    try {
      if (operation === 'review') {
        review.value = undefined
        await project.whenReady()
        const fs = project.getFs()
        if (!fs)
          throw new Error('ADV_AUDIO_PROJECT_REQUIRED')
        const { snapshot } = await client.syncNativeProject(fs, signal)
        const preparation = await client.request<HostedAudioReleasePreparation>('/releases/prepare', 'POST', { expectedSourceRevision: snapshot.revision }, signal)
        const result = await waitForReview(preparation, client, signal)
        client.assertCurrent()
        if (taskEpoch === epoch)
          review.value = result
      }
      else if (operation === 'publish') {
        const plan = review.value
        if (!plan)
          return
        // Sync selections once more; the host rejects a review whose source changed.
        const fs = project.getFs()
        if (!fs)
          throw new Error('ADV_AUDIO_PROJECT_REQUIRED')
        const { snapshot } = await client.syncNativeProject(fs, signal)
        if (snapshot.revision !== plan.sourceRevision)
          throw new Error('AUDIO_RELEASE_SOURCE_CONFLICT')
        const result = await client.request<HostedAudioPublication>('/releases/publish', 'POST', { planId: plan.planId, expectedManifestRevision: plan.expectedManifestRevision, expectedSourceRevision: plan.sourceRevision }, signal)
        client.assertCurrent()
        if (taskEpoch === epoch) {
          current.value = result
          review.value = undefined
        }
      }
      else {
        const result = await client.request<HostedAudioPublication | null>('/releases/current', 'GET', undefined, signal)
        const tasks = await client.request<HostedAudioReleasePreparation[]>('/releases/preparations', 'GET', undefined, signal)
        const latest = tasks.at(-1)
        const prepared = latest && latest.status !== 'failed' ? await waitForReview(latest, client, signal) : undefined
        client.assertCurrent()
        if (taskEpoch === epoch) {
          current.value = result
          if (prepared && Date.parse(prepared.expiresAt) > Date.now() && prepared.expectedManifestRevision === (result?.revision ?? null))
            review.value = prepared
        }
      }
    }
    catch (cause) {
      if (taskEpoch === epoch) {
        const message = cause instanceof Error ? cause.message : ''
        error.value = /^[A-Z][A-Z0-9_]+$/u.test(message) ? message : 'AUDIO_RELEASE_REQUEST_FAILED'
        if (message.includes('CONFLICT') || message.includes('EXPIRED'))
          review.value = undefined
      }
    }
    finally {
      if (taskEpoch === epoch)
        busy.value = false
    }
  }
  watch([active, () => studio.currentProjectId, session.client], invalidate, { flush: 'sync' })
  onScopeDispose(invalidate)
  return { review, current, busy, error, canReview, configured: session.configured, loginRequired: session.loginRequired, prepare: () => run('review'), publish: () => run('publish'), refresh: () => run('current') }
}
