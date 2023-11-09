import { computed } from 'vue'
import type { InjectionKey } from 'vue'

import { useAdvConfig } from '../../composables'
import type { AdvContext } from './types'
import { useAdvStore } from './store'
import { useLogic } from './logic'

export const injectionAdvContext: InjectionKey<AdvContext> = Symbol('advjs-context')

export function useContext(): AdvContext {
  const functions = {}
  const store = useAdvStore()

  const core = useLogic({ functions })
  const advConfig = useAdvConfig()

  return {
    onMounted() {},
    ...core,
    store,
    config: advConfig.value,
    themeConfig: computed(() => advConfig.value.themeConfig),
    functions,
  }
}
