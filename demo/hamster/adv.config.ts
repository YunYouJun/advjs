import { civilization, starMap } from '@advjs/plugin-interactions'
import { defineAdvConfig } from 'advjs'
import gameSettings from './adv/settings/game.json'

const hamsterChapters = [
  { id: 'hamster-cage', title: '仓鼠的笼子', entry: 'mode-select', src: '/md/chapters/01-hamster-cage.adv.md' },
  { id: 'world-destruction', title: '关于世界毁灭的二三事', entry: 'starry-room', src: '/md/chapters/02-world-destruction.adv.md' },
  { id: 'starry-fantasy', title: '星空的狂想', entry: 'proof', src: '/md/chapters/03-starry-fantasy.adv.md' },
  { id: 'world-ending', title: '世界的终焉', entry: 'fourth-day', src: '/md/chapters/04-world-ending.adv.md' },
  { id: 'endless-symphony', title: '无尽的交响乐章', entry: 'academy-report', src: '/md/chapters/05-endless-symphony.adv.md' },
  { id: 'hamster-postscript', title: '《仓鼠》后记', entry: 'hamster-afterword', src: '/md/chapters/06-hamster-postscript.adv.md' },
  { id: 'common-hamster-preface', title: '《仓生》前言', entry: 'common-preface', src: '/md/chapters/07-common-hamster-preface.adv.md' },
  { id: 'daylight', title: '白昼之光，岂知夜色之深', entry: 'forty-second', src: '/md/chapters/08-daylight.adv.md' },
  { id: 'cocoon', title: '作茧自缚', entry: 'only-god', src: '/md/chapters/09-cocoon.adv.md' },
  { id: 'survival-or-destruction', title: '生存还是毁灭', entry: 'empty-world', src: '/md/chapters/10-survival-or-destruction.adv.md' },
  { id: 'duelist-romance', title: '决斗者的浪漫', entry: 'new-earth', src: '/md/chapters/11-duelist-romance.adv.md' },
  { id: 'lizard-king', title: '残暴的蜥蜴王', entry: 'rex', src: '/md/chapters/12-lizard-king.adv.md' },
  { id: 'third-kind', title: '第三类接触', entry: 'hamster-society', src: '/md/chapters/13-third-kind.adv.md' },
  { id: 'evolution', title: '仓鼠们今天也在努力进化着', entry: 'return-to-space', src: '/md/chapters/14-evolution.adv.md' },
  { id: 'stars-sea', title: '我们的征途是星辰大海', entry: 'after-seed-rain', src: '/md/chapters/15-stars-sea.adv.md' },
  { id: 'encounter', title: '相遇', entry: 'awakening', src: '/md/chapters/16-encounter.adv.md' },
  { id: 'they-are-gods', title: '它们才是神明', entry: 'forbidden', src: '/md/chapters/17-they-are-gods.adv.md' },
  { id: 'dim-stars', title: '黯淡的星空', entry: 'final-answer', src: '/md/chapters/18-dim-stars.adv.md' },
  { id: 'common-hamster-postscript', title: '《仓生》后记', entry: 'common-afterword', src: '/md/chapters/19-common-hamster-postscript.adv.md' },
] as const

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
    chapters: hamsterChapters.map((chapter, index) => {
      const next = hamsterChapters[index + 1]
      return {
        id: chapter.id,
        title: chapter.title,
        nodes: [
          {
            id: chapter.entry,
            type: 'fountain' as const,
            src: chapter.src,
            order: 0,
            ...(next
              ? {
                  target: {
                    chapterId: next.id,
                    nodeId: next.entry,
                  },
                }
              : {}),
          },
        ],
      }
    }),
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
