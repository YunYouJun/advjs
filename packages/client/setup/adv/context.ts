import type { InjectionKey } from 'vue'
import type { AdvContext } from './types'

// import { useAdvConfig } from '../../composables'
import advConfig from 'virtual:advjs/adv.config'
import { computed } from 'vue'
import { useLogic } from './logic'
import { useAdvStore } from './store'

export const injectionAdvContext: InjectionKey<AdvContext> = Symbol('advjs-context')

export function useContext(): AdvContext {
  const functions = {}
  const store = useAdvStore()

  const core = useLogic({ functions })

  return {
    onMounted() {},
    ...core,
    store,
    config: advConfig,
    themeConfig: computed(() => advConfig.themeConfig),
    functions,
  }
}
