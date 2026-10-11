import { computed, onScopeDispose, shallowRef, watch } from 'vue'
import { useAuthStore } from '../stores/useAuthStore'
import { useStudioStore } from '../stores/useStudioStore'
import { connectLocalVoiceSession, DEFAULT_LOCAL_VOICE_URL, disconnectLocalVoiceSession, invalidateLocalVoiceActor, isLocalVoicePage, localVoiceConnecting, localVoiceSession, resolveLocalVoiceUrl } from '../utils/localVoiceSession'

/** Draft credentials never leave this mounted form or the memory-only client. */
export function useLocalVoiceConnection() {
  const auth = useAuthStore()
  const studio = useStudioStore()
  const baseUrl = shallowRef(DEFAULT_LOCAL_VOICE_URL)
  const accessToken = shallowRef('')
  const error = shallowRef('')
  const eligible = isLocalVoicePage()
  const connected = computed(() => Boolean(localVoiceSession.value))
  const projectId = computed(() => studio.currentProjectId)
  const canConnect = computed(() => eligible && !localVoiceConnecting.value && Boolean(resolveLocalVoiceUrl(baseUrl.value)) && /^[a-f0-9]{64}$/u.test(accessToken.value))
  let formEpoch = 0
  async function connect() {
    const version = ++formEpoch
    error.value = ''
    try {
      await connectLocalVoiceSession({ baseUrl: baseUrl.value, accessToken: accessToken.value }, { actor: () => ({ projectId: studio.currentProjectId, actorId: auth.userId }) })
      if (version === formEpoch)
        accessToken.value = ''
    }
    catch (cause) {
      if (version === formEpoch) {
        const code = cause instanceof Error ? cause.message : ''
        error.value = /^[A-Z][A-Z0-9_]+$/u.test(code) ? code : 'AUDIO_LOCAL_CONNECTION_FAILED'
      }
    }
  }
  function disconnect() {
    formEpoch++
    accessToken.value = ''
    error.value = ''
    disconnectLocalVoiceSession()
  }
  watch([() => studio.currentProjectId, () => auth.userId], () => {
    invalidateLocalVoiceActor({ projectId: studio.currentProjectId, actorId: auth.userId })
    formEpoch++
    accessToken.value = ''
    error.value = ''
  }, { flush: 'sync' })
  onScopeDispose(() => {
    formEpoch++
    accessToken.value = ''
    // A pending form cannot activate a connection after it disappears.
    if (localVoiceConnecting.value)
      disconnectLocalVoiceSession()
  })
  return { baseUrl, accessToken, error, eligible, connected, projectId, canConnect, connecting: localVoiceConnecting, session: localVoiceSession, connect, disconnect }
}
