import { Buffer } from 'node:buffer'
// @vitest-environment node
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { expect, it } from 'vitest'
import { prepareProjectGame } from '../../../packages/advjs/node/commands/build/project'
import { toPlayerData } from '../../../packages/advjs/node/config/player'
import { loadProject } from '../../../packages/advjs/node/project'
import { templateData } from '../../../packages/advjs/node/virtual/data'

it('builds the saved Markdown project configuration and local media, preserving script choices', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'desktop-build-'))
  try {
    await cp(resolve('tests/launch/fixtures/golden-project'), root, { recursive: true })
    await mkdir(resolve(root, 'adv/assets'), { recursive: true })
    const bytes = Buffer.from([0, 255, 128, 1])
    await writeFile(resolve(root, 'adv/assets/voice.wav'), bytes)
    await writeFile(resolve(root, 'adv/assets.json'), JSON.stringify({ schemaVersion: 2, id: 'test', defaultProfile: 'local', profiles: { local: { provider: 'project', root: 'adv/assets' } }, assets: [{ id: 'voice', kind: 'bgm', type: 'audio', path: 'voice.wav' }] }))
    const characterPath = resolve(root, 'adv/characters/xiaoyu.character.md')
    await writeFile(characterPath, (await readFile(characterPath, 'utf8')).replace('tags:', 'cv: Voice actor\nvisual:\n  version: private-design\nimagePrompt: private-prompt\navatar: ./adv/assets/voice.wav\navatars:\n  happy:\n    src: ./adv/assets/voice.wav\n    label: Happy\n    imagePrompt: private-avatar-prompt\n    cachePath: private-cache\ntachies:\n  default:\n    src: ./adv/assets/voice.wav\ntags:'))
    const scriptPath = resolve(root, 'adv/chapters/chapter_01.adv.md')
    await writeFile(scriptPath, `${await readFile(scriptPath, 'utf8')}\n\`\`\`yaml\n- type: tachie\n  enter:\n    name: xiaoyu\n    status: default\n\`\`\`\n`)
    const loaded = await loadProject({ root })
    expect(loaded.result.diagnostics.filter(item => item.severity === 'error')).toEqual([])
    const prepared = await prepareProjectGame(loaded)
    expect(prepared.game.characters[0].name).toBe('小雨')
    expect(prepared.game.characters[0]).toMatchObject({ cv: 'Voice actor', avatar: expect.stringMatching(/^\.\/project-assets\//), avatars: { happy: { src: expect.stringMatching(/^\.\/project-assets\//) } } })
    expect(prepared.game.characters[0]).not.toHaveProperty('visual')
    expect(JSON.stringify(prepared.game)).not.toContain('private-')
    expect(loaded.result.project.characters[0].avatars?.happy).toMatchObject({ imagePrompt: 'private-avatar-prompt', cachePath: 'private-cache' })
    expect(prepared.game.characters[0]).not.toHaveProperty('imagePrompt')
    expect(prepared.game.characters[0]).not.toHaveProperty('background')
    expect(loaded.result.project.characters[0].visual?.version).toBe('private-design')
    expect(await readFile(characterPath, 'utf8')).toContain('private-prompt')
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

it('projects player data without author notes while preserving attribution and voice config filtering', () => {
  const data = { config: { authoring: { voice: { secret: 'voice-secret' } } }, gameConfig: {
    characters: [{ id: 'hero', name: 'Hero', cv: 'Voice actor', avatars: { happy: { src: 'happy.webp', label: 'Happy', imagePrompt: 'private-avatar', cachePath: 'private-cache' } }, tachies: { idle: { src: 'idle.webp', class: 'h-full', style: { opacity: '1' }, description: 'private-tachie', sprite: { frameWidth: 10, frameHeight: 10, frames: 2, fps: 3, secret: 'private-sprite' } } }, background: 'private-background', imagePrompt: 'private-prompt', visual: { version: 'private-design' }, attributes: { mystery: { secret: 'private-secret' } } }],
    scenes: [{ id: 'room', type: 'image', src: 'room.webp', imagePrompt: 'private-scene' }],
  } } as any
  const projected = toPlayerData(data)
  expect(JSON.stringify(projected)).not.toContain('private-')
  expect(JSON.stringify(projected)).not.toContain('voice-secret')
  expect(projected.gameConfig.characters[0].cv).toBe('Voice actor')
  expect(data.gameConfig.characters[0].background).toBe('private-background')
  expect(projected.gameConfig.characters[0].avatars?.happy).toEqual({ src: 'happy.webp', label: 'Happy' })
  expect(projected.gameConfig.characters[0].tachies?.idle).toMatchObject({ src: 'idle.webp', class: 'h-full', style: { opacity: '1' }, sprite: { frameWidth: 10, frameHeight: 10, frames: 2, fps: 3 } })
  expect(data.gameConfig.characters[0].avatars.happy.imagePrompt).toBe('private-avatar')
  expect(data.config.authoring.voice.secret).toBe('voice-secret')
})
