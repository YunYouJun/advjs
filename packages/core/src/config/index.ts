import type { AdvConfig } from '@advjs/types'

export const defaultConfig: AdvConfig = {
  features: {
    babylon: false,
  },
  title: 'ADV.JS',
  description: '面向未来与前端的 ADV 文字冒险游戏引擎',
  favicon: '/favicon.svg',
  theme: 'default',
  themeConfig: {},
  aspectRatio: 16 / 9,
  // canvasWidth: 1920, // 1920*1080
  canvasWidth: 2560, // 2560*1440
  // 开发模式下，可选中
  // import.meta.env.DEV
  selectable: false,
  // game
  pages: {
    start: {
      bg: 'https://cdn.yunyoujun.cn/img/bg/stars-timing-0-blur-30px.jpg',
    },
  },
  showCharacterAvatar: false,
  cdn: {
    enable: false,
  },
  characters: [],
  bgm: {
    autoplay: false,
    collection: [],
  },
  assets: {
    manifest: {
      bundles: [],
    },
  },
}
