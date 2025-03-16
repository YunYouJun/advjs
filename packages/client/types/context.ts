import type { AdvConfig } from '@advjs/types'

import type { ComputedRef } from 'vue'
// import type { AdvLogic } from '../composables'
import type { AdvStore } from '../stores'

export interface AdvContext {
  store: AdvStore
  config: AdvConfig
  themeConfig: ComputedRef<AdvConfig['themeConfig']>
  functions: Record<string, () => void>
  nav: any
}

export interface AdvOptions {
  /**
   * 调试模式
   */
  debug?: boolean
}
