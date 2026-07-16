import { civilization, starMap } from '@advjs/plugin-interactions'
import { defineAdvConfig } from 'advjs'

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
    title: '仓鼠：星海回声',
    variables: {
      observationCount: 0,
      starMatched: false,
      starMatchScore: 0,
      civilizationLevel: 0,
    },
    requiredPlugins: {
      'star-map': '1.0.0',
      'civilization': '1.0.0',
    },
    chapters: [
      {
        id: 'chapter-1',
        title: '第一章：笼外星光',
        nodes: [
          {
            id: 'node-1',
            type: 'fountain',
            src: '/md/chapters/1/仓鼠的笼子.adv.md',
            order: 0,
            target: {
              chapterId: 'chapter-2',
              nodeId: 'node-2',
            },
          },
        ],
      },
      {
        id: 'chapter-2',
        title: '第二章：普通仓鼠的文明',
        nodes: [
          {
            id: 'node-2',
            type: 'fountain',
            src: '/md/chapters/2/仓生.adv.md',
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
