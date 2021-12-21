import type { AdvConfig } from '@advjs/types'

export const defaultConfig: AdvConfig.ClientConfig = {
  aspectRatio: 16 / 9,
  canvasWidth: 980,
  // 开发模式下，可选中
  selectable: import.meta.env.DEV,
}

export default defaultConfig
