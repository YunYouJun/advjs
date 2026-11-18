import type { IFileSystem } from '../utils/fs'
import { Blob as NodeBlob } from 'node:buffer'
import { webcrypto } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { commitStudioProjectFiles } from '../utils/nativeProjectMutation'

beforeAll(() => {
  vi.stubGlobal('Blob', NodeBlob)
  vi.stubGlobal('crypto', webcrypto)
})
afterAll(() => vi.unstubAllGlobals())

const baseline = { 'first.md': 'first before', 'second.md': 'second before', 'third.md': 'third before' }
const changes = Object.entries(baseline).map(([path, expected]) => ({ path, expected, content: `${path} candidate` }))
async function fixture(backend: IFileSystem['backend']) {
  const files: Record<string, string> = { ...baseline }
  const blobs = new Map<string, Blob>()
  const fs = {
    backend,
    exists: vi.fn(async (path: string) => path in files || blobs.has(path)),
    readFile: vi.fn(async (path: string) => files[path]),
    writeFile: vi.fn(async (path: string, content: string) => { files[path] = content }),
    readBlob: vi.fn(async (path: string) => {
      if (!blobs.has(path))
        throw new Error('missing binary')
      return blobs.get(path)!
    }),
    writeBlob: vi.fn(async (path: string, blob: Blob) => { blobs.set(path, blob) }),
    deleteFile: vi.fn(async (path: string) => {
      delete files[path]
      blobs.delete(path)
    }),
    flush: vi.fn(async () => {}),
  } as unknown as IFileSystem
  const blob = new Blob(['Explicit generic unit bytes, not decoded image or speech'])
  const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())), value => value.toString(16).padStart(2, '0')).join('')
  const media = { path: 'assets/import.bin', blob, sha256, bytes: blob.size }
  const options = { acceptsPath: () => true, media, validateCurrent: async () => {
    if (JSON.stringify(files) !== JSON.stringify(baseline))
      throw new Error('Full saved baseline changed')
  } }
  return { files, blobs, fs, media, options }
}

describe('finite media creation authority', () => {
  it('rejects an exclusive copy when the immutable target already exists', async () => {
    const f = await fixture('browser')
    f.blobs.set(f.media.path, f.media.blob)
    await expect(commitStudioProjectFiles(f.fs, [], { ...f.options, media: { ...f.media, exclusive: true } })).rejects.toThrow('ADV_STUDIO_MEDIA_EXISTS')
    expect(f.fs.writeBlob).not.toHaveBeenCalled()
    expect(f.blobs.get(f.media.path)).toBe(f.media.blob)
  })

  it.each(['../outside.bin', 'adv\\..\\outside.bin', 'file:outside.bin'])('retains canonical project boundaries even with an explicit path extension: %s', async (path) => {
    const f = await fixture('browser')
    await expect(commitStudioProjectFiles(f.fs, [], { ...f.options, media: { ...f.media, path }, acceptsMediaPath: () => true })).rejects.toThrow('ADV_STUDIO_TRANSACTION_INVALID')
    expect(f.fs.writeBlob).not.toHaveBeenCalled()
  })
})

