import type cloudbase from '@cloudbase/js-sdk'
import { useStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

/**
 * Auth Store — manages CloudBase login state for ADV.JS Studio.
 *
 * Shares the same CloudBase environment as yunle.fun (云乐坊).
 * Login is optional: all features work offline, login unlocks
 * cloud sync and publishing.
 */
export const useAuthStore = defineStore('auth', () => {
  /**
   * Persisted login state for quick UI checks.
   * CloudBase SDK also maintains its own token in localStorage.
   */
  const loginState = useStorage<cloudbase.auth.ILoginState | null>(
    'advjs-studio:loginState',
    null,
  )

  const userInfo = ref<cloudbase.auth.IUserInfo>({})

  const isLoggedIn = computed(() => {
    return loginState.value !== null && Object.keys(userInfo.value).length > 0
  })

  /**
   * Display name with fallback chain.
   */
  const displayName = computed(() => {
    return userInfo.value.name
      || userInfo.value.username
      || '匿名用户'
  })

  /**
   * Masked phone number for display (e.g. 138****1234).
   */
  const maskedPhone = computed(() => {
    const phone = (userInfo.value as Record<string, any>).phone as string | undefined
    if (!phone || phone.length < 7)
      return ''
    return `${phone.slice(0, 3)}****${phone.slice(-4)}`
  })

  /**
   * Set login state after successful sign-in.
   */
  function setLoginState(state: cloudbase.auth.ILoginState) {
    loginState.value = state
  }

  /**
   * Load user info from CloudBase auth instance.
   */
  async function loadUserInfo(auth: cloudbase.auth.App) {
    try {
      const user = await auth.getUserInfo?.()
      if (user)
        userInfo.value = user
    }
    catch {
      // ignore
    }
  }

  /**
   * Refresh login state from CloudBase SDK.
   * Call on app startup to restore session.
   */
  async function refreshLoginState(auth: cloudbase.auth.App) {
    try {
      let state: cloudbase.auth.ILoginState | null = null
      if (typeof auth.hasLoginState === 'function')
        state = auth.hasLoginState()
      else if (typeof auth.getLoginState === 'function')
        state = await auth.getLoginState()

      if (state) {
        loginState.value = state
        await loadUserInfo(auth)
      }
      else {
        loginState.value = null
        userInfo.value = {}
      }
    }
    catch {
      loginState.value = null
      userInfo.value = {}
    }
  }

  /**
   * Sign out and clear all auth state.
   */
  async function logout(auth: cloudbase.auth.App) {
    try {
      await auth.signOut?.()
    }
    catch {
      // ignore
    }
    loginState.value = null
    userInfo.value = {}
  }

  return {
    loginState,
    userInfo,
    isLoggedIn,
    displayName,
    maskedPhone,
    setLoginState,
    loadUserInfo,
    refreshLoginState,
    logout,
  }
})
