import type { ComputedRef, InjectionKey, MaybeRefOrGetter } from 'vue'
import { useMutationObserver } from '@vueuse/core'
import { computed, inject, onMounted, provide, shallowRef, toValue } from 'vue'

type ColorScheme = 'light' | 'dark'
interface GameColorMode {
  colorScheme: ComputedRef<ColorScheme | undefined>
  isDark: ComputedRef<boolean>
  toggle: () => void
  reset: () => void
}

const gameColorModeKey: InjectionKey<GameColorMode> = Symbol('adv-game-color-mode')
/** Standalone games may opt into persistence; embedded games default to memory. */
export const gameColorModeStorageKey: InjectionKey<string> = Symbol('adv-game-color-mode-storage')

export function provideGameColorMode(initial: MaybeRefOrGetter<ColorScheme | undefined>, storageKey?: string | false) {
  const key = storageKey === false ? undefined : storageKey ?? inject(gameColorModeStorageKey, undefined)
  const preference = shallowRef<ColorScheme>()
  const host = shallowRef<ColorScheme>('light')
  const hostElement = shallowRef<HTMLElement>()
  function readHost() {
    host.value = hostElement.value?.classList.contains('dark') ? 'dark' : 'light'
  }
  useMutationObserver(hostElement, readHost, { attributes: true, attributeFilter: ['class'] })
  onMounted(() => {
    hostElement.value = document.documentElement
    readHost()
    if (key) {
      try {
        const saved = localStorage.getItem(key)
        if (saved === 'light' || saved === 'dark')
          preference.value = saved
      }
      catch { /* Storage may be unavailable in private/embedded documents. */ }
    }
  })
  const colorScheme = computed(() => preference.value ?? toValue(initial))
  const isDark = computed(() => (colorScheme.value ?? host.value) === 'dark')
  function setPreference(value?: ColorScheme) {
    preference.value = value
    if (key) {
      try {
        if (value)
          localStorage.setItem(key, value)
        else
          localStorage.removeItem(key)
      }
      catch { /* The in-memory choice still works when persistence is blocked. */ }
    }
  }
  const mode: GameColorMode = {
    colorScheme,
    isDark,
    toggle: () => setPreference(isDark.value ? 'light' : 'dark'),
    reset: () => setPreference(),
  }
  provide(gameColorModeKey, mode)
  return mode
}

export function useGameColorMode() {
  const mode = inject(gameColorModeKey)
  if (!mode)
    throw new Error('[ADV.JS] Game color mode requires AdvContainer or AdvThemeScope.')
  return mode
}
