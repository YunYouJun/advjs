// @vitest-environment node
import type { ResolvedAdvOptions } from '@advjs/types'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { templateGames } from '../../../packages/advjs/node/virtual/game'

const roots: string[] = []
afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function fixture() {
  const gameRoot = await mkdtemp(join(tmpdir(), 'adv-character-projection-'))
  roots.push(gameRoot)
  await mkdir(join(gameRoot, 'characters'))
  const options = { gameRoot } as ResolvedAdvOptions
  const addWatchFile = vi.fn()
  const template = templateGames.find(template => template.id === '/@advjs/game/characters')!
  const render = () => template.getContent.call({ addWatchFile } as never, options)
  return { gameRoot, addWatchFile, render }
}

describe('node character virtual module projection', () => {
  it('loads the repository Flow demo defineAdvCharacter helpers through the actual Node path', async () => {
    const gameRoot = fileURLToPath(new URL('../../../demo/flow/adv', import.meta.url))
    const addWatchFile = vi.fn()
    const template = templateGames.find(template => template.id === '/@advjs/game/characters')!
    const code = await template.getContent.call({ addWatchFile } as never, { gameRoot } as ResolvedAdvOptions)
    const characters = JSON.parse(code.replace(/^export default /u, ''))
    expect(characters).toHaveLength(2)
    expect(characters).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'taki', name: 'Taki Tachibana', avatar: '/img/your-name/characters/taki.png', appearance: expect.stringContaining('messy black hair'), tachies: { default: { src: '/img/your-name/characters/taki.png', class: ['h-full'] } } }),
      expect.objectContaining({ id: 'mitsuha', name: 'Mitsuha Miyamizu', avatar: '/img/your-name/characters/mitsuha.png', appearance: expect.stringContaining('red ribbon'), tachies: { default: { src: '/img/your-name/characters/mitsuha.png', class: ['h-full'] } } }),
    ]))
    expect(code).not.toMatch(/\bimport\b/u)
    expect(code).not.toContain('/@fs/')
    expect(code).not.toContain('defineAdvCharacter')
    expect(addWatchFile.mock.calls.map(([path]) => path).sort()).toEqual([
      join(gameRoot, 'characters/mitsuha.character.ts'),
      join(gameRoot, 'characters/taki.character.ts'),
    ])
  })

  it('evaluates actual TypeScript on the host and exposes ordered appearance data without author source imports or profiles', async () => {
    const project = await fixture()
    await writeFile(join(project.gameRoot, 'characters', 'private.ts'), 'export const profile = { intent: { speakingStyle: "Private narrator direction" }, locales: { en: { providers: { "private-provider": { model: "private-model", voiceId: "reference:private", source: "cloned", rights: { consentRecord: "private-consent.md" } } } } } }')
    const second = join(project.gameRoot, 'characters', '2.hero.character.ts')
    const twentieth = join(project.gameRoot, 'characters', '20.friend.character.ts')
    await writeFile(second, 'import { profile } from "./private"; const displayName: string = "Hero"; export default { id: "hero", name: displayName, avatar: "hero.png", tachies: { smile: { src: "hero-smile.png" } }, voiceProfile: profile }')
    await writeFile(twentieth, 'export default { id: "friend", name: "Friend", avatar: "friend.png" }')
    const code = await project.render()
    expect(code).not.toMatch(/\bimport\b/u)
    for (const secret of ['Private narrator direction', 'private-provider', 'private-model', 'private-consent.md', 'reference:private', project.gameRoot])
      expect(code).not.toContain(secret)
    expect(JSON.parse(code.replace(/^export default /u, ''))).toEqual([
      { id: 'hero', name: 'Hero', avatar: 'hero.png', tachies: { smile: { src: 'hero-smile.png' } } },
      { id: 'friend', name: 'Friend', avatar: 'friend.png' },
    ])
    expect(project.addWatchFile.mock.calls.map(([path]) => path)).toEqual([second, twentieth])
  })

  it('reloads host-evaluated character edits without returning stale module cache data', async () => {
    const project = await fixture()
    const path = join(project.gameRoot, 'characters', '1.hero.character.ts')
    await writeFile(path, 'export default { id: "hero", name: "Before", voiceProfile: { intent: {} } }')
    expect(await project.render()).toContain('Before')
    await writeFile(path, 'export default { id: "hero", name: "After", avatar: "edited.png", voiceProfile: { intent: { speakingStyle: "Still private" } } }')
    const code = await project.render()
    expect(JSON.parse(code.replace(/^export default /u, ''))).toEqual([{ id: 'hero', name: 'After', avatar: 'edited.png' }])
    expect(code).not.toContain('Still private')
  })

  it('retains executable chapter and scene imports in their existing virtual modules', async () => {
    const project = await fixture()
    for (const kind of ['chapter', 'scene']) {
      await mkdir(join(project.gameRoot, `${kind}s`))
      await writeFile(join(project.gameRoot, `${kind}s`, `1.${kind}.ts`), 'export default {}')
      const template = templateGames.find(template => template.id === `/@advjs/game/${kind}s`)!
      const code = await template.getContent.call({ addWatchFile: project.addWatchFile } as never, { gameRoot: project.gameRoot } as ResolvedAdvOptions)
      expect(code).toContain(`import __adv_${kind}_0 from `)
      expect(code).toContain(`export default [__adv_${kind}_0]`)
    }
  })
})
