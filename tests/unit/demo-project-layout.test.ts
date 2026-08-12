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

    expect(settings).toMatchObject({
      title: '仓鼠：星海回声',
      description: '一条从盛夏午后驶向黯淡群星的 ADV.JS 旗舰示例',
      variables: {
        canonicalCompleted: false,
        storyMode: 'main',
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
    expect(settings.gallery).toMatchObject({
      id: 'hamster',
      version: 1,
      allowDownload: true,
    })
    expect(settings.gallery.items).toHaveLength(8)
    expect(settings.gallery.items.map((item: Record<string, any>) => item.id)).toEqual([
      'star-in-hand',
      'old-world-collapse',
      'newborn-earth',
      'tyrannosaurus-encounter',
      'fingertip-sunflower',
      'explorer-awakening',
      'stars-volley',
      'reality-workstation',
    ])
    expect(config).toContain('import gameSettings from \'./adv/settings/game.json\'')
    expect(config).toContain('...gameSettings')
    for (const chapterSource of [
      '01-hamster-cage.adv.md',
      '02-world-destruction.adv.md',
      '03-starry-fantasy.adv.md',
      '04-world-ending.adv.md',
      '05-endless-symphony.adv.md',
      '06-daylight.adv.md',
      '07-cocoon.adv.md',
      '08-survival-or-destruction.adv.md',
      '09-duelist-romance.adv.md',
      '10-lizard-king.adv.md',
      '11-third-kind.adv.md',
      '12-evolution.adv.md',
      '13-stars-sea.adv.md',
      '14-encounter.adv.md',
      '15-they-are-gods.adv.md',
      '16-dim-stars.adv.md',
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

  it('ships documented and reproducible COS-backed hamster assets', async () => {
    const demoRoot = resolve(root, 'demo/hamster')
    const manifest = JSON.parse(await source('demo/hamster/adv/assets.json')) as {
      schemaVersion: number
      profiles: { production: { provider: string, baseUrl: string } }
      release: { provider: string, objectPrefix: string }
      assets: Array<{ id: string, objectKey: string, url?: string }>
    }

    expect(manifest.schemaVersion).toBe(2)
    expect(manifest.profiles.production).toEqual({
      provider: 'http',
      baseUrl: 'https://cos.advjs.yunle.fun/',
    })
    expect(manifest.release).toEqual({
      provider: 'tencent-cos',
      objectPrefix: 'games/hamster/v1/',
    })
    expect(manifest.assets).toHaveLength(60)
    for (const asset of manifest.assets) {
      expect(asset.objectKey).toMatch(/^games\/hamster\/v1\//u)
      expect(asset.url).toBeUndefined()
    }

    expect(existsSync(resolve(demoRoot, 'public/audio'))).toBe(false)
    expect(existsSync(resolve(demoRoot, 'public/img'))).toBe(false)

    const packageJson = JSON.parse(await source('demo/hamster/package.json')) as {
      scripts: Record<string, string>
    }
    expect(packageJson.scripts.dev).not.toContain('ADV_HAMSTER_ASSET_BASE_URL=local')
    expect(packageJson.scripts['dev:local-assets']).toContain('ADV_HAMSTER_ASSET_BASE_URL=local')

    const generator = await source('demo/hamster/scripts/generate-bgm.mjs')
    expect(generator).toContain('temp/hamster-art/audio/bgm')
    expect(generator).not.toContain('public/audio')

    const assets = await source('demo/hamster/ASSETS.md')
    expect(assets).toContain('scripts/generate-bgm.mjs')
    expect(assets).toContain('scripts/prepare-media.mjs')
    expect(assets).toContain('https://www.yunyoujun.cn/posts/hamster')
    expect(assets).toContain('https://www.yunyoujun.cn/posts/the-common-hamster')
  })
})