describe.each(['browser', 'capacitor'] as const)('%s non-atomic project compensation', (backend) => {
  it('preserves another writer and media while reverting the remaining owned source files', async () => {
    const f = await fixture(backend)
    const cause = new Error('Post-write validation failed')
    await expect(commitStudioProjectFiles(f.fs, changes, { ...f.options, validateAfter: async () => {
      f.files['second.md'] = 'Saved by another writer'
      throw cause
    } })).rejects.toMatchObject({ message: 'ADV_STUDIO_ROLLBACK_INCOMPLETE', cause })
    expect(f.files).toEqual({ ...baseline, 'second.md': 'Saved by another writer' })
    expect(f.blobs.get(f.media.path)).toBe(f.media.blob)
  })

  it('rechecks each pending path after an earlier write instead of overwriting a newer file', async () => {
    const f = await fixture(backend)
    vi.mocked(f.fs.writeFile).mockImplementation(async (path, content) => {
      f.files[path] = content
      if (path === 'first.md' && content === changes[0]!.content)
        f.files['second.md'] = 'Saved while first write was pending'
    })
    await expect(commitStudioProjectFiles(f.fs, changes, f.options)).rejects.toMatchObject({ message: 'ADV_STUDIO_ROLLBACK_INCOMPLETE', cause: { message: 'ADV_STUDIO_SOURCE_CONFLICT' } })
    expect(f.files).toEqual({ ...baseline, 'second.md': 'Saved while first write was pending' })
    expect(vi.mocked(f.fs.writeFile).mock.calls.some(([path, value]) => path === 'second.md' && value === changes[1]!.content)).toBe(false)
  })

  it('continues other restoration and flush attempts after one rollback write fails', async () => {
    const f = await fixture(backend)
    const cause = new Error('Original mutation failure')
    vi.mocked(f.fs.writeFile).mockImplementation(async (path, content) => {
      if (path === 'second.md' && content === baseline['second.md'])
        throw new Error('Rollback storage failure')
      f.files[path] = content
    })
    await expect(commitStudioProjectFiles(f.fs, changes, { ...f.options, validateAfter: async () => {
      throw cause
    } })).rejects.toMatchObject({ message: 'ADV_STUDIO_ROLLBACK_INCOMPLETE', cause, errors: [expect.objectContaining({ message: 'Rollback storage failure' })] })
    expect(f.files).toEqual({ ...baseline, 'second.md': changes[1]!.content })
    expect(f.blobs.has(f.media.path)).toBe(true)
    expect(f.fs.flush).toHaveBeenCalledTimes(2)
  })

  it('retains a later-created source and the imported media it may reference', async () => {
    const f = await fixture(backend)
    await expect(commitStudioProjectFiles(f.fs, changes, { ...f.options, validateAfter: async () => {
      f.files['new.md'] = 'Author now references assets/import.bin'
      throw new Error('Validate failed')
    } })).rejects.toThrow('ADV_STUDIO_ROLLBACK_INCOMPLETE')
    expect(f.files).toEqual({ ...baseline, 'new.md': 'Author now references assets/import.bin' })
    expect(f.blobs.has(f.media.path)).toBe(true)
  })

  it('does not recreate a deleted source over a later author replacement', async () => {
    const f = await fixture(backend)
    await expect(commitStudioProjectFiles(f.fs, [{ path: 'first.md', expected: baseline['first.md'], content: null }], { ...f.options, validateAfter: async () => {
      f.files['first.md'] = 'Author recreated this source'
      throw new Error('Validate failed')
    } })).rejects.toThrow('ADV_STUDIO_ROLLBACK_INCOMPLETE')
    expect(f.files['first.md']).toBe('Author recreated this source')
  })

  it('preserves replaced binary bytes while removing only unchanged new imports', async () => {
    const f = await fixture(backend)
    const author = new Blob(['New author bytes'])
    await expect(commitStudioProjectFiles(f.fs, changes, { ...f.options, media: [f.media, { ...f.media, path: 'assets/other.bin' }], validateAfter: async () => {
      f.blobs.set(f.media.path, author)
      throw new Error('Validate failed')
    } })).rejects.toThrow('ADV_STUDIO_ROLLBACK_INCOMPLETE')
    expect(f.files).toEqual(baseline)
    expect(f.blobs.get(f.media.path)).toBe(author)
    expect(f.blobs.has('assets/other.bin')).toBe(false)
  })

  it('retains unreadable files and reports both the original and rollback failure', async () => {
    const f = await fixture(backend)
    const cause = new Error('Validate failed')
    await expect(commitStudioProjectFiles(f.fs, changes, { ...f.options, validateAfter: async () => {
      vi.mocked(f.fs.exists).mockImplementation(async (path) => {
        if (path === 'second.md')
          throw new Error('Permission unknown')
        return path in f.files || f.blobs.has(path)
      })
      throw cause
    } })).rejects.toMatchObject({ message: 'ADV_STUDIO_ROLLBACK_INCOMPLETE', cause, errors: [expect.objectContaining({ message: 'Permission unknown' })] })
    expect(f.files['second.md']).toBe(changes[1]!.content)
    expect(f.files['first.md']).toBe(baseline['first.md'])
    expect(f.blobs.has(f.media.path)).toBe(true)
  })

  it('retains an unknown partial file instead of assuming the failed write owns its contents', async () => {
    const f = await fixture(backend)
    const cause = new Error('Write persisted an unknown partial result')
    vi.mocked(f.fs.writeFile).mockImplementation(async (path, content) => {
      if (path === 'second.md' && content === changes[1]!.content) {
        f.files[path] = 'Partial bytes requiring review'
        throw cause
      }
      f.files[path] = content
    })
    await expect(commitStudioProjectFiles(f.fs, changes, f.options)).rejects.toMatchObject({ message: 'ADV_STUDIO_ROLLBACK_INCOMPLETE', cause })
    expect(f.files).toEqual({ ...baseline, 'second.md': 'Partial bytes requiring review' })
    expect(f.blobs.has(f.media.path)).toBe(true)
  })
})
