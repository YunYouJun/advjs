import type { AdvConfig } from '@advjs/types'
// @ts-expect-error missing types
import _configs from '/@advjs/configs'

export const configs = _configs as AdvConfig
export interface AdvContext {
  nav: {
    next: () => void
  }
  config: typeof configs
  themeConfig: typeof configs['themeConfig']
}

export interface AdvOptions {
  /**
   * 调试模式
   */
  debug?: boolean
}
