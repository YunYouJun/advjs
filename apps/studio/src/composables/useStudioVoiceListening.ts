import type { VoiceListeningCandidate } from '@advjs/audio'
import { attestVoiceListeningSession, createVoiceListeningSession, exportVoiceListeningSession, inspectVoiceListeningSession, recordVoiceListeningPlayback, restoreVoiceListeningSession, setVoiceListeningEnvironment, setVoiceListeningSampleReview } from '@advjs/audio'
import { computed, onScopeDispose, shallowRef, watch } from 'vue'

export type StudioVoicePlayback = Parameters<typeof recordVoiceListeningPlayback>[2] & { assetId: string }

/** Private author draft only: never write scores or playback logs into the native project. */
export function useStudioVoiceListening(options: { projectId: () => string, scopeKey: () => string, contextRevision: () => string, candidates: () => VoiceListeningCandidate[], active: () => boolean, stop: () => void }) {
  const session = shallowRef<ReturnType<typeof createVoiceListeningSession>>()
  const error = shallowRef('')
  const invalidated = shallowRef(false)
  const summary = computed(() => {
    if (!session.value)
      return undefined
    const next = inspectVoiceListeningSession(session.value)
    return invalidated.value ? { ...next, canAttest: false, eligibleHumanReview: false, status: 'pending' as const } : next
  })
  const storageKey = () => `advjs-studio-private-listening-v1:${encodeURIComponent(options.scopeKey())}`
  function start(takeIds: string[]) {
    options.stop()
    error.value = ''
    invalidated.value = false
    try {
      session.value = createVoiceListeningSession({ projectId: options.projectId(), candidates: options.candidates().filter(candidate => takeIds.includes(candidate.takeId)) })
    }
    catch {
      error.value = 'VOICE_LISTENING_CANDIDATES_REQUIRED'
    }
  }
  function playback(event: StudioVoicePlayback) {
    if (!options.active() || !session.value || invalidated.value)
      return
    const sample = session.value.samples.find(sample => sample.candidate.assetId === event.assetId)
    if (sample) {
      try {
        const { assetId: _assetId, ...playback } = event
        session.value = recordVoiceListeningPlayback(session.value, sample.id, playback)
      }
      catch { error.value = 'VOICE_LISTENING_PLAYBACK_INVALID' }
    }
  }
  function review(id: string, patch: Parameters<typeof setVoiceListeningSampleReview>[2]) {
    if (session.value)
      session.value = setVoiceListeningSampleReview(session.value, id, patch)
  }
  function environment(value: Parameters<typeof setVoiceListeningEnvironment>[1]) {
    if (session.value)
      session.value = setVoiceListeningEnvironment(session.value, value)
  }
  function attest(value: boolean) {
    if (session.value && (!value || summary.value?.canAttest))
      session.value = attestVoiceListeningSession(session.value, value)
  }
  function exportJson() {
    return session.value ? exportVoiceListeningSession(session.value) : undefined
  }
  function restore(value: unknown) {
    options.stop()
    error.value = ''
    try {
      session.value = restoreVoiceListeningSession(value, { projectId: options.projectId(), candidates: options.candidates() })
      invalidated.value = false
    }
    catch { error.value = 'VOICE_LISTENING_RESTORE_MISMATCH' }
  }
  watch(options.scopeKey, () => {
    session.value = undefined
    error.value = ''
    invalidated.value = false
    options.stop()
    try {
      const json = localStorage.getItem(storageKey())
      if (json && json.length <= 512 * 1024)
        restore(json)
    }
    catch { error.value = 'VOICE_LISTENING_STORAGE_UNAVAILABLE' }
  }, { flush: 'sync', immediate: true })
  watch(session, (value) => {
    if (!value)
      return
    try {
      const json = exportVoiceListeningSession(value)
      if (json.length > 512 * 1024)
        throw new Error('VOICE_LISTENING_DRAFT_TOO_LARGE')
      localStorage.setItem(storageKey(), json)
    }
    catch { error.value = 'VOICE_LISTENING_STORAGE_UNAVAILABLE' }
  })
  watch([() => JSON.stringify(options.candidates()), options.contextRevision], () => {
    if (session.value) {
      session.value = attestVoiceListeningSession(session.value, false)
      restore(session.value)
      if (error.value)
        invalidated.value = true
    }
    options.stop()
  }, { flush: 'sync' })
  watch(options.active, active => !active && options.stop(), { flush: 'sync' })
  onScopeDispose(options.stop)
  return { session, summary, error, invalidated, start, playback, review, environment, attest, exportJson, restore }
}
