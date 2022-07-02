import type { AdvConfig } from '@advjs/types'
import type { ComputedRef } from 'vue'
import type { useLogic } from './logic'
import type { useAdvStore } from './store'

export type AdvContext = {
  onMounted: () => void
  store: ReturnType<typeof useAdvStore>
  config: AdvConfig
  themeConfig: ComputedRef<AdvConfig['themeConfig']>
  functions: Record<string, () => void>
} & ReturnType<typeof useLogic>

export interface AdvOptions {
  /**
   * 调试模式
   */
  debug?: boolean
}
