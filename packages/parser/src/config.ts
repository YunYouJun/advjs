import type { AdvConfig, GameConfig } from '@advjs/types'

const defaultGameConfig: GameConfig = {
  pages: {
    start: {
      bg: 'https://fastly.jsdelivr.net/gh/YunYouJun/cdn/img/bg/stars-timing-0-blur-30px.jpg',
    },
  },
  showCharacterAvatar: false,
  cdn: {
    enable: false,
  },
  characters: [],
}

const defaultConfig: AdvConfig = {
  title: 'ADV.JS',
  favicon: '/favicon.svg',
  theme: 'default',
  themeConfig: {},
  aspectRatio: 16 / 9,
  canvasWidth: 980,
  // 开发模式下，可选中
  // import.meta.env.DEV
  selectable: false,
  game: defaultGameConfig,
}

export function resolveConfig(frontmatter: any) {
  const config: AdvConfig = {
    ...defaultConfig,

    ...frontmatter,
  }

  return config
}
