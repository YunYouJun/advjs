import { advConfigSymbol, advDataSymbol, gameConfigSymbol } from '@advjs/core'
import { inject } from 'vue'

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
