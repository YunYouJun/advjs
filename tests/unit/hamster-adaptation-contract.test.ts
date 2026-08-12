import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'
import { parseCharacterMd } from '../../packages/parser/src/character'
import { validateSceneFrontmatter } from '../../packages/parser/src/scene'

interface SourceSection {
  id: string
  required: boolean
  chapters: string[]
}

interface SourceWork {
  id: string
  revision: string
  sha256: string
  order: number
  sections: SourceSection[]
}

interface CatalogEntry {
  id: string
  kind?: string
  scriptCard?: string
  firstSourceSection?: string
}

interface AdaptationManifest {
  schemaVersion: number
  adaptationMode: string
  sources: SourceWork[]
  characters: CatalogEntry[]
  scenes: Required<Pick<CatalogEntry, 'id' | 'scriptCard'>>[]
  assetPolicy: {
    publicBaseUrl: string
    objectPrefix: string
  }
}

const root = resolve(import.meta.dirname, '../..')

function loadManifest() {
  return JSON.parse(readFileSync(resolve(root, 'demo/hamster/adv/adaptation.json'), 'utf8')) as AdaptationManifest
}

describe('hamster complete adaptation contract', () => {
  it('locks both source works while keeping author metadata outside the 16 playable chapters', () => {
    const manifest = loadManifest()

    expect(manifest.schemaVersion).toBe(1)
    expect(manifest.adaptationMode).toBe('seamless-route')
    expect(manifest.sources.map(source => ({
      id: source.id,
      order: source.order,
      revision: source.revision,
      sha256: source.sha256,
      sections: source.sections.length,
    }))).toEqual([
      {
        id: 'hamster',
        order: 1,
        revision: '4a09ad4b730518144bd3d4b72fb584e83003c335',
        sha256: 'f18d252fe769f3afaed50e5aeae891a70d899757cf9802d33cda736c56c40c5f',
        sections: 6,
      },
      {
        id: 'the-common-hamster',
        order: 2,
        revision: '4a09ad4b730518144bd3d4b72fb584e83003c335',
        sha256: 'f60363782f9c22e72f63d4bbf481dd83eb1f9e7780460e8b63dee419ed900fc6',
        sections: 13,
      },
    ])

    const sections = manifest.sources.flatMap(source => source.sections.map(section => ({
      ...section,
      sourceId: source.id,
    })))
    const sourceKeys = sections.map(section => `${section.sourceId}/${section.id}`)
    const playableSections = sections.filter(section => section.required)
    const chapters = playableSections.flatMap(section => section.chapters)

    expect(sections).toHaveLength(19)
    expect(playableSections).toHaveLength(16)
    expect(sections.filter(section => !section.required).map(section => section.id)).toEqual([
      'postscript',
      'preface',
      'postscript',
    ])
    expect(new Set(sourceKeys).size).toBe(19)
    expect(chapters).toHaveLength(16)
    expect(new Set(chapters).size).toBe(16)
    expect(chapters.every(chapter => /^\d{2}-[a-z0-9-]+\.adv\.md$/u.test(chapter))).toBe(true)
  })

  it('maps every source section to exactly one ordered chapter anchor', () => {
    const manifest = loadManifest()
    const expected = manifest.sources.flatMap(source => source.sections
      .filter(section => section.required)
      .map(section => ({
        file: section.chapters[0],
        key: `${source.id}/${section.id}`,
      })))
    const chaptersDirectory = resolve(root, 'demo/hamster/public/md/chapters')
    const files = readdirSync(chaptersDirectory)
      .filter(file => file.endsWith('.adv.md'))
      .sort()

    expect(files).toEqual(expected.map(section => section.file))

    const anchors = files.flatMap((file) => {
      const content = readFileSync(resolve(chaptersDirectory, file), 'utf8')
      return [...content.matchAll(/<!--\s*source:([a-z0-9-]+\/[a-z0-9-]+)\s*-->/gu)]
        .map(match => match[1])
    })
    expect(anchors).toEqual(expected.map(section => section.key))
  })

  it('catalogs every visible or speaking source character with a card', () => {
    const manifest = loadManifest()
    const requiredCharacters = [
      'observer',
      'reader',
      'pet-hamster',
      'wang-an',
      'wang-an-father',
      'doctor',
      'wheelchair-girl',
      'ba',
      'deputy-chief',
      'fat-sentry',
      'thin-sentry',
      'hamster-child',
      'hamster-mayor',
      'explorer-king',
      'hamster-commander',
      'hamster-crowd',
    ]
    const characterIds = manifest.characters.map(character => character.id)
    const sourceKeys = new Set(manifest.sources.flatMap(source => source.sections.map(section => `${source.id}/${section.id}`)))

    expect(new Set(characterIds).size).toBe(characterIds.length)
    expect(characterIds).toEqual(expect.arrayContaining(requiredCharacters))

    for (const character of manifest.characters) {
      if (character.kind === 'mentioned')
        continue

      expect(character.scriptCard, character.id).toBeTruthy()
      const cardPath = resolve(root, 'demo/hamster', character.scriptCard!)
      expect(existsSync(cardPath), character.id).toBe(true)
      expect(parseCharacterMd(readFileSync(cardPath, 'utf8')).id).toBe(character.id)
      expect(sourceKeys.has(character.firstSourceSection!), character.id).toBe(true)
    }
  })

  it('catalogs reusable scenes and the immutable COS policy', () => {
    const manifest = loadManifest()
    const sceneIds = manifest.scenes.map(scene => scene.id)

    expect(new Set(sceneIds).size).toBe(sceneIds.length)
    expect(sceneIds).toEqual(expect.arrayContaining([
      'summer-room',
      'starfield-room',
      'simulated-orbit',
      'academy-terminal',
      'empty-earth',
      'hospital-room',
      'hospital-garden',
      'newborn-earth',
      'prehistoric-grassland',
      'hamster-village',
      'sunflower-city',
      'exploration-space',
      'solar-system-frontier',
      'real-workstation',
    ]))

    for (const scene of manifest.scenes) {
      const cardPath = resolve(root, 'demo/hamster', scene.scriptCard)
      expect(existsSync(cardPath), scene.id).toBe(true)
      expect(validateSceneFrontmatter(readFileSync(cardPath, 'utf8')), scene.id).toEqual({ success: true })
    }

    expect(manifest.assetPolicy).toEqual({
      publicBaseUrl: 'https://cos.advjs.yunle.fun/',
      objectPrefix: 'games/hamster/v1/',
    })
  })

  it('persists only cross-playthrough unlocks for the echo simulation', () => {
    const settings = JSON.parse(readFileSync(resolve(root, 'demo/hamster/adv/settings/game.json'), 'utf8'))

    expect(settings.variables).toMatchObject({
      canonicalCompleted: false,
      storyMode: 'main',
      unlockedEndings: [],
    })
    expect(settings.progression).toEqual({
      id: 'hamster',
      version: 1,
      keys: ['canonicalCompleted', 'unlockedEndings'],
    })
    expect(settings.progression.keys).not.toContain('storyMode')
  })

  it('keeps the playable route free of author notes and configures chapter presentation beats', () => {
    const chaptersDirectory = resolve(root, 'demo/hamster/public/md/chapters')
    const files = readdirSync(chaptersDirectory).filter(file => file.endsWith('.adv.md')).sort()
    const forbidden = ['前言', '后记', '比赛', '第一篇', '续作', '原作主线', '正史', 'A+']

    expect(files).toHaveLength(16)
    for (const file of files) {
      const source = readFileSync(resolve(chaptersDirectory, file), 'utf8')
      const visible = source.replace(/<!--.*?-->/gsu, '')
      expect(visible, file).toContain('type: bgm')
      expect(visible, file).toContain('transition:')
      for (const phrase of forbidden)
        expect(visible, `${file}: ${phrase}`).not.toContain(phrase)
    }

    const all = files.map(file => readFileSync(resolve(chaptersDirectory, file), 'utf8')).join('\n')
    expect([...all.matchAll(/^type: cg$/gmu)]).toHaveLength(8)
  })
})
