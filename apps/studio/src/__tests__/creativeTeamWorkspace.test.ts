import type { IFileSystem } from '../utils/fs'
import { describe, expect, it } from 'vitest'
import { createStudioCreativeWorkspace } from '../utils/creativeTeamWorkspace'

function fixture() {
  const files = new Map<string, string>([
    ['adv.config.json', '{"format":"adv-md","root":"adv"}'],
    ['adv/chapters/intro.adv.md', '# 开始 {#start}\n\n下雨了。'],
  ])
  let failPath: string | undefined
  const fs = {
    backend: 'memory',
    exists: async (path: string) => files.has(path),
    readFile: async (path: string) => files.get(path)!,
    writeFile: async (path: string, content: string) => {
      if (path === failPath)
        throw new Error('write failed')
      files.set(path, content)
    },
    deleteFile: async (path: string) => { files.delete(path) },
    collectAllFiles: async () => [...files].map(([path, content]) => ({ path, content, lastModified: new Date() })),
  } as IFileSystem
  return { fs, files, fail: (path: string) => failPath = path }
}

describe('creative team Studio transaction adapter', () => {
  it('creates sources and rejects a full-project revision conflict inside the write lock', async () => {
    const { fs, files } = fixture()
    const workspace = createStudioCreativeWorkspace(fs, 'station')
    const before = await workspace.snapshot()
    const changes = [{ path: 'adv/characters/lin.character.md', before: null, after: '---\nid: lin\nname: 林舟\n---' }]
    files.set('adv/chapters/intro.adv.md', '# 作者修改 {#start}')
    await expect(workspace.commit(changes, before.revision)).rejects.toThrow('SOURCE_CONFLICT')
    expect(files.has(changes[0].path)).toBe(false)
    const after = await workspace.commit(changes, (await workspace.snapshot()).revision)
    expect(after.files[changes[0].path]).toContain('林舟')
  })

  it('rolls back new source creation when a later file write fails', async () => {
    const { fs, files, fail } = fixture()
    const workspace = createStudioCreativeWorkspace(fs, 'station')
    const before = await workspace.snapshot()
    fail('adv/chapters/new.adv.md')
    await expect(workspace.commit([
      { path: 'adv/characters/lin.character.md', before: null, after: '---\nid: lin\nname: 林舟\n---' },
      { path: 'adv/chapters/new.adv.md', before: null, after: '# 新章节 {#start}' },
    ], before.revision)).rejects.toThrow('write failed')
    expect(files.has('adv/characters/lin.character.md')).toBe(false)
    expect((await workspace.snapshot()).revision).toBe(before.revision)
  })

  it('never grants catalog or voice adoption without a real host verifier', async () => {
    const { fs, files } = fixture()
    const workspace = createStudioCreativeWorkspace(fs, 'station')
    expect(workspace.capabilities).not.toContain('catalog-media')
    await expect(workspace.commit([{ path: 'adv/assets.json', before: null, after: '{}' }], (await workspace.snapshot()).revision)).rejects.toThrow('MEDIA_VERIFIER_REQUIRED')
    expect(files.has('adv/assets.json')).toBe(false)
  })

  it('also restores a file whose backend persisted bytes before reporting failure', async () => {
    const { fs, files } = fixture()
    const original = fs.writeFile
    fs.writeFile = async (path, content) => {
      await original(path, content)
      if (path.endsWith('new.adv.md'))
        throw new Error('failure after persistence')
    }
    const workspace = createStudioCreativeWorkspace(fs, 'station')
    const before = await workspace.snapshot()
    await expect(workspace.commit([
      { path: 'adv/chapters/new.adv.md', before: null, after: '# 新章 {#start}' },
    ], before.revision)).rejects.toThrow('failure after persistence')
    expect(files.has('adv/chapters/new.adv.md')).toBe(false)
    expect((await workspace.snapshot()).revision).toBe(before.revision)
  })
})
