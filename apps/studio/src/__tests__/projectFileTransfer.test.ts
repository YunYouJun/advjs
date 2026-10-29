import type { IFileSystem } from '../utils/fs'
import { Blob as NodeBlob } from 'node:buffer'
import { webcrypto } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { observeStudioFileSystem, studioFileMutationRevision } from '../utils/fs/mutations'
import { transferStudioProjectFiles } from '../utils/projectFileTransfer'
import { runStudioProjectWrite, whenStudioProjectWritesSettle } from '../utils/projectWriteQueue'

beforeAll(() => {
  vi.stubGlobal('Blob', NodeBlob)
  vi.stubGlobal('crypto', webcrypto)
})
afterAll(() => vi.unstubAllGlobals())

function fixture() {
  const files = new Map<string, Blob>()
  const dirs = new Set(['', 'adv', 'adv/empty'])
  const missing = () => new DOMException('Missing', 'NotFoundError')
  const fs: IFileSystem = {
    backend: 'browser',
    exists: vi.fn(async path => dirs.has(path) || files.has(path)),
    stat: vi.fn(async (path) => {
      if (!dirs.has(path) && !files.has(path))
        throw missing()
      return { name: path.split('/').at(-1)!, type: dirs.has(path) ? 'directory' as const : 'file' as const, size: files.get(path)?.size ?? 0, path, mtime: 0 }
    }),
    readdir: vi.fn(async path => [...dirs, ...files.keys()].filter(entry => entry && entry.slice(0, Math.max(0, entry.lastIndexOf('/'))) === path).map(entry => ({ name: entry.split('/').at(-1)!, path: entry, type: dirs.has(entry) ? 'directory' as const : 'file' as const, size: files.get(entry)?.size ?? 0, mtime: 0 }))),
    readBlob: vi.fn(async (path) => {
      if (!files.has(path))
        throw missing()
      return files.get(path)!
    }),
    readFile: async path => (await fs.readBlob(path)).text(),
    writeBlob: vi.fn(async (path, blob) => {
      if (!dirs.has(path.slice(0, Math.max(0, path.lastIndexOf('/')))))
        throw missing()
      files.set(path, blob)
    }),
    writeFile: async (path, text) => fs.writeBlob(path, new Blob([text])),
    mkdir: vi.fn(async (path) => { dirs.add(path) }),
    deleteFile: vi.fn(async (path) => { files.delete(path) }),
    rmdir: vi.fn(async (path, options) => {
      const children = [...dirs, ...files.keys()].filter(entry => entry.startsWith(`${path}/`))
      if (options?.recursive === false && children.length)
        throw new DOMException('Not empty', 'InvalidModificationError')
      for (const entry of children) {
        dirs.delete(entry)
        files.delete(entry)
      }
      dirs.delete(path)
    }),
    flush: vi.fn(async () => {}),
    listFiles: async () => [],
    listFilesByExts: async () => [],
    collectAllFiles: async () => [],
    readBlobUrl: async () => '',
  }
  files.set('README.md', new Blob(['Original README']))
  files.set('adv/world.md', new Blob(['Original world']))
  files.set('adv/master.bin', new Blob([new Uint8Array([0, 128, 255, 37])]))
  const assertCurrent = vi.fn()
  const applied = vi.fn()
  const transfer = (source = 'README.md', target = 'renamed.md', move = true) => transferStudioProjectFiles(fs, async () => [{ source, target, move }], { assertCurrent, applied })
  return { files, dirs, fs, transfer, assertCurrent, applied }
}

