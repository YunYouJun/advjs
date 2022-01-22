import type { AdvConfig } from '@advjs/types'

export const defaultConfig: AdvConfig.ClientConfig = {
  aspectRatio: 16 / 9,
  canvasWidth: 980,
  // 开发模式下，可选中
  // import.meta.env.DEV
  selectable: false,
}

export default defaultConfig
