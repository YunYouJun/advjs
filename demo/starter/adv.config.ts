import { defineAdvConfig } from 'advjs'
// import * as assets from './assets'

export default defineAdvConfig({
  theme: 'default',

  features: {
    babylon: false,
  },

  // assets,

  gameConfig: {
    title: 'ADVJS Starter',
    chapters: [
      {
        id: 'chapter-1',
        title: '第一章',
        nodes: [
          {
            id: 'node-1',
            type: 'fountain',
            src: '/md/chapters/1/仓鼠的笼子.adv.md',
            order: 0,
          },
        ],
      },
    ],

    characters: [
      {
        id: 'he',
        name: '他',
        avatar: '/img/characters/he.png',
      },
      {
        id: 'i',
        name: '我',
        avatar: '/img/characters/she.png',
      },
    ],
  },
})
