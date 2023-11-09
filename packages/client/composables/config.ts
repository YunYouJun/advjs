import { inject } from 'vue'
import { advConfigSymbol, appConfigSymbol } from '../constants'

/**
 * get app config in client
 */
export function useAppConfig() {
  const config = inject(appConfigSymbol)
  if (!config)
    throw new Error('[ADV.JS] app config not properly injected in client.')
  return config!
}

export function useAdvConfig() {
  const config = inject(advConfigSymbol)
  if (!config)
    throw new Error('[ADV.JS] adv config not properly injected in client.')
  return config!
}
