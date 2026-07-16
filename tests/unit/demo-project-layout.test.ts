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

describe('demo project layout', () => {
  it('keeps starter minimal and hamster independently runnable', async () => {
    expect(existsSync(resolve(root, 'demo/hamster/package.json'))).toBe(true)

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
})
