import { defineAdvConfig } from 'advjs'
import * as assets from './assets'

export default defineAdvConfig({
  title: 'Demo - Doki Doki Love',
  description: 'A demo for love story.',
  theme: 'default',

  features: {
    babylon: false,
  },

  assets: {
    manifest: assets.assetsManifest,
  },

  characters: [
    {
      id: 'xiao-yun',
      name: '小云',
      actor: '小云',
      avatar: 'yun-good-alpha',
      tachies: {
        default: {
          src: 'yun-alpha',
          style: {
            transform: 'scale(1) translateY(5%)',
          },
        },
      },
    },
    {
      id: 'YunYouJun',
      name: '云游君',
      actor: '云游君',
      tachies: {
        default: {
          src: 'https://cos.advjs.yunle.fun/characters/he/characters-he.png',
          style: {
            transform: 'scale(0.7) translateY(-20%)',
          },
        },
      },
    },
  ],

  bgm: {
    autoplay: true,
    collection: [
      {
        name: 'xxx',
        src: 'https://cdn.yunyoujun.cn/audio/star-timer.mp3',
      },
    ],
  },
})
