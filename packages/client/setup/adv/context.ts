import { computed } from 'vue'
import type { InjectionKey } from 'vue'

// import { useAdvConfig } from '../../composables'
import advConfig from 'virtual:advjs/adv.config'
import type { AdvContext } from './types'
import { useAdvStore } from './store'
import { useLogic } from './logic'

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
