import type cloudbase from '@cloudbase/js-sdk'
import type { ManagedAgentProtocol } from '../agent/managed/runtime'
import { storeToRefs } from 'pinia'
import { inject, onBeforeUnmount, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ManagedAgentPointsClient } from '../agent/managed/points'
import { ManagedAgentRuntime } from '../agent/managed/runtime'
import { createRuntimeAccessTokenGetter } from '../auth/cloudbase-session'
import { useAuthStore } from '../stores/useAuthStore'
import { useManagedAgentStore } from '../stores/useManagedAgentStore'
import { cloudbaseAuthInjectionKey } from './useCloudbase'

export function resolveManagedAgentRuntimeUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim())
    return undefined
  try {
    const url = new URL(value.trim())
    const isLocal = url.hostname === 'localhost' || url.hostname.endsWith('.localhost')
    if (url.protocol !== 'https:' && !(isLocal && url.protocol === 'http:'))
      return undefined
    return url.toString().replace(/\/$/, '')
  }
  catch {
    return undefined
  }
}

export function resolveManagedAgentProtocol(value: unknown): ManagedAgentProtocol | undefined {
  if (value === undefined || value === '')
    return 'v1'
  return value === 'v1' || value === 'v2' ? value : undefined
}

export function resolveManagedAgentApplicationId(
  value: unknown,
  protocol: ManagedAgentProtocol,
): string | undefined {
  if (protocol === 'v1')
    return undefined
  return typeof value === 'string' && /^[\w.:-]{1,128}$/.test(value) ? value : undefined
}

/** Keeps the authenticated managed runtime attached to the tab shell. */
export function useManagedAgentSession(): void {
  const auth = inject(cloudbaseAuthInjectionKey) as cloudbase.auth.App | undefined
  const authStore = useAuthStore()
  const managedStore = useManagedAgentStore()
  const router = useRouter()
  const { isLoggedIn } = storeToRefs(authStore)
  const baseUrl = resolveManagedAgentRuntimeUrl(import.meta.env.VITE_ADVJS_AI_RUNTIME_URL)
  const protocol = resolveManagedAgentProtocol(import.meta.env.VITE_ADVJS_AI_RUNTIME_PROTOCOL)
  const applicationId = protocol
    ? resolveManagedAgentApplicationId(import.meta.env.VITE_ADVJS_AI_RUNTIME_APPLICATION_ID, protocol)
    : undefined

  async function expireSession(): Promise<void> {
    authStore.clearSession()
    managedStore.disconnect()
    await router.replace({ path: '/login', query: { reason: 'session_expired' } })
  }

  watch(isLoggedIn, async (loggedIn) => {
    managedStore.disconnect()
    if (!loggedIn || !auth || !baseUrl || !protocol || (protocol === 'v2' && !applicationId))
      return

    const getAccessToken = createRuntimeAccessTokenGetter(auth, {
      onSessionExpired: () => void expireSession(),
    })
    const options = { baseUrl, getAccessToken, protocol, ...(applicationId ? { applicationId } : {}) }
    managedStore.configure({
      runtime: new ManagedAgentRuntime(options),
      points: new ManagedAgentPointsClient(options),
    })
    await managedStore.refreshPoints()
  }, { immediate: true })

  function recoverWhenOnline(): void {
    if (isLoggedIn.value)
      void managedStore.refreshPoints()
  }

  function recoverWhenVisible(): void {
    if (document.visibilityState === 'visible')
      recoverWhenOnline()
  }

  onMounted(() => {
    window.addEventListener('online', recoverWhenOnline)
    window.addEventListener('focus', recoverWhenOnline)
    document.addEventListener('visibilitychange', recoverWhenVisible)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('online', recoverWhenOnline)
    window.removeEventListener('focus', recoverWhenOnline)
    document.removeEventListener('visibilitychange', recoverWhenVisible)
    managedStore.disconnect()
  })
}
