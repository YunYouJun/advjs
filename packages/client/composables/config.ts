import type { ThemeConfig } from '@advjs/types'
import type { ComputedRef } from 'vue'
import { advConfigSymbol, advDataSymbol, gameConfigSymbol, themeConfigSymbol } from '@advjs/core'
import { inject } from 'vue'

/** The selected theme supplies its concrete extension of the shared contract. */
export function useThemeConfig<T extends object = ThemeConfig>() {
  const config = inject(themeConfigSymbol)
  if (!config)
    throw new Error('[ADV.JS] theme config not properly injected in client.')
  return config as ComputedRef<T & ThemeConfig>
}

/**
 * get game config in client
 */
export function useGameConfig() {
  const config = inject(gameConfigSymbol)
  if (!config)
    throw new Error('[ADV.JS] game config not properly injected in client.')
  return config!
}

/**
 * adv.config.ts
 */
export function useAdvConfig() {
  const config = inject(advConfigSymbol)
  if (!config)
    throw new Error('[ADV.JS] adv config not properly injected in client.')
  return config!
}

/**
 * advData
 */
export function useAdvData() {
  const config = inject(advDataSymbol)
  if (!config)
    throw new Error('[ADV.JS] adv data not properly injected in client.')
  return config!
}
