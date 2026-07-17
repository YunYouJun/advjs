import { existsSync, readFileSync } from 'node:fs'
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
  it('locks both source works, their order, and all 19 sections', () => {
    const manifest = loadManifest()

    expect(manifest.schemaVersion).toBe(1)
    expect(manifest.adaptationMode).toBe('canonical-plus')
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
    const chapters = sections.flatMap(section => section.chapters)

    expect(sections).toHaveLength(19)
    expect(sections.every(section => section.required)).toBe(true)
    expect(new Set(sourceKeys).size).toBe(19)
    expect(chapters).toHaveLength(19)
    expect(new Set(chapters).size).toBe(19)
    expect(chapters.every(chapter => /^\d{2}-[a-z0-9-]+\.adv\.md$/u.test(chapter))).toBe(true)
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
})
