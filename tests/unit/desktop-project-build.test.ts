import { Buffer } from 'node:buffer'
// @vitest-environment node
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { expect, it } from 'vitest'
import { prepareProjectGame } from '../../packages/advjs/node/commands/build/project'
import { loadProject } from '../../packages/advjs/node/project'
import { templateData } from '../../packages/advjs/node/virtual/data'

it('builds the saved Markdown project configuration and local media, preserving script choices', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'desktop-build-'))
  try {
    await cp(resolve('tests/launch/fixtures/golden-project'), root, { recursive: true })
    await mkdir(resolve(root, 'adv/assets'), { recursive: true })
    const bytes = Buffer.from([0, 255, 128, 1])
    await writeFile(resolve(root, 'adv/assets/voice.wav'), bytes)
    await writeFile(resolve(root, 'adv/assets.json'), JSON.stringify({ schemaVersion: 2, id: 'test', defaultProfile: 'local', profiles: { local: { provider: 'project', root: 'adv/assets' } }, assets: [{ id: 'voice', kind: 'bgm', type: 'audio', path: 'voice.wav' }] }))
    const characterPath = resolve(root, 'adv/characters/xiaoyu.character.md')
    await writeFile(characterPath, (await readFile(characterPath, 'utf8')).replace('tags:', 'tachies:\n  default:\n    src: ./adv/assets/voice.wav\ntags:'))
    const scriptPath = resolve(root, 'adv/chapters/chapter_01.adv.md')
    await writeFile(scriptPath, `${await readFile(scriptPath, 'utf8')}\n\`\`\`yaml\n- type: tachie\n  enter:\n    name: xiaoyu\n    status: default\n\`\`\`\n`)
    const loaded = await loadProject({ root })
    expect(loaded.result.diagnostics.filter(item => item.severity === 'error')).toEqual([])
    const prepared = await prepareProjectGame(loaded)
    expect(prepared.game.characters[0].name).toBe('小雨')
    expect(decodeURIComponent(prepared.game.chapters[0].nodes[0].src)).toContain('- 现在打开')
    expect(prepared.game.bgm.library).toMatchObject({ voice: { src: expect.stringMatching(/^\.\/project-assets\//) } })
    expect([...prepared.resources.values()]).toContainEqual(bytes)
    expect(JSON.stringify(prepared.game)).not.toContain(root)
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})

it('omits build host configuration paths from the client bundle while retaining development diagnostics', async () => {
  const data = { configFile: '/host/adv.config.ts', gameConfigFile: '/host/game.config.ts', themeConfigFile: '/host/theme.config.ts', config: {}, gameConfig: { title: 'Story' } }
  const template = templateData.getContent as (options: unknown) => Promise<string>
  expect(await template({ mode: 'build', data })).not.toContain('/host/')
  expect(await template({ mode: 'dev', data })).toContain('/host/adv.config.ts')
})
