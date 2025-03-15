// import { assets } from '@advjs/theme-default'
// import type { AdvConfig } from '@advjs/types'
import type { AssetsManifest } from 'pixi.js'

// export const audios: AdvConfig['assets']['audios'] = {
//   ...assets.audios,
// }

// export const images: AdvConfig['assets']['images'] = {
// ...assets.images,

export const assetsManifest: AssetsManifest = {
  bundles: [
    {
      name: 'load-screen',
      assets: [],
    },
    {
      name: 'game-screen',
      assets: [
        // bg
        {
          alias: 'bbbrustLove',
          src: '/img/bg/bbburst-love.svg',
        },
        {
          alias: 'stacked-steps-haikei',
          src: '/img/bg/stacked-steps-haikei.svg',
        },
        // characters
        {
          alias: 'yun-good-alpha',
          src: '/img/characters/yun-good-alpha-compressed.webp',
        },
        {
          alias: 'yun-alpha',
          src: '/img/characters/yun-alpha-compressed.webp',
        },
      ],
    },
  ],
}
