import type { AdvConfig } from '@advjs/types'
import type { ComputedRef } from 'vue'
import type { useCore } from './context'
import type { useAdvStore } from './store'

export interface AdvContext {
  core: ReturnType<typeof useCore>
  nav: {
    next: () => void
  }
  store: ReturnType<typeof useAdvStore>
  config: AdvConfig['themeConfig']
  themeConfig: ComputedRef<AdvConfig['themeConfig']>
}

export interface AdvOptions {
  /**
   * 调试模式
   */
  debug?: boolean
}
