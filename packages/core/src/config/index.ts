import type { AdvConfig, AdvGameConfig } from '@advjs/types'
import { LogLevels } from 'consola'

export const defaultAdvConfig: AdvConfig = {
  logLevel: LogLevels.info,
  format: 'fountain',
  features: {
    babylon: false,
  },

  gameConfig: {},
  theme: 'default',
  themeConfig: {},

  aspectRatio: 16 / 9,
  canvasWidth: 1920, // 1920*1080
  // canvasWidth: 2560, // 2560*1440
  // 开发模式下，可选中
  // import.meta.env.DEV
  selectable: false,
  cdn: {
    enable: false,
  },

  preload: {
    type: 'chapter',
    background: true,
  },

  pages: {
    start: {
      bg: 'https://cos.yunle.fun/images/bg/stars-timing-0-blur-30px.jpg',
    },
  },
  showCharacterAvatar: false,

  runtimeConfig: {
    canvasHeight: 0,
  },
}

export const defaultGameConfig: AdvGameConfig = {
  title: 'ADV.JS',
  description: '面向未来与前端的 ADV 文字冒险游戏引擎',
  favicon: '/favicon.svg',
  // game
  characters: [],
  bgm: {
    autoplay: false,
    collection: [],
    library: 'https://cos.advjs.yunle.fun/bgms/bgm-library.json',
  },
  assets: {
    manifest: {
      bundles: [],
    },
  },
  chapters: [],
  scenes: [],
}
