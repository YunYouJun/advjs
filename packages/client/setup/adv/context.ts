import { computed, inject } from 'vue'
import type { InjectionKey } from 'vue'

import type { AdvContext } from './types'
import { useAdvStore } from './store'
import { useLogic } from './logic'
import { config } from '~/env'

export const injectionAdvContext: InjectionKey<AdvContext> = Symbol('advjs-context')

export const useContext = (): AdvContext => {
  const functions = {}
  const store = useAdvStore()

  const core = useLogic({ functions })

  return {
    onMounted() {},
    ...core,
    store,
    config,
    themeConfig: computed(() => config.themeConfig),
    functions,
  }
}

export function useAdvCtx() {
  const ctx = inject(injectionAdvContext)
  if (!ctx)
    throw new Error('[ADV.JS] context not properly injected in app')
  return ctx!
}
