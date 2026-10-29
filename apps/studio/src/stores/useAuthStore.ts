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
  let generation = 0

  const userId = computed(() => userInfo.value?.id)
  const isLoggedIn = computed(() => Boolean(session.value && userId.value))

  const displayName = computed(() => {
    return userInfo.value?.user_metadata?.nickName
      || userInfo.value?.user_metadata?.name
      || userInfo.value?.user_metadata?.username
      || userInfo.value?.name
      || userInfo.value?.displayName
      || userInfo.value?.username
      || '匿名用户'
  })

  const avatarUrl = computed(() => userInfo.value?.user_metadata?.avatarUrl || userInfo.value?.picture || '')

  const maskedPhone = computed(() => {
    const source = userInfo.value
    if (!source)
      return ''
    const phone = typeof source.phone === 'string'
      ? source.phone
      : typeof source.phone_number === 'string' ? source.phone_number : ''
    if (phone.length < 7)
      return ''
    return `${phone.slice(0, 3)}****${phone.slice(-4)}`
  })

  function resetSession(): void {
    session.value = undefined
    userInfo.value = undefined
  }

  function clearSession(): void {
    generation += 1
    resetSession()
    isRestoring.value = false
  }

  function setAuthError(message?: string): void {
    authError.value = message
  }

  async function restoreSession(auth: cloudbase.auth.App): Promise<boolean> {
    const epoch = ++generation
    isRestoring.value = true
    authError.value = undefined
    try {
      const current = await readAuthenticatedCloudbaseSession(auth, { refreshUser: true })
      if (epoch !== generation)
        return false
      if (!current) {
        resetSession()
        return false
      }
      session.value = current
      userInfo.value = current.user
      removeLegacyLoginStateMarker()
      return true
    }
    catch (error) {
      if (epoch === generation) {
        resetSession()
        authError.value = error instanceof Error ? error.message : 'Could not restore the CloudBase session.'
      }
      return false
    }
    finally {
      if (epoch === generation)
        isRestoring.value = false
    }
  }

  async function logout(auth: cloudbase.auth.App): Promise<boolean> {
    const epoch = ++generation
    resetSession()
    isRestoring.value = false
    authError.value = undefined
    removeLegacyLoginStateMarker()
    try {
      const response = await auth.signOut()
      const error = getCloudbaseResponseError(response)
      // SIGNED_OUT may already have restored an empty SDK session. That is
      // still this logout's outcome; a replacement or pending login is not.
      if (epoch !== generation)
        return !error && !isLoggedIn.value && !isRestoring.value && !authError.value
      if (error)
        throw error
      return true
    }
    catch (error) {
      if (epoch === generation)
        throw error
      return false
    }
    finally {
      if (epoch === generation) {
        resetSession()
        authError.value = undefined
      }
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
    avatarUrl,
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
