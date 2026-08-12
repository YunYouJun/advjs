import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { createAdvAssetCatalog } from '@advjs/core'
import { civilization, starMap } from '@advjs/plugin-interactions'
import { defineAdvConfig } from 'advjs'
import artManifest from './adv/assets.json'
import gameSettings from './adv/settings/game.json'

const productionProfile = artManifest.profiles.production
const requestedAssetBaseUrl = process.env.ADV_HAMSTER_ASSET_BASE_URL || productionProfile.baseUrl
const localReleaseRoot = fileURLToPath(new URL('../../temp/hamster-art/release-current/', import.meta.url))
const assetBaseUrl = requestedAssetBaseUrl === 'local'
  ? `/@fs/${localReleaseRoot}`
  : requestedAssetBaseUrl
const assetCatalog = createAdvAssetCatalog(artManifest)

function objectUrl(objectKey: string) {
  if (assetBaseUrl.startsWith('/'))
    return `${assetBaseUrl.replace(/\/$/, '')}/${objectKey}`

  return new URL(objectKey, assetBaseUrl).href
}

function assetUrl(id: string) {
  const asset = assetCatalog.get(id)
  if (!asset)
    throw new Error(`[hamster] Missing art manifest entry: ${id}`)

  return objectUrl(asset.objectKey)
}

const characterSpecs = [
  { id: 'observer', name: '观测者', aliases: ['我', '神小姐', '女神大人', '太阳女神'] },
  { id: 'reader', name: '读书人', aliases: ['他', '助手君', '助手先生'] },
  { id: 'pet-hamster', name: '小仓鼠', aliases: ['仓鼠', '宠物仓鼠', '最初的祖先'] },
  { id: 'ba', name: '巴', aliases: ['巴先生'] },
  { id: 'explorer-king', name: '探索王', aliases: [] },
  { id: 'hamster-commander', name: '仓鼠军官', aliases: ['舰队指挥官'] },
] as const

const characters = characterSpecs.map((character) => {
  const assets = assetCatalog.list({ kind: 'character' }).filter(asset => (
    asset.characterId === character.id
  ))
  const defaultAsset = assets.find(asset => asset.expression === 'default')
  if (!defaultAsset)
    throw new Error(`[hamster] Missing default tachie: ${character.id}`)

  return {
    ...character,
    avatar: assetUrl(defaultAsset.id),
    tachies: Object.fromEntries(assets.map((asset) => {
      const animation = assetCatalog.list({ kind: 'animation' }).find(item => (
        item.characterId === character.id
        && item.state === asset.expression
      ))
      return [
        asset.expression,
        animation
          ? {
              src: assetUrl(animation.id),
              sprite: {
                frameWidth: animation.frameWidth,
                frameHeight: animation.frameHeight,
                frames: animation.frames,
                fps: animation.fps,
                loop: animation.loop,
              },
            }
          : { src: assetUrl(asset.id) },
      ]
    })),
  }
})

const scenes = assetCatalog.list({ kind: 'background' })
  .map(asset => ({
    id: asset.id.replace('background/', ''),
    type: 'image' as const,
    src: assetUrl(asset.id),
  }))

const gallery = assetCatalog.list({ kind: 'cg' })
  .map(asset => ({
    id: asset.id.replace('cg/', ''),
    title: asset.title,
    src: assetUrl(asset.id),
    thumbnail: asset.variants?.thumbnail?.objectKey
      ? objectUrl(asset.variants.thumbnail.objectKey)
      : assetUrl(asset.id),
    alt: asset.alt,
    chapterId: asset.chapterId,
  }))

const bgmLibrary = Object.fromEntries(assetCatalog.list({ kind: 'bgm' })
  .map(asset => [
    asset.id.replace('bgm/', ''),
    {
      name: asset.title,
      src: assetUrl(asset.id),
      duration: asset.duration,
    },
  ]))

const hamsterChapters = [
  { id: 'hamster-cage', title: '仓鼠的笼子', entry: 'summer-afternoon', src: '/md/chapters/01-hamster-cage.adv.md' },
  { id: 'world-destruction', title: '关于世界毁灭的二三事', entry: 'starry-room', src: '/md/chapters/02-world-destruction.adv.md' },
  { id: 'starry-fantasy', title: '星空的狂想', entry: 'proof', src: '/md/chapters/03-starry-fantasy.adv.md' },
  { id: 'world-ending', title: '世界的终焉', entry: 'fourth-day', src: '/md/chapters/04-world-ending.adv.md' },
  { id: 'endless-symphony', title: '无尽的交响乐章', entry: 'academy-report', src: '/md/chapters/05-endless-symphony.adv.md' },
  { id: 'daylight', title: '白昼之光，岂知夜色之深', entry: 'forty-second', src: '/md/chapters/06-daylight.adv.md' },
  { id: 'cocoon', title: '作茧自缚', entry: 'only-god', src: '/md/chapters/07-cocoon.adv.md' },
  { id: 'survival-or-destruction', title: '生存还是毁灭', entry: 'empty-world', src: '/md/chapters/08-survival-or-destruction.adv.md' },
  { id: 'duelist-romance', title: '决斗者的浪漫', entry: 'new-earth', src: '/md/chapters/09-duelist-romance.adv.md' },
  { id: 'lizard-king', title: '残暴的蜥蜴王', entry: 'rex', src: '/md/chapters/10-lizard-king.adv.md' },
  { id: 'third-kind', title: '第三类接触', entry: 'hamster-society', src: '/md/chapters/11-third-kind.adv.md' },
  { id: 'evolution', title: '仓鼠们今天也在努力进化着', entry: 'return-to-space', src: '/md/chapters/12-evolution.adv.md' },
  { id: 'stars-sea', title: '我们的征途是星辰大海', entry: 'after-seed-rain', src: '/md/chapters/13-stars-sea.adv.md' },
  { id: 'encounter', title: '相遇', entry: 'awakening', src: '/md/chapters/14-encounter.adv.md' },
  { id: 'they-are-gods', title: '它们才是神明', entry: 'forbidden', src: '/md/chapters/15-they-are-gods.adv.md' },
  { id: 'dim-stars', title: '黯淡的星空', entry: 'final-answer', src: '/md/chapters/16-dim-stars.adv.md' },
] as const

export default defineAdvConfig({
  theme: 'default',
  viewportFit: 'responsive',
  pages: {
    start: {
      bg: assetUrl('background/starfield-room'),
    },
  },
  plugins: [
    starMap({ tolerance: 0.82 }),
    civilization({ defaultLevel: 1 }),
  ],
  features: {
    babylon: false,
  },
  gameConfig: {
    ...gameSettings,
    cover: assetUrl('background/starfield-room'),
    gallery: {
      id: 'hamster',
      version: 1,
      allowDownload: true,
      items: gallery,
    },
    bgm: {
      autoplay: false,
      library: bgmLibrary,
    },
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
    characters,
    scenes,
  },
})
