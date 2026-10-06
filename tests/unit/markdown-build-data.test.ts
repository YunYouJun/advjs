// @vitest-environment node

import type { AdvData } from '@advjs/types'
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'pathe'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createProjectDataModule } from '../../packages/advjs/node/virtual/project'
import { defaultAdvConfig, defaultGameConfig } from '../../packages/advjs/shared'

describe('markdown production data', () => {
  let root: string
  const data = { config: defaultAdvConfig, gameConfig: defaultGameConfig } as AdvData

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'advjs-build-data-'))
    await mkdir(join(root, 'adv/chapters'), { recursive: true })
    await mkdir(join(root, 'adv/scenes'), { recursive: true })
    await mkdir(join(root, 'adv/characters'), { recursive: true })
    await mkdir(join(root, 'adv/assets'), { recursive: true })
  })
  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  async function writeProject() {
    await writeFile(join(root, 'adv.config.json'), JSON.stringify({ format: 'adv-md', root: './adv' }))
    await writeFile(join(root, 'game.config.json'), JSON.stringify({ title: '桃园', variables: { firstPriority: 'undecided' } }))
    await writeFile(join(root, 'adv/chapters/intro.adv.md'), '## Start {#start}\n\n米粒落进木斗。\n')
    await writeFile(join(root, 'adv/scenes/room.md'), '---\nid: room\nname: 桃园\ntype: image\nassetId: room\nimagePrompt: secret prompt\n---\n')
    await writeFile(join(root, 'adv/characters/liu.character.md'), '---\nid: liu\nname: 刘备\n---\n\n## 背景\n作者秘密。\n')
    await writeFile(join(root, 'adv/assets.json'), JSON.stringify({
      schemaVersion: 2,
      id: 'media',
      defaultProfile: 'local',
      profiles: { local: { provider: 'project', root: 'adv/assets' } },
      assets: [{ id: 'room', kind: 'background', type: 'image', path: 'room.webp', variants: { original: { cachePath: '.advjs/private.png' } } }],
    }))
    await writeFile(join(root, 'adv/assets/room.webp'), 'image fixture')
  }

  it('ships chapters, initial variables and imported scene URLs without authoring cards', async () => {
    await writeProject()
    const addWatchFile = vi.fn()
    const module = await createProjectDataModule({ userRoot: root, data }, { addWatchFile })
    expect(module).toContain(`${root}/adv/assets/room.webp?url`)
    expect(module).toContain('data.gameConfig.scenes[0].src = __adv_asset_0')
    expect(module).toContain(encodeURIComponent('米粒落进木斗。'))
    expect(module).toContain('"firstPriority":"undecided"')
    expect(module).toContain('"name":"刘备"')
    expect(module).not.toContain('作者秘密')
    expect(module).not.toContain('secret prompt')
    expect(module).not.toContain('.advjs/private.png')
    expect(addWatchFile).toHaveBeenCalledWith(join(root, 'adv/chapters/intro.adv.md'))
  })

  it('leaves legacy module projects on their existing virtual loader', async () => {
    await writeFile(join(root, 'adv.config.json'), JSON.stringify({ format: 'fountain', root: './adv' }))
    expect(await createProjectDataModule({ userRoot: root, data }, { addWatchFile: vi.fn() })).toBeUndefined()
  })

  it('fails before deployment when a required preview has not been downloaded', async () => {
    await writeProject()
    await rm(join(root, 'adv/assets/room.webp'))
    await expect(createProjectDataModule({ userRoot: root, data }, { addWatchFile: vi.fn() })).rejects.toThrow('Run adv assets pull')
  })

  it('rejects runtime media symlinks outside the project', async () => {
    await writeProject()
    const outside = await mkdtemp(join(tmpdir(), 'advjs-build-outside-'))
    try {
      await writeFile(join(outside, 'room.webp'), 'private image')
      await rm(join(root, 'adv/assets/room.webp'))
      await symlink(join(outside, 'room.webp'), join(root, 'adv/assets/room.webp'))
      await expect(createProjectDataModule({ userRoot: root, data }, { addWatchFile: vi.fn() })).rejects.toThrow('escapes')
    }
    finally {
      await rm(outside, { recursive: true, force: true })
    }
  })
})
