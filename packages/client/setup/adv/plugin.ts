import type { App } from 'vue'
import { injectionAdvContext, useContext } from './context'

import type { AdvOptions } from './types'

export type AdvVueInstance = ReturnType<typeof createAdvVuePlugin>

/**
 * 创建 ADV 实例
 * @param options
 */
export function createAdvVuePlugin(options?: Partial<AdvOptions>) {
  const defaultOptions = {
    debug: false,
  }

  options = {
    ...defaultOptions,
    ...options,
  }

  const $adv = useContext()

  return {
    install(app: App) {
      app.config.globalProperties.$adv = $adv
      app.provide(injectionAdvContext, $adv)

      if (__DEV__) {
        // @ts-expect-error expose global
        window.__adv__ = $adv
      }
    },

    options,
  }
}