describe('shared native project file transfers', () => {
  it('moves exact saved bytes and reports adapter mutations before its receipt', async () => {
    const f = fixture()
    observeStudioFileSystem(f.fs)
    await f.transfer()
    expect(await f.fs.readFile('renamed.md')).toBe('Original README')
    expect(f.files.has('README.md')).toBe(false)
    expect(studioFileMutationRevision(f.fs)).toBeGreaterThan(0)
    expect(f.applied).toHaveBeenCalledOnce()
  })

  it('moves nested directories, binary bytes and empty directories without recursive deletion', async () => {
    const f = fixture()
    await f.transfer('adv', 'story')
    expect(await f.fs.readFile('story/world.md')).toBe('Original world')
    expect(new Uint8Array(await (await f.fs.readBlob('story/master.bin')).arrayBuffer())).toEqual(new Uint8Array([0, 128, 255, 37]))
    expect(f.dirs.has('story/empty')).toBe(true)
    expect(f.dirs.has('adv')).toBe(false)
    expect(vi.mocked(f.fs.rmdir).mock.calls.every(([, options]) => options?.recursive === false)).toBe(true)
  })

  it('rejects a target created while reading immutable source bytes', async () => {
    const f = fixture()
    const read = f.fs.readBlob
    vi.mocked(f.fs.readBlob).mockImplementationOnce(async (path) => {
      const blob = await read(path)
      f.files.set('renamed.md', new Blob(['New independent target']))
      return blob
    })
    await expect(f.transfer()).rejects.toThrow('ADV_STUDIO_SOURCE_CONFLICT')
    expect(await f.fs.readFile('renamed.md')).toBe('New independent target')
    expect(await f.fs.readFile('README.md')).toBe('Original README')
    expect(f.fs.writeBlob).not.toHaveBeenCalled()
  })

  it('does not interpret an unknown destination read as absence', async () => {
    const f = fixture()
    vi.mocked(f.fs.exists).mockRejectedValueOnce(new DOMException('Denied', 'NotAllowedError'))
    await expect(f.transfer()).rejects.toThrow('Denied')
    expect(f.fs.writeBlob).not.toHaveBeenCalled()
    expect(f.fs.deleteFile).not.toHaveBeenCalled()
  })

  it('keeps a verified copy and new author source when the original changes during copying', async () => {
    const f = fixture()
    const write = vi.mocked(f.fs.writeBlob).getMockImplementation()!
    vi.mocked(f.fs.writeBlob).mockImplementationOnce(async (path, blob) => {
      await write(path, blob)
      f.files.set('README.md', new Blob(['Independent later source']))
    })
    await expect(f.transfer()).rejects.toThrow('ADV_STUDIO_TRANSFER_RECOVERY_REQUIRED')
    expect(await f.fs.readFile('README.md')).toBe('Independent later source')
    expect(await f.fs.readFile('renamed.md')).toBe('Original README')
    expect(f.applied).not.toHaveBeenCalled()
  })

  it('compensates a successful native removal whose receipt then fails', async () => {
    const f = fixture()
    vi.mocked(f.fs.deleteFile).mockImplementationOnce(async (path) => {
      f.files.delete(path)
      throw new Error('Removal persisted then failed')
    })
    await expect(f.transfer()).rejects.toThrow('Removal persisted then failed')
    expect(await f.fs.readFile('README.md')).toBe('Original README')
    expect(f.files.has('renamed.md')).toBe(false)
  })

  it('retains the complete destination if an independent author prevents restoring a removed source', async () => {
    const f = fixture()
    vi.mocked(f.fs.deleteFile).mockImplementationOnce(async (path) => {
      f.files.set(path, new Blob(['New source after removal']))
      throw new Error('Late native error')
    })
    await expect(f.transfer()).rejects.toThrow('ADV_STUDIO_TRANSFER_RECOVERY_REQUIRED: renamed.md')
    expect(await f.fs.readFile('README.md')).toBe('New source after removal')
    expect(await f.fs.readFile('renamed.md')).toBe('Original README')
  })

  it('preserves new children and restores deleted originals when a source directory gains a file', async () => {
    const f = fixture()
    const remove = vi.mocked(f.fs.deleteFile).getMockImplementation()!
    vi.mocked(f.fs.deleteFile).mockImplementationOnce(async (path) => {
      await remove(path)
      f.files.set('adv/new-author.md', new Blob(['New child']))
    })
    await expect(f.transfer('adv', 'story')).rejects.toThrow('ADV_STUDIO_TRANSFER_RECOVERY_REQUIRED')
    expect(await f.fs.readFile('adv/new-author.md')).toBe('New child')
    expect(await f.fs.readFile('adv/world.md')).toBe('Original world')
    expect(await f.fs.readFile('story/world.md')).toBe('Original world')
  })

  it('rolls back its earlier copies when a later batch destination becomes occupied', async () => {
    const f = fixture()
    const write = vi.mocked(f.fs.writeBlob).getMockImplementation()!
    vi.mocked(f.fs.writeBlob).mockImplementationOnce(async (path, blob) => {
      await write(path, blob)
      f.files.set('other.md', new Blob(['Independent batch target']))
    })
    await expect(transferStudioProjectFiles(f.fs, async () => [{ source: 'README.md', target: 'renamed.md', move: true }, { source: 'adv/world.md', target: 'other.md', move: true }], { assertCurrent: f.assertCurrent })).rejects.toThrow('ADV_STUDIO_SOURCE_CONFLICT')
    expect(f.files.has('renamed.md')).toBe(false)
    expect(await f.fs.readFile('other.md')).toBe('Independent batch target')
    expect(await f.fs.readFile('README.md')).toBe('Original README')
  })

  it('compensates scope changes before acknowledging a completed transfer', async () => {
    const f = fixture()
    vi.mocked(f.fs.flush!).mockImplementationOnce(async () => {
      f.assertCurrent.mockImplementation(() => {
        throw new Error('Switched project')
      })
    })
    await expect(f.transfer()).rejects.toThrow('Switched project')
    expect(await f.fs.readFile('README.md')).toBe('Original README')
    expect(f.files.has('renamed.md')).toBe(false)
    expect(f.applied).not.toHaveBeenCalled()
  })

  it('serializes other author writes until the transfer and its verification settle', async () => {
    const f = fixture()
    let release!: () => void
    const gate = new Promise<void>(resolve => release = resolve)
    const write = vi.mocked(f.fs.writeBlob).getMockImplementation()!
    vi.mocked(f.fs.writeBlob).mockImplementationOnce(async (path, blob) => {
      await gate
      await write(path, blob)
    })
    const transfer = f.transfer()
    await vi.waitFor(() => expect(f.fs.writeBlob).toHaveBeenCalledOnce())
    const other = vi.fn(async () => f.fs.writeFile('renamed.md', 'Queued author edit'))
    const pending = runStudioProjectWrite(f.fs, other)
    expect(other).not.toHaveBeenCalled()
    release()
    await transfer
    await pending
    await whenStudioProjectWritesSettle(f.fs)
    expect(await f.fs.readFile('renamed.md')).toBe('Queued author edit')
  })

  it.each(['../outside.md', 'file:outside.md', '/outside.md', 'adv/../outside.md', 'adv\\outside.md', '.git/config'])('rejects noncanonical transfer paths: %s', async (target) => {
    const f = fixture()
    await expect(f.transfer('README.md', target)).rejects.toThrow('ADV_STUDIO_CONTENT_PATH_INVALID')
    expect(f.fs.writeBlob).not.toHaveBeenCalled()
  })

  it('rejects a directory copied into itself before creating any target', async () => {
    const f = fixture()
    await expect(f.transfer('adv', 'adv/copy', false)).rejects.toThrow('ADV_STUDIO_TRANSFER_OVERLAP')
    expect(f.fs.mkdir).not.toHaveBeenCalled()
  })

  it('rejects the byte limit during preflight instead of partially copying a large tree', async () => {
    const f = fixture()
    const stat = vi.mocked(f.fs.stat).getMockImplementation()!
    vi.mocked(f.fs.stat).mockImplementation(async path => ({ ...await stat(path), ...(path === 'README.md' ? { size: 65 * 1024 * 1024 } : {}) }))
    await expect(f.transfer()).rejects.toThrow('ADV_STUDIO_TRANSFER_TOO_LARGE')
    expect(f.fs.writeBlob).not.toHaveBeenCalled()
  })
})
