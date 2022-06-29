import type { AdvConfig } from '@advjs/types'
import type { useCore } from './context'
import type { useAdvStore } from './store'
// @ts-expect-error missing types
import _configs from '/@advjs/configs'

export const configs = _configs as AdvConfig
export interface AdvContext {
  core: ReturnType<typeof useCore>
  nav: {
    next: () => void
  }
  store: ReturnType<typeof useAdvStore>
  config: typeof configs
  themeConfig: typeof configs['themeConfig']
}

export interface AdvOptions {
  /**
   * 调试模式
   */
  debug?: boolean
}
