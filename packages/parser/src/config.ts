import type { AdvConfig } from '@advjs/types'

const defaultConfig: AdvConfig = {
  features: {
    babylon: false,
  },
  title: 'ADV.JS',
  favicon: '/favicon.svg',
  theme: 'default',
  themeConfig: {},
  aspectRatio: 16 / 9,
  canvasWidth: 980,
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
}

export function resolveConfig(frontmatter: any) {
  const config: AdvConfig = {
    ...defaultConfig,

    ...frontmatter,
  }

  return config
}
