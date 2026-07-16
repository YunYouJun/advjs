import { civilization, starMap } from '@advjs/plugin-interactions'
import { defineAdvConfig } from 'advjs'
import gameSettings from './adv/settings/game.json'

export default defineAdvConfig({
  theme: 'default',
  plugins: [
    starMap({ tolerance: 0.82 }),
    civilization({ defaultLevel: 1 }),
  ],
  features: {
    babylon: false,
  },
  gameConfig: {
    ...gameSettings,
    chapters: [
      {
        id: 'chapter-1',
        title: '第一章：笼外星光',
        nodes: [
          {
            id: 'cage',
            type: 'fountain',
            src: '/md/chapters/01-cage.adv.md',
            order: 0,
            target: {
              chapterId: 'chapter-2',
              nodeId: 'last-night',
            },
          },
        ],
      },
      {
        id: 'chapter-2',
        title: '第二章：普通仓鼠的文明',
        nodes: [
          {
            id: 'last-night',
            type: 'fountain',
            src: '/md/chapters/02-last-night.adv.md',
            order: 0,
            target: {
              chapterId: 'chapter-3',
              nodeId: 'common-life',
            },
          },
        ],
      },
      {
        id: 'chapter-3',
        title: '第三章：一只普通仓鼠的一生',
        nodes: [
          {
            id: 'common-life',
            type: 'fountain',
            src: '/md/chapters/03-common-life.adv.md',
            order: 0,
            target: {
              chapterId: 'chapter-4',
              nodeId: 'dim-stars',
            },
          },
        ],
      },
      {
        id: 'chapter-4',
        title: '第四章：群星黯淡以后',
        nodes: [
          {
            id: 'dim-stars',
            type: 'fountain',
            src: '/md/chapters/04-dim-stars.adv.md',
            order: 0,
          },
        ],
      },
    ],
    characters: [
      {
        id: 'observer',
        name: '观测者',
        avatar: '/img/characters/observer.svg',
        tachies: {
          default: {
            src: '/img/characters/observer.svg',
          },
        },
      },
      {
        id: 'reader',
        name: '读书人',
        avatar: '/img/characters/hamster.svg',
        tachies: {
          default: {
            src: '/img/characters/hamster.svg',
          },
        },
      },
    ],
  },
})
