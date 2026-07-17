import { existsSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '../..')

async function json(path: string) {
  return JSON.parse(await readFile(resolve(root, path), 'utf8')) as Record<string, any>
}

async function source(path: string) {
  return readFile(resolve(root, path), 'utf8')
}

async function advScripts(path: string) {
  const entries = await readdir(resolve(root, path), { recursive: true })
  return entries.filter(entry => entry.endsWith('.adv.md')).sort()
}

function frontmatterId(content: string) {
  return content.split('\n').find(line => line.startsWith('id:'))?.slice(3).trim()
}

describe('demo project layout', () => {
  it('keeps starter minimal and hamster independently runnable', async () => {
    expect(existsSync(resolve(root, 'demo/hamster/package.json'))).toBe(true)

    for (const demo of ['starter', 'hamster']) {
      for (const file of ['README.md', 'adv.config.ts', 'package.json'])
        expect(existsSync(resolve(root, `demo/${demo}/${file}`)), `${demo}/${file}`).toBe(true)
    }

    const rootPackage = await json('package.json')
    const starterPackage = await json('demo/starter/package.json')
    const hamsterPackage = await json('demo/hamster/package.json')
    const starterConfig = await source('demo/starter/adv.config.ts')
    const hamsterConfig = await source('demo/hamster/adv.config.ts')

    expect(rootPackage.scripts.demo).toBe('pnpm -C demo/starter run dev')
    expect(rootPackage.scripts['demo:hamster']).toBe('pnpm -C demo/hamster run dev')
    expect(starterPackage.name).toBe('@advjs/demo-starter')
    expect(hamsterPackage.name).toBe('@advjs/demo-hamster')
    expect(starterConfig).not.toMatch(/plugin-interactions|仓鼠|star-map|civilization/u)
    expect(hamsterConfig).toMatch(/starMap|civilization/u)
    expect(await advScripts('demo/starter/public/md')).toHaveLength(1)
    expect((await advScripts('demo/hamster/public/md')).length).toBeGreaterThanOrEqual(2)
  })

  it('keeps hamster runtime config and Studio authoring metadata aligned', async () => {
    const settings = await json('demo/hamster/adv/settings/game.json')
    const config = await source('demo/hamster/adv.config.ts')

    expect(settings).toEqual({
      title: '仓鼠：星海回声',
      description: '完整改编自《仓鼠》与续作《仓生》的 ADV.JS 旗舰示例',
      variables: {
        canonicalCompleted: false,
        storyMode: 'canonical',
        unlockedEndings: [],
        curiosity: 0,
        empathy: 0,
        control: 0,
        observationCount: 0,
        starMatched: false,
        starMatchScore: 0,
        civilizationLevel: 0,
        civilization: null,
        memories: [],
        ending: '',
      },
      progression: {
        id: 'hamster',
        version: 1,
        keys: ['canonicalCompleted', 'unlockedEndings'],
      },
      requiredPlugins: {
        'star-map': '1.0.0',
        'civilization': '1.0.0',
      },
    })
    expect(config).toContain('import gameSettings from \'./adv/settings/game.json\'')
    expect(config).toContain('...gameSettings')
    for (const chapterSource of [
      '01-hamster-cage.adv.md',
      '02-world-destruction.adv.md',
      '03-starry-fantasy.adv.md',
      '04-world-ending.adv.md',
      '05-endless-symphony.adv.md',
      '06-hamster-postscript.adv.md',
      '07-common-hamster-preface.adv.md',
      '08-daylight.adv.md',
      '09-cocoon.adv.md',
      '10-survival-or-destruction.adv.md',
      '11-duelist-romance.adv.md',
      '12-lizard-king.adv.md',
      '13-third-kind.adv.md',
      '14-evolution.adv.md',
      '15-stars-sea.adv.md',
      '16-encounter.adv.md',
      '17-they-are-gods.adv.md',
      '18-dim-stars.adv.md',
      '19-common-hamster-postscript.adv.md',
    ].map(file => `/md/chapters/${file}`)) {
      expect(config).toContain(`src: '${chapterSource}'`)
    }

    const characterIds = await Promise.all(
      ['observer.character.md', 'reader.character.md']
        .map(async file => frontmatterId(await source(`demo/hamster/adv/characters/${file}`))),
    )
    const sceneIds = await Promise.all(
      ['observatory.md', 'cage.md', 'new-world.md']
        .map(async file => frontmatterId(await source(`demo/hamster/adv/scenes/${file}`))),
    )

    expect(characterIds).toEqual(['observer', 'reader'])
    for (const id of characterIds)
      expect(config).toContain(`id: '${id}'`)
    expect(new Set([...characterIds, ...sceneIds]).size).toBe(5)
  })

  it('contains no unverified legacy demo assets', () => {
    for (const demo of ['starter', 'hamster']) {
      for (const path of [
        'public/icons/pwa-192x192.png',
        'public/icons/pwa-512x512.png',
        'public/img/icons/favicon-32x32.png',
        'public/img/bg/night.jpg',
        'public/img/characters/he',
        'public/img/characters/she',
      ]) {
        expect(existsSync(resolve(root, `demo/${demo}/${path}`)), `${demo}/${path}`).toBe(false)
      }
    }
  })

  it('ships local, documented, and reproducible hamster assets', async () => {
    const demoRoot = resolve(root, 'demo/hamster')
    const contentFiles = ['adv.config.ts', 'ASSETS.md', 'LICENSE.content.md']
    for (const directory of ['adv', 'public/md']) {
      const files = await readdir(resolve(demoRoot, directory), { recursive: true })
      contentFiles.push(...files
        .filter(file => /\.(?:json|md)$/u.test(file))
        .map(file => `${directory}/${file}`))
    }
    const contents = await Promise.all(
      contentFiles.map(file => readFile(resolve(demoRoot, file), 'utf8')),
    )
    const referencedAssets = new Set(
      contents.flatMap(content => [...content.matchAll(/\/(?:audio|img)\/[^\s'"`)]+/gu)]
        .map(match => match[0])
        .filter(asset => !asset.includes('*'))),
    )

    expect([...referencedAssets].sort()).toEqual([
      '/audio/observatory.wav',
      '/img/bg/cage.svg',
      '/img/bg/civilization.svg',
      '/img/bg/observatory.svg',
      '/img/characters/hamster.svg',
      '/img/characters/observer.svg',
    ])
    for (const asset of referencedAssets)
      expect(existsSync(resolve(demoRoot, `public${asset}`)), asset).toBe(true)

    for (const asset of [...referencedAssets].filter(asset => asset.endsWith('.svg')))
      expect(await readFile(resolve(demoRoot, `public${asset}`), 'utf8'), asset).toMatch(/<title(?:\s|>)/u)

    const wav = await readFile(resolve(demoRoot, 'public/audio/observatory.wav'))
    expect(wav.toString('ascii', 0, 4)).toBe('RIFF')
    expect(wav.toString('ascii', 8, 12)).toBe('WAVE')
    expect(wav.readUInt16LE(22)).toBe(1)
    expect(wav.readUInt32LE(24)).toBe(22_050)
    expect(wav.readUInt16LE(34)).toBe(16)

    const assets = await source('demo/hamster/ASSETS.md')
    expect(assets).toContain('scripts/generate-ambient.mjs')
    expect(assets).toContain('https://www.yunyoujun.cn/posts/hamster')
    expect(assets).toContain('https://www.yunyoujun.cn/posts/the-common-hamster')
  })
})
