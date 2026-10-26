import { ManagedCreativeTeamClient } from '@advjs/agent'
import { inject, onBeforeUnmount, onMounted, watch } from 'vue'
import { createRuntimeAccessTokenGetter, parseAuthenticatedCloudbaseSession } from '../auth/cloudbase-session'
import { useAuthStore } from '../stores/useAuthStore'
import { useCreativeTeamStore } from '../stores/useCreativeTeamStore'
import { useStudioStore } from '../stores/useStudioStore'
import { resolveManagedVoiceServiceUrl } from '../utils/managedVoiceHttp'
import { cloudbaseAuthInjectionKey } from './useCloudbase'

/** A visible workspace reads persisted state; only explicit author actions submit work. */
export function useCreativeTeamSession() {
  const sdk = inject(cloudbaseAuthInjectionKey, undefined)
  const auth = useAuthStore()
  const studio = useStudioStore()
  const store = useCreativeTeamStore()
  const endpoint = resolveManagedVoiceServiceUrl(import.meta.env.VITE_ADVJS_AI_RUNTIME_URL)
  const configured = Boolean(endpoint && import.meta.env.VITE_ADVJS_AI_RUNTIME_PROTOCOL === 'v2'
    && import.meta.env.VITE_ADVJS_AI_RUNTIME_APPLICATION_ID === 'advjs-studio-web')
  let timer: ReturnType<typeof setInterval> | undefined

  watch([() => auth.userId, () => auth.isLoggedIn, () => studio.currentProject?.projectId], ([accountId, loggedIn, projectId]) => {
    store.disconnect()
    if (!configured || !endpoint || !sdk || !loggedIn || !accountId || !projectId)
      return
    const assertCurrent = (value: unknown) => {
      if (parseAuthenticatedCloudbaseSession(value)?.user.id !== accountId || !auth.isLoggedIn || studio.currentProject?.projectId !== projectId)
        throw new Error('Creative session changed')
      return value
    }
    store.configure({
      accountId,
      projectId,
      client: new ManagedCreativeTeamClient({
        baseUrl: endpoint,
        accountId,
        getAccessToken: createRuntimeAccessTokenGetter({
          getSession: async () => assertCurrent(await sdk.getSession()),
          refreshSession: async token => assertCurrent(await sdk.refreshSession(token)),
        }, { onSessionExpired: () => auth.clearSession() }),
      }),
    })
    void store.refresh()
  }, { immediate: true, flush: 'sync' })

  function recover() {
    if (document.visibilityState === 'visible')
      void store.refresh()
  }
  onMounted(() => {
    window.addEventListener('online', recover)
    document.addEventListener('visibilitychange', recover)
    timer = setInterval(() => {
      if (store.needsPolling && document.visibilityState === 'visible')
        void store.refresh()
    }, 5000)
  })
  onBeforeUnmount(() => {
    clearInterval(timer)
    window.removeEventListener('online', recover)
    document.removeEventListener('visibilitychange', recover)
    store.disconnect()
  })
  return { configured }
}
