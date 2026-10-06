// @vitest-environment node
import { Buffer } from 'node:buffer'
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'pathe'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { compileProject } from '../../packages/core/src/project/compile'
import { readWorkspaceItem, workspaceContentIndex } from '../../packages/mcp-server/src/workspace-content'

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jCj8AAAAASUVORK5CYII=', 'base64')
const card = `---
id: hero
name: Hero
avatar: art/default.png
avatars:
  thoughtful:
    src: art/thoughtful.png
    label: 思索
visual:
  version: identity-v1
  references:
    - path: art/reference.png
  fixedTraits:
    - Same face
---

## 背景

An established character.
`

describe('workspace authoring content', () => {
  let directory: string
  let outside: string
  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'advjs-workspace-content-'))
    outside = await mkdtemp(join(tmpdir(), 'advjs-workspace-outside-'))
    await mkdir(join(directory, 'art'))
    for (const name of ['default', 'thoughtful', 'reference', 'yard'])
      await writeFile(join(directory, 'art', `${name}.png`), png)
  })
  afterEach(async () => {
    await Promise.all([rm(directory, { recursive: true, force: true }), rm(outside, { recursive: true, force: true })])
  })
  async function source(character = card) {
    const files = {
      'adv.config.json': JSON.stringify({ id: 'fixture', format: 'adv-md', root: 'adv' }),
      'adv/characters/hero.character.md': character,
      'adv/chapters/intro.adv.md': '@Hero(thoughtful)\nThink.\n',
      'adv/scenes/yard.md': '---\nid: yard\nname: 庭院\nassetId: yard\n---\n',
      'adv/assets.json': JSON.stringify({ schemaVersion: 2, id: 'fixture', defaultProfile: 'local', profiles: { local: { provider: 'project', root: 'art' } }, assets: [{ id: 'yard', kind: 'background', type: 'image', path: 'yard.png' }] }),
    }
    return { files, result: await compileProject({ files }) }
  }

  it('shares compiled identities, source paths and expression counts with Studio', async () => {
    const project = await source()
    const index = workspaceContentIndex(project)
    expect(index.characters[0]).toEqual({ id: 'hero', title: 'Hero', paths: ['adv/characters/hero.character.md'], states: 2 })
    const result = await readWorkspaceItem(project, directory, 'characters', 'hero')
    const item = result.structuredContent.item
    expect(item.character?.visual?.version).toBe('identity-v1')
    expect(item.context).toContain('thoughtful')
    expect(item.context).toContain('Same face')
    expect(item.files[0].text).toBe(card)
    expect(item.images.filter(image => image.group === 'portrait').map(image => image.state)).toEqual(['thoughtful', 'default'])
    expect(item.images.every(image => image.status === 'ready')).toBe(true)
    expect(JSON.stringify(result.structuredContent)).not.toContain('base64')
    expect(result._meta['advjs/images']['portrait:thoughtful']).toBe(`data:image/png;base64,${png.toString('base64')}`)
  })

  it('reads chapter text and resolves scene previews through the standard asset catalog', async () => {
    const project = await source()
    const chapter = workspaceContentIndex(project).chapters[0]
    const script = await readWorkspaceItem(project, directory, 'chapters', chapter.id)
    expect(script.structuredContent.item.files[0].text).toContain('@Hero(thoughtful)')
    const scene = await readWorkspaceItem(project, directory, 'scenes', 'yard')
    expect(scene.structuredContent.item.images[0]).toMatchObject({ path: 'art/yard.png', status: 'ready' })
    await expect(readWorkspaceItem(project, directory, 'characters', '../private')).rejects.toThrow('no longer exists')
  })

  it('keeps missing, oversized and unsafe previews from leaking or interrupting authoring', async () => {
    await writeFile(join(outside, 'private.png'), png)
    await symlink(join(outside, 'private.png'), join(directory, 'art', 'link.png'))
    await writeFile(join(directory, 'art', 'large.png'), Buffer.alloc(600 * 1024))
    await writeFile(join(directory, 'art', 'html.png'), '<script>untrusted()</script>')
    const project = await source(card)
    project.result.project.characters[0].avatars = Object.fromEntries(Object.entries({ missing: 'art/missing.png', escaped: '../private.png', linked: 'art/link.png', large: 'art/large.png', html: 'art/html.png', remote: 'https://example.com/image.png' }).map(([key, src]) => [key, { src }]))
    const result = await readWorkspaceItem(project, directory, 'characters', 'hero')
    const statuses = Object.fromEntries(result.structuredContent.item.images.map(image => [image.state, image.status]))
    expect(statuses).toMatchObject({ missing: 'missing', escaped: 'outside_project', linked: 'outside_project', large: 'too_large', html: 'unsupported', remote: 'unsupported' })
    expect(Object.keys(result._meta['advjs/images'])).toEqual(['portrait:default', 'reference-0'])
  })
})
