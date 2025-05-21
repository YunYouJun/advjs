import { acceptHMRUpdate, defineStore } from 'pinia'

export const useUserStore = defineStore('user', () => {
  const { loggedIn, user, session, clear, openInPopup } = useUserSession()

  /**
   * login with github in popup
   */
  function loginWithGitHub() {
    openInPopup('/api/auth/github')
  }

  function signOut() {
    clear()
  }

  return {
    loggedIn,
    user,
    session,

    signOut,

    loginWithGitHub,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useUserStore, import.meta.hot))
