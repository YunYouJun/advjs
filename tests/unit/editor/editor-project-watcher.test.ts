// @vitest-environment node
import { mkdir, mkdtemp, rename, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it, vi } from 'vitest'
import { watchEditorProject } from '../../../packages/advjs/node/editor/watch-project'

const race = vi.hoisted(() => ({ afterStat: undefined as ((path: unknown) => Promise<void>) | undefined }))
vi.mock('node:fs/promises', async (original) => {
  const fs = await original<typeof import('node:fs/promises')>()
  return { ...fs, lstat: async (...args: Parameters<typeof fs.lstat>) => {
    const result = await fs.lstat(...args)
    await race.afterStat?.(args[0])
    return result
  } }
})

it('observes atomic saves, later external edits, recreation and stops all directory watchers', async () => {
  const root = await mkdtemp(join(tmpdir(), 'advjs-watch-'))
  const directory = join(root, 'adv', 'chapters')
  const path = join(directory, 'intro.chapter.json')
  await mkdir(directory, { recursive: true })
  await writeFile(path, 'original')
  const events: string[] = []
  const watcher = await watchEditorProject(root, (_event, path) => events.push(path))
  async function observe(operation: () => Promise<unknown>) {
    events.length = 0
    await operation()
    await expect.poll(() => events).toContain('adv/chapters/intro.chapter.json')
  }
  try {
    for (let index = 0; index < 2; index++) {
      await observe(async () => {
        await writeFile(join(directory, 'temporary'), `saved ${index}`)
        await rename(join(directory, 'temporary'), path)
      })
      await observe(() => writeFile(path, `external ${index}`))
    }
    await observe(() => rm(path))
    await observe(() => writeFile(path, 'recreated'))
    await observe(() => writeFile(path, 'external after recreation'))
    watcher.close()
    events.length = 0
    await writeFile(path, 'after stop')
    await new Promise(resolve => setTimeout(resolve, 100))
    expect(events).toEqual([])
  }
  finally {
    watcher.close()
    await rm(root, { recursive: true, force: true })
  }
})

it('does not traverse symlinks outside the project and watches newly created directories', async () => {
  const root = await mkdtemp(join(tmpdir(), 'advjs-watch-'))
  const outside = await mkdtemp(join(tmpdir(), 'advjs-watch-outside-'))
  await symlink(outside, join(root, 'linked'), 'dir')
  const events: string[] = []
  const watcher = await watchEditorProject(root, (_event, path) => events.push(path))
  try {
    await writeFile(join(outside, 'private.json'), 'private')
    await new Promise(resolve => setTimeout(resolve, 100))
    expect(events).toEqual([])
    await mkdir(join(root, 'new'))
    await expect.poll(() => events).toContain('new')
    await writeFile(join(root, 'new', 'chapter.json'), 'created')
    await expect.poll(() => events).toContain('new/chapter.json')
    events.length = 0
    await writeFile(join(root, 'new', 'chapter.json'), 'external')
    await expect.poll(() => events).toContain('new/chapter.json')
  }
  finally {
    watcher.close()
    await Promise.all([rm(root, { recursive: true, force: true }), rm(outside, { recursive: true, force: true })])
  }
})

it('rebinds replaced directories and suppresses events from a directory moved outside the project', async () => {
  const root = await mkdtemp(join(tmpdir(), 'advjs-watch-'))
  const outside = await mkdtemp(join(tmpdir(), 'advjs-watch-moved-'))
  await mkdir(join(root, 'chapters'))
  const events: string[] = []
  const watcher = await watchEditorProject(root, (_event, path) => events.push(path))
  try {
    await rename(join(root, 'chapters'), join(outside, 'old'))
    await expect.poll(() => events).toContain('chapters')
    await symlink(join(outside, 'old'), join(root, 'chapters'), 'dir')
    await new Promise(resolve => setTimeout(resolve, 100))
    events.length = 0
    await writeFile(join(outside, 'old', 'private.json'), 'private')
    await new Promise(resolve => setTimeout(resolve, 100))
    expect(events).toEqual([])
    await rm(join(root, 'chapters'))
    await mkdir(join(root, 'chapters'))
    await expect.poll(() => events).toContain('chapters')
    await writeFile(join(root, 'chapters', 'new.json'), 'new')
    await expect.poll(() => events).toContain('chapters/new.json')
    events.length = 0
    await writeFile(join(root, 'chapters', 'new.json'), 'changed')
    await expect.poll(() => events).toContain('chapters/new.json')
  }
  finally {
    watcher.close()
    await Promise.all([rm(root, { recursive: true, force: true }), rm(outside, { recursive: true, force: true })])
  }
})

it('rejects a directory swapped to an outside symlink between stat and watch registration', async () => {
  const root = await mkdtemp(join(tmpdir(), 'advjs-watch-'))
  const outside = await mkdtemp(join(tmpdir(), 'advjs-watch-race-'))
  const inside = join(root, 'inside')
  await mkdir(inside)
  race.afterStat = async (path) => {
    if (path !== inside)
      return
    race.afterStat = undefined
    await rm(inside, { recursive: true })
    await symlink(outside, inside, 'dir')
  }
  const events: string[] = []
  const watcher = await watchEditorProject(root, (_event, path) => events.push(path))
  try {
    await writeFile(join(outside, 'private-name.json'), 'private')
    await new Promise(resolve => setTimeout(resolve, 100))
    expect(events.every(path => !path.includes('private-name'))).toBe(true)
  }
  finally {
    race.afterStat = undefined
    watcher.close()
    await Promise.all([rm(root, { recursive: true, force: true }), rm(outside, { recursive: true, force: true })])
  }
})
