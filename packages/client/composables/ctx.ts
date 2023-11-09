import { inject } from 'vue'
import { advContextSymbol } from '../constants'

export function useAdvCtx() {
  const ctx = inject(advContextSymbol)
  if (!ctx)
    throw new Error('[ADV.JS] context not properly injected in app')
  return ctx.value!
}
