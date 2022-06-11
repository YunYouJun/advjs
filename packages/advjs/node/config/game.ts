import type { GameConfig } from '@advjs/types'

export const defaultGameConfig: GameConfig = {
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
