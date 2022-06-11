import type { ClientConfig } from '@advjs/types'

export * from './game'

export const defaultConfig: ClientConfig = {
  aspectRatio: 16 / 9,
  canvasWidth: 980,
  // 开发模式下，可选中
  // import.meta.env.DEV
  selectable: false,
}

export default defaultConfig
