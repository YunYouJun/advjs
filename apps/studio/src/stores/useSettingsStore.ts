import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import i18n from '../i18n'
import { useAuthStore } from './useAuthStore'

export interface CosConfig {
  bucket: string
  region: string
  /** @deprecated Managed storage never persists browser COS credentials. */
  secretId: string
  /** @deprecated Managed storage never persists browser COS credentials. */
  secretKey: string
  projectRoot: string
  autoSave: boolean
  autoSync: boolean
  syncInterval: number
}

const MANAGED_BUCKET = 'yunlefun-advjs-prod-1325586649'
const MANAGED_REGION = 'ap-shanghai'

const DEFAULT_COS_CONFIG: CosConfig = {
  bucket: MANAGED_BUCKET,
  region: MANAGED_REGION,
  secretId: '',
  secretKey: '',
  projectRoot: 'adv-projects/',
  autoSave: true,
  autoSync: false,
  syncInterval: 5,
}

/** Compatibility reader that drops credentials and provider overrides from old releases. */
export function parsePersistedCosConfig(serialized: string): CosConfig {
  try {
    const parsed = JSON.parse(serialized) as Partial<CosConfig>
    return {
      ...DEFAULT_COS_CONFIG,
      projectRoot: typeof parsed.projectRoot === 'string' ? parsed.projectRoot : DEFAULT_COS_CONFIG.projectRoot,
      autoSave: typeof parsed.autoSave === 'boolean' ? parsed.autoSave : DEFAULT_COS_CONFIG.autoSave,
      autoSync: typeof parsed.autoSync === 'boolean' ? parsed.autoSync : DEFAULT_COS_CONFIG.autoSync,
      syncInterval: Number.isFinite(parsed.syncInterval) ? Number(parsed.syncInterval) : DEFAULT_COS_CONFIG.syncInterval,
    }
  }
  catch {
    return { ...DEFAULT_COS_CONFIG }
  }
}

/** Persist only non-sensitive managed-sync preferences. */
export function serializeCosConfig(config: CosConfig): string {
  return JSON.stringify({
    autoSave: config.autoSave,
    autoSync: config.autoSync,
    bucket: MANAGED_BUCKET,
    projectRoot: config.projectRoot,
    region: MANAGED_REGION,
    syncInterval: config.syncInterval,
  })
}

export interface AccountInfo {
  isLoggedIn: boolean
  username: string
  email: string
  avatar: string
}

export const useSettingsStore = defineStore('settings', () => {
  const theme = ref<'light' | 'dark' | 'system'>('system')
  const locale = ref<string>(i18n.global.locale.value || 'en')
  const cos = ref<CosConfig>({ ...DEFAULT_COS_CONFIG })

  /**
   * Account proxy — delegates to useAuthStore for backward compatibility.
   * Components using `settingsStore.account` will continue to work.
   */
  const account = computed<AccountInfo>(() => {
    const authStore = useAuthStore()
    return {
      isLoggedIn: authStore.isLoggedIn,
      username: authStore.displayName,
      email: (authStore.userInfo as any).email || '',
      avatar: (authStore.userInfo as any).picture || '',
    }
  })

  // Load from localStorage
  function loadFromStorage() {
    try {
      const savedTheme = localStorage.getItem('advjs-studio-theme')
      if (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system')
        theme.value = savedTheme

      const savedLocale = localStorage.getItem('advjs-studio-locale')
      if (savedLocale)
        locale.value = savedLocale

      const savedCos = localStorage.getItem('advjs-studio-cos')
      if (savedCos) {
        cos.value = parsePersistedCosConfig(savedCos)
        // Rewrite once so credentials and provider overrides from older versions are removed.
        localStorage.setItem('advjs-studio-cos', serializeCosConfig(cos.value))
      }
    }
    catch {
      // ignore
    }
  }

  function setDarkClass(isDark: boolean) {
    const el = document.documentElement
    el.classList.toggle('dark', isDark)
    el.classList.toggle('ion-palette-dark', isDark)
  }

  function applyTheme(value: 'light' | 'dark' | 'system') {
    if (value === 'dark') {
      setDarkClass(true)
    }
    else if (value === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      setDarkClass(prefersDark)
    }
    else {
      setDarkClass(false)
    }
  }

  /** @deprecated Use useAuthStore().logout() instead */
  function logout() {
    // No-op: handled by useAuthStore
  }

  // Watch and persist
  watch(theme, (val) => {
    localStorage.setItem('advjs-studio-theme', val)
    applyTheme(val)
  })

  watch(locale, (val) => {
    localStorage.setItem('advjs-studio-locale', val)
    ;(i18n.global.locale as any).value = val
  })

  watch(cos, (val) => {
    localStorage.setItem('advjs-studio-cos', serializeCosConfig(val))
  }, { deep: true })

  // Initialize
  loadFromStorage()
  applyTheme(theme.value)

  // Sync locale to i18n on load
  if (locale.value) {
    (i18n.global.locale as any).value = locale.value
  }

  const developerMode = ref(false)
  const chatWordWrap = ref(true)

  // Load developer mode
  try {
    const savedDev = localStorage.getItem('advjs-studio-developer')
    if (savedDev === 'true')
      developerMode.value = true

    const savedWrap = localStorage.getItem('advjs-studio-chat-wordwrap')
    if (savedWrap === 'false')
      chatWordWrap.value = false
  }
  catch {
    // ignore
  }

  watch(developerMode, (val) => {
    localStorage.setItem('advjs-studio-developer', String(val))
  })

  watch(chatWordWrap, (val) => {
    localStorage.setItem('advjs-studio-chat-wordwrap', String(val))
  })

  return {
    theme,
    locale,
    cos,
    account,
    developerMode,
    chatWordWrap,
    logout,
  }
})
