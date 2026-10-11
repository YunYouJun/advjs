// @vitest-environment node
import { Buffer } from 'node:buffer'
import { mkdir, mkdtemp, rename, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { expect, it, vi } from 'vitest'
import { readWorkspaceItem } from '../../../packages/mcp-server/src/workspace-content'

const hook = vi.hoisted(() => ({ beforeOpen: undefined as undefined | (() => Promise<void>) }))
vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>()
  return {
    ...actual,
    open: async (...args: Parameters<typeof actual.open>) => {
      const beforeOpen = hook.beforeOpen
      hook.beforeOpen = undefined
      await beforeOpen?.()
      return actual.open(...args)
    },
  }
})

it.skipIf(process.platform !== 'linux').each(['ancestor', 'leaf'])('rejects a %s symlink swap between realpath and open', async (target) => {
  const root = await mkdtemp(join(tmpdir(), 'mcp-root-'))
  const outside = await mkdtemp(join(tmpdir(), 'mcp-outside-'))
  const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  try {
    await mkdir(join(root, 'art'))
    await writeFile(join(root, 'art/x.png'), png)
    await writeFile(join(outside, 'x.png'), png)
    hook.beforeOpen = async () => {
      if (target === 'ancestor') {
        await rename(join(root, 'art'), join(root, 'old'))
        await symlink(outside, join(root, 'art'))
      }
      else {
        await rename(join(root, 'art/x.png'), join(root, 'art/old.png'))
        await symlink(join(outside, 'x.png'), join(root, 'art/x.png'))
      }
    }
    const source = { files: {}, result: { project: { id: 'project', characters: [], chapters: [], scenes: [{ id: 'scene', name: 'Scene', src: 'art/x.png' }] } } }
    const result = await readWorkspaceItem(source, root, 'scenes', 'scene')
    if (target === 'ancestor')
      expect(result.structuredContent.item.images[0].status).toBe('outside_project')
    else
      expect(result.structuredContent.item.images[0].status).not.toBe('ready')
    expect(Object.keys(result._meta['advjs/images'])).toHaveLength(0)
  }
  finally {
    hook.beforeOpen = undefined
    await Promise.all([rm(root, { recursive: true, force: true }), rm(outside, { recursive: true, force: true })])
  }
})
