import type cloudbase from '@cloudbase/js-sdk'
import type { AuthenticatedCloudbaseSession, CloudbaseV3User } from '../auth/cloudbase-session'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { getCloudbaseResponseError, readAuthenticatedCloudbaseSession } from '../auth/cloudbase-session'

const LEGACY_LOGIN_STATE_KEY = 'advjs-studio:loginState'

/**
 * CloudBase session view for ADV.JS Studio.
 *
 * The SDK's persistent session is the storage source; this store only mirrors
 * a verified, non-anonymous getSession() result for reactive UI consumers.
 */
export const useAuthStore = defineStore('auth', () => {
  const session = ref<AuthenticatedCloudbaseSession>()
  const userInfo = ref<CloudbaseV3User>()
  const isRestoring = ref(true)
  const authError = ref<string>()

  const userId = computed(() => userInfo.value?.id)
  const isLoggedIn = computed(() => Boolean(session.value && userId.value))

  const displayName = computed(() => {
    return userInfo.value?.name
      || userInfo.value?.displayName
      || userInfo.value?.username
      || '匿名用户'
  })

  const maskedPhone = computed(() => {
    const source = userInfo.value
    if (!source)
      return ''
    const phone = typeof source.phone_number === 'string'
      ? source.phone_number
      : typeof source.phone === 'string' ? source.phone : ''
    if (phone.length < 7)
      return ''
    return `${phone.slice(0, 3)}****${phone.slice(-4)}`
  })

  function clearSession(): void {
    session.value = undefined
    userInfo.value = undefined
  }

  function setAuthError(message?: string): void {
    authError.value = message
  }

  async function restoreSession(auth: cloudbase.auth.App): Promise<boolean> {
    isRestoring.value = true
    authError.value = undefined
    try {
      const current = await readAuthenticatedCloudbaseSession(auth)
      if (!current) {
        clearSession()
        return false
      }
      session.value = current
      userInfo.value = current.user
      removeLegacyLoginStateMarker()
      return true
    }
    catch (error) {
      clearSession()
      authError.value = error instanceof Error ? error.message : 'Could not restore the CloudBase session.'
      return false
    }
    finally {
      isRestoring.value = false
    }
  }

  async function logout(auth: cloudbase.auth.App): Promise<void> {
    try {
      const response = await auth.signOut()
      const error = getCloudbaseResponseError(response)
      if (error)
        throw error
    }
    finally {
      clearSession()
      authError.value = undefined
      removeLegacyLoginStateMarker()
    }
  }

  return {
    session,
    userInfo,
    userId,
    isLoggedIn,
    isRestoring,
    authError,
    displayName,
    maskedPhone,
    clearSession,
    setAuthError,
    restoreSession,
    logout,
  }
})

function removeLegacyLoginStateMarker(): void {
  try {
    localStorage.removeItem(LEGACY_LOGIN_STATE_KEY)
  }
  catch {
    // The SDK session remains authoritative when storage is unavailable.
  }
}
