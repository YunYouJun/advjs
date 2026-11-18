import type { IFileSystem } from '../utils/fs'
import { describe, expect, it, vi } from 'vitest'
import { useTextDocument } from '../composables/useTextDocument'
import { runStudioProjectWrite } from '../utils/projectWriteQueue'

function fixture() {
  const files: Record<string, string> = { 'adv/world.md': '# Original world' }
  const fs = {
    backend: 'browser',
    exists: async (path: string) => Object.hasOwn(files, path),
    readFile: vi.fn(async (path: string) => files[path]!),
    writeFile: vi.fn(async (path: string, value: string) => { files[path] = value }),
    deleteFile: vi.fn(async (path: string) => { delete files[path] }),
    flush: vi.fn(async () => {}),
  } as unknown as IFileSystem
  let current = fs
  let projectId = 'original'
  return { files, fs, document: useTextDocument(() => current, () => projectId), switchFs: () => {
    current = { ...fs }
  }, switchProject: () => {
    projectId = 'other'
  } }
}

describe('opened text source protection', () => {
  it('preserves a later author file and the original baseline when an old draft is saved', async () => {
    const f = fixture()
    expect(await f.document.read('adv/world.md')).toBe('# Original world')
    f.files['adv/world.md'] = '# New adopted world'
    await expect(f.document.save('adv/world.md', '# Old draft')).rejects.toThrow('ADV_STUDIO_SOURCE_CONFLICT')
    expect(f.files['adv/world.md']).toBe('# New adopted world')
    expect(f.fs.writeFile).not.toHaveBeenCalled()
    await expect(f.document.save('adv/world.md', '# Retried old draft')).rejects.toThrow('ADV_STUDIO_SOURCE_CONFLICT')
  })

  it('waits for persistence and advances the baseline to the exact saved text only on success', async () => {
    const f = fixture()
    await f.document.read('adv/world.md')
    let release!: () => void
    vi.mocked(f.fs.flush!).mockReturnValueOnce(new Promise<void>((resolve) => {
      release = resolve
    }))
    let done = false
    const saving = f.document.save('adv/world.md', '# First saved version').then(() => {
      done = true
    })
    await vi.waitFor(() => expect(f.fs.flush).toHaveBeenCalledOnce())
    expect(done).toBe(false)
    await expect(f.document.save('adv/world.md', '# Concurrent draft')).rejects.toThrow('ADV_STUDIO_CONTENT_SAVE_BUSY')
    release()
    await saving
    await f.document.save('adv/world.md', '# Next saved version')
    expect(f.files['adv/world.md']).toBe('# Next saved version')
  })

  it('compensates a failed persistence barrier and retains a usable original baseline', async () => {
    const f = fixture()
    await f.document.read('adv/world.md')
    vi.mocked(f.fs.flush!).mockRejectedValueOnce(new Error('Disk unavailable'))
    await expect(f.document.save('adv/world.md', '# Draft')).rejects.toThrow('Disk unavailable')
    expect(f.files['adv/world.md']).toBe('# Original world')
    await f.document.save('adv/world.md', '# Explicit retry')
    expect(f.files['adv/world.md']).toBe('# Explicit retry')
  })

  it.each(['switchFs', 'switchProject'] as const)('rejects a late save after %s without writing to either scope', async (change) => {
    const f = fixture()
    await f.document.read('adv/world.md')
    f[change]()
    await expect(f.document.save('adv/world.md', '# Old project draft')).rejects.toThrow('ADV_STUDIO_CONTENT_SCOPE_CHANGED')
    expect(f.fs.writeFile).not.toHaveBeenCalled()
  })

  it('discards an outstanding read after the active filesystem changes', async () => {
    const f = fixture()
    let release!: () => void
    vi.mocked(f.fs.readFile).mockImplementationOnce(() => new Promise<string>((resolve) => {
      release = () => resolve('# Old world')
    }))
    const reading = f.document.read('adv/world.md')
    await vi.waitFor(() => expect(f.fs.readFile).toHaveBeenCalled())
    f.switchFs()
    release()
    await expect(reading).rejects.toThrow('ADV_STUDIO_CONTENT_SCOPE_CHANGED')
    await expect(f.document.save('adv/world.md', '# Late draft')).rejects.toThrow('ADV_STUDIO_CONTENT_SCOPE_CHANGED')
  })

  it('does not treat an unreadable source as an empty new file', async () => {
    const f = fixture()
    vi.mocked(f.fs.readFile).mockRejectedValueOnce(new Error('Permission unknown'))
    await expect(f.document.read('adv/world.md')).rejects.toThrow('Permission unknown')
    await expect(f.document.save('adv/world.md', '')).rejects.toThrow('ADV_STUDIO_CONTENT_SCOPE_CHANGED')
    expect(f.fs.writeFile).not.toHaveBeenCalled()
  })

  it('permits explicit creation from known absence and rejects a file created while the guide was open', async () => {
    const f = fixture()
    expect(await f.document.read('adv/chapters/new.adv.md')).toBeNull()
    expect(f.fs.writeFile).not.toHaveBeenCalled()
    f.files['adv/chapters/new.adv.md'] = 'Another author created it'
    await expect(f.document.save('adv/chapters/new.adv.md', '')).rejects.toThrow('ADV_STUDIO_SOURCE_CONFLICT')
    expect(await f.document.read('adv/chapters/other.adv.md')).toBeNull()
    await f.document.save('adv/chapters/other.adv.md', '')
    expect(f.files['adv/chapters/other.adv.md']).toBe('')
  })

  it('waits for a queued project adoption before opening its saved source', async () => {
    const f = fixture()
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const adoption = runStudioProjectWrite(f.fs, async () => {
      await gate
      f.files['adv/world.md'] = '# Adopted before the editor opened'
    })
    const reading = f.document.read('adv/world.md')
    await Promise.resolve()
    expect(f.fs.readFile).not.toHaveBeenCalled()
    release()
    await adoption
    expect(await reading).toBe('# Adopted before the editor opened')
  })

  it.each(['adv/../private.md', 'adv/.git/settings.json', 'adv/host.ts', '/adv/world.md'])('rejects a non-author source path: %s', async (path) => {
    const f = fixture()
    await expect(f.document.read(path)).rejects.toThrow('ADV_STUDIO_CONTENT_PATH_INVALID')
    expect(f.fs.readFile).not.toHaveBeenCalled()
  })
})
