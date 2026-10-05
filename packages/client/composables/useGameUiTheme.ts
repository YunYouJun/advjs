import type { ThemeConfig } from '@advjs/types'
import type { CSSProperties, MaybeRefOrGetter } from 'vue'
import { themeConfigSymbol } from '@advjs/core'
import { gameUiTokenNames } from '@advjs/types'
import { computed, inject, toValue } from 'vue'

const tokens = new Set<string>(gameUiTokenNames)

/** Derive local styles; no document mutations, global theme state or watchers. */
export function useGameUiTheme(theme?: MaybeRefOrGetter<ThemeConfig | undefined>) {
  const injected = inject(themeConfigSymbol, undefined)
  const ui = computed(() => (toValue(theme) ?? injected?.value)?.ui)
  const colorScheme = computed(() => {
    const value = ui.value?.colorScheme
    return value === 'light' || value === 'dark' ? value : undefined
  })
  const style = computed<CSSProperties>(() => {
    const values: CSSProperties = {}
    for (const [name, value] of Object.entries(ui.value?.tokens ?? {})) {
      if ((tokens.has(name) || /^--adv-theme-[\w-]+$/.test(name)) && typeof value === 'string')
        values[name as `--${string}`] = value
    }
    return values
  })
  return { colorScheme, style }
}
