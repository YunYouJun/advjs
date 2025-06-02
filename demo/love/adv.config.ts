import { defineAdvConfig } from 'advjs'
import * as assets from './assets'

export default defineAdvConfig({
  theme: 'default',

  features: {
    babylon: false,
  },

  showCharacterAvatar: true,

  gameConfig: {
    title: 'Demo - Doki Doki Love',
    description: 'A demo for love story.',

    assets: {
      manifest: assets.assetsManifest,
    },

    chapters: [
      {
        id: 'chapter-1',
        title: '第一章 - 相遇',
        nodes: [
          {
            id: 'fountain-1',
            type: 'fountain',
            src: '/md/chapters/1/intro.adv.md',
          },
        ],
      },
    ],

    characters: [
      {
        id: 'xiao-yun',
        alias: '小云',
        name: '小云',
        actor: '小云',
        avatar: 'https://cos.advjs.yunle.fun/characters/xiaoyun/yun-good-alpha-compressed.png',
        tachies: {
          default: {
            src: 'https://cos.advjs.yunle.fun/characters/xiaoyun/yun-alpha-compressed.png',
            style: {
              transform: 'scale(1) translateY(25%)',
            },
          },
        },
      },
      {
        id: 'YunYouJun',
        alias: '云游君',
        name: '云游君',
        actor: '云游君',
        tachies: {
          default: {
            src: 'https://cos.advjs.yunle.fun/characters/he/characters-he.png',
            style: {
              transform: 'scale(1.4) translateY(-15%)',
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
  },
})
