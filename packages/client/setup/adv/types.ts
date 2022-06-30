import type { AdvConfig } from '@advjs/types'
import type { ComputedRef } from 'vue'
import type { useCore } from './context'
import type { useNav } from './logic/nav'
import type { useAdvStore } from './store'

export interface AdvContext {
  core: ReturnType<typeof useCore>
  nav: ReturnType<typeof useNav>
  store: ReturnType<typeof useAdvStore>
  config: AdvConfig
  themeConfig: ComputedRef<AdvConfig['themeConfig']>
  functions: Record<string, () => void>
}

export interface AdvOptions {
  /**
   * 调试模式
   */
  debug?: boolean
}
