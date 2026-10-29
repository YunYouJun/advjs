import { computed, inject, onBeforeUnmount, shallowRef, watch } from 'vue'
import { createRuntimeAccessTokenGetter, parseAuthenticatedCloudbaseSession } from '../auth/cloudbase-session'
import { useAuthStore } from '../stores/useAuthStore'
import { useStudioStore } from '../stores/useStudioStore'
import { invalidateLocalVoiceActor, localVoiceConnecting, localVoiceSession } from '../utils/localVoiceSession'
import { createManagedVoiceClient } from '../utils/managedVoiceClient'
import { resolveManagedVoiceServiceUrl } from '../utils/managedVoiceHttp'
import { cloudbaseAuthInjectionKey } from './useCloudbase'
import { useStudioIdentity } from './useStudioIdentity'

/** Bind the deployed service to the existing verified account and current project. */
export function useManagedVoiceSession() {
  const sdk = inject(cloudbaseAuthInjectionKey, undefined)
  const auth = useAuthStore()
  const studio = useStudioStore()
  const identity = useStudioIdentity()
  const endpoint = resolveManagedVoiceServiceUrl(import.meta.env.VITE_ADVJS_VOICE_SERVICE_URL || import.meta.env.VITE_ADVJS_AI_RUNTIME_URL)
  let generation = 0
  const active = shallowRef(true)
  watch([() => studio.currentProjectId, () => auth.userId, () => auth.isLoggedIn], () => {
    generation += 1
    invalidateLocalVoiceActor({ projectId: studio.currentProjectId, actorId: auth.userId })
  }, { immediate: true, flush: 'sync' })
  onBeforeUnmount(() => {
    generation += 1
    active.value = false
  })
  const cloudClient = computed(() => {
    if (!active.value || !endpoint || !sdk || !auth.isLoggedIn || !auth.userId)
      return undefined
    const epoch = generation
    const sessionAuth = identity?.sessionAuth() ?? sdk
    const accountId = auth.userId
    const projectId = studio.currentProjectId
    const isCurrent = () => active.value && epoch === generation && auth.isLoggedIn && auth.userId === accountId && studio.currentProjectId === projectId
    const assertCurrent = () => {
      if (!isCurrent())
        throw new Error('AUDIO_JOB_SCOPE_CHANGED')
    }
    const verifyActor = (value: unknown) => {
      assertCurrent()
      if (parseAuthenticatedCloudbaseSession(value)?.user.id !== accountId)
        throw new Error('AUDIO_JOB_SCOPE_CHANGED')
      return value
    }
    const expireCurrent = () => {
      if (isCurrent())
        auth.clearSession()
    }
    return createManagedVoiceClient({
      baseUrl: endpoint,
      accountId,
      projectId,
      assertCurrent,
      getAccessToken: createRuntimeAccessTokenGetter({
        getSession: async () => verifyActor(await sessionAuth.getSession()),
        refreshSession: async refreshToken => verifyActor(await sessionAuth.refreshSession(refreshToken)),
      }, { onSessionExpired: expireCurrent }),
      onSessionExpired: expireCurrent,
    })
  })
  const client = computed(() => localVoiceSession.value?.client ?? cloudClient.value)
  const configured = computed(() => Boolean(endpoint || localVoiceSession.value || localVoiceConnecting.value))
  return { client, configured, local: computed(() => Boolean(localVoiceSession.value)), loginRequired: computed(() => Boolean(endpoint && !localVoiceSession.value && !auth.isLoggedIn)) }
}
