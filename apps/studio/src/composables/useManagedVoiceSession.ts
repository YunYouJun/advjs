import { computed, inject, watch } from 'vue'
import { createRuntimeAccessTokenGetter, parseAuthenticatedCloudbaseSession } from '../auth/cloudbase-session'
import { useAuthStore } from '../stores/useAuthStore'
import { useStudioStore } from '../stores/useStudioStore'
import { invalidateLocalVoiceActor, localVoiceConnecting, localVoiceSession } from '../utils/localVoiceSession'
import { createManagedVoiceClient } from '../utils/managedVoiceClient'
import { resolveManagedVoiceServiceUrl } from '../utils/managedVoiceHttp'
import { cloudbaseAuthInjectionKey } from './useCloudbase'

/** Bind the deployed service to the existing verified account and current project. */
export function useManagedVoiceSession() {
  const sdk = inject(cloudbaseAuthInjectionKey, undefined)
  const auth = useAuthStore()
  const studio = useStudioStore()
  const endpoint = resolveManagedVoiceServiceUrl(import.meta.env.VITE_ADVJS_VOICE_SERVICE_URL || import.meta.env.VITE_ADVJS_AI_RUNTIME_URL)
  watch([() => studio.currentProjectId, () => auth.userId], () => {
    invalidateLocalVoiceActor({ projectId: studio.currentProjectId, actorId: auth.userId })
  }, { immediate: true, flush: 'sync' })
  const cloudClient = computed(() => {
    if (!endpoint || !sdk || !auth.isLoggedIn || !auth.userId)
      return undefined
    const accountId = auth.userId
    const projectId = studio.currentProjectId
    const assertCurrent = () => {
      if (!auth.isLoggedIn || auth.userId !== accountId || studio.currentProjectId !== projectId)
        throw new Error('AUDIO_JOB_SCOPE_CHANGED')
    }
    const verifyActor = (value: unknown) => {
      if (parseAuthenticatedCloudbaseSession(value)?.user.id !== accountId)
        throw new Error('AUDIO_JOB_SCOPE_CHANGED')
      return value
    }
    return createManagedVoiceClient({
      baseUrl: endpoint,
      accountId,
      projectId,
      assertCurrent,
      getAccessToken: createRuntimeAccessTokenGetter({
        getSession: async () => verifyActor(await sdk.getSession()),
        refreshSession: async refreshToken => verifyActor(await sdk.refreshSession(refreshToken)),
      }, { onSessionExpired: () => auth.clearSession() }),
      onSessionExpired: () => auth.clearSession(),
    })
  })
  const client = computed(() => localVoiceSession.value?.client ?? cloudClient.value)
  const configured = computed(() => Boolean(endpoint || localVoiceSession.value || localVoiceConnecting.value))
  return { client, configured, local: computed(() => Boolean(localVoiceSession.value)), loginRequired: computed(() => Boolean(endpoint && !localVoiceSession.value && !auth.isLoggedIn)) }
}
