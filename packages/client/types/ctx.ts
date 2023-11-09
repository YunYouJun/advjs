import type { ComputedRef } from 'vue'

import type { AdvConfig } from '@advjs/types'
import type { AdvLogic, AdvStore } from '../setup'

export type AdvContext = {
  onMounted: () => void
  store: AdvStore
  config: AdvConfig
  themeConfig: ComputedRef<AdvConfig['themeConfig']>
  functions: Record<string, () => void>
} & AdvLogic

export interface AdvOptions {
  /**
   * 调试模式
   */
  debug?: boolean
}
