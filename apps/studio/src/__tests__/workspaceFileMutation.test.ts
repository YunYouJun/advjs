import type { IFileSystem } from '../utils/fs'
import type { WorkspaceFileEntry } from '../utils/workspaceFileSnapshot'
import type { WorkspaceMutationRecord } from '../utils/workspaceMutationJournal'
import { Blob as NodeBlob } from 'node:buffer'
import { webcrypto } from 'node:crypto'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createStudioCreativeWorkspace } from '../utils/creativeTeamWorkspace'
import { assertStudioProjectReady, runStudioProjectWrite, setStudioProjectWriteBarrier, whenStudioProjectWritesSettle } from '../utils/projectWriteQueue'
import { commitWorkspaceFileMutation, recoverWorkspaceFileMutation, reviewWorkspaceMutation } from '../utils/workspaceFileMutation'
import { snapshotWorkspaceFiles, validateWorkspaceEntries, workspaceBytesHash } from '../utils/workspaceFileSnapshot'

const journal = vi.hoisted(() => ({ rows: new Map<string, WorkspaceMutationRecord>(), failPersist: false, failRemove: 0, onPersist: undefined as undefined | ((record: WorkspaceMutationRecord) => void) }))
vi.mock('../utils/workspaceMutationJournal', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/workspaceMutationJournal')>()
  return {
    ...actual,
    async persistWorkspaceMutationRecord(record: WorkspaceMutationRecord) {
      await actual.validateWorkspaceMutationRecord(record)
      if (journal.failPersist)
        throw new Error('Journal capacity failure')
      journal.onPersist?.(record)
      journal.rows.set(record.id, record)
    },
    async removeWorkspaceMutationRecord(id: string) {
      if (journal.failRemove-- > 0)
        throw new Error('Journal cleanup failed')
      journal.rows.delete(id)
    },
    async assertWorkspaceMutationRecorded(record: WorkspaceMutationRecord) {
      if (!journal.rows.has(record.id))
        throw new Error('ADV_STUDIO_SOURCE_CONFLICT')
    },
  }
})
beforeAll(() => {
  vi.stubGlobal('Blob', NodeBlob)
  vi.stubGlobal('crypto', webcrypto)
})
beforeEach(() => {
  journal.rows.clear()
  journal.failPersist = false
  journal.failRemove = 0
  journal.onPersist = undefined
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
  return { files, dirs, fs }
}

async function record(kind: WorkspaceMutationRecord['kind'], roots: string[], before: WorkspaceFileEntry[], after: WorkspaceFileEntry[], drafts: WorkspaceMutationRecord['drafts'] = []): Promise<WorkspaceMutationRecord> {
  const bytes = await validateWorkspaceEntries(roots, before, drafts) + await validateWorkspaceEntries(roots, after)
  return { id: crypto.randomUUID(), projectId: 'unit', createdAt: Date.now(), root: { isSameEntry: async () => true } as unknown as FileSystemDirectoryHandle, kind, roots, before, after, drafts, bytes }
}
async function deleting(f: ReturnType<typeof fixture>, roots = ['README.md']) {
  return record('delete', roots, await snapshotWorkspaceFiles(f.fs, roots), [])
}
async function importing(path = 'import.md') {
  const data = await new Blob(['Imported saved bytes']).arrayBuffer()
  return record('import', [path], [], [{ path, kind: 'file', data, sha256: await workspaceBytesHash(data) }])
}
function check() {}

describe('journaled native workspace mutations', () => {
  it('persists exact originals before removing files, binary bytes, and empty directories', async () => {
    const f = fixture()
    const intent = await deleting(f, ['adv'])
    journal.onPersist = () => {
      expect(f.fs.deleteFile).not.toHaveBeenCalled()
      expect(f.fs.rmdir).not.toHaveBeenCalled()
      expect(intent.before.find(entry => entry.path === 'adv/master.bin')!.data!.byteLength).toBe(4)
    }
    await commitWorkspaceFileMutation(f.fs, async () => intent, { check })
    expect(f.dirs.has('adv')).toBe(false)
    expect(f.files.has('adv/world.md')).toBe(false)
    expect(journal.rows.size).toBe(0)
    expect(() => assertStudioProjectReady(f.fs)).not.toThrow()
    expect(vi.mocked(f.fs.rmdir).mock.calls.every(([, options]) => options?.recursive === false)).toBe(true)
  })

  it('does not create even an empty native file when the journal cannot be committed', async () => {
    const f = fixture()
    journal.failPersist = true
    await expect(commitWorkspaceFileMutation(f.fs, () => importing(), { check })).rejects.toThrow('Journal capacity failure')
    expect(f.fs.writeBlob).not.toHaveBeenCalled()
    expect(f.fs.deleteFile).not.toHaveBeenCalled()
    expect(f.files.has('import.md')).toBe(false)
  })

  it('rejects source changes and new directory children before recording or deleting anything', async () => {
    const f = fixture()
    const intent = await deleting(f, ['adv'])
    f.files.set('adv/author.md', new Blob(['New child while confirming']))
    await expect(commitWorkspaceFileMutation(f.fs, async () => intent, { check })).rejects.toThrow('ADV_STUDIO_SOURCE_CONFLICT')
    expect(journal.rows.size).toBe(0)
    expect(f.fs.deleteFile).not.toHaveBeenCalled()
    expect(await f.fs.readFile('adv/author.md')).toBe('New child while confirming')
  })

  it('discards an unused intent when the source changes during journal persistence', async () => {
    const f = fixture()
    const intent = await deleting(f)
    journal.onPersist = () => f.files.set('README.md', new Blob(['New author during journal write']))
    await expect(commitWorkspaceFileMutation(f.fs, async () => intent, { check })).rejects.toThrow('ADV_STUDIO_SOURCE_CONFLICT')
    expect(await f.fs.readFile('README.md')).toBe('New author during journal write')
    expect(f.fs.deleteFile).not.toHaveBeenCalled()
    expect(journal.rows.size).toBe(0)
    expect(() => assertStudioProjectReady(f.fs)).not.toThrow()
  })

  it('restores a removal that persisted then failed without applying a private receipt', async () => {
    const f = fixture()
    const intent = await deleting(f)
    const applied = vi.fn()
    const rollbackApplied = vi.fn()
    vi.mocked(f.fs.deleteFile).mockImplementationOnce(async (path) => {
      f.files.delete(path)
      throw new Error('Native removal persisted')
    })
    await expect(commitWorkspaceFileMutation(f.fs, async () => intent, { check, applied, rollbackApplied })).rejects.toThrow('Native removal persisted')
    expect(await f.fs.readFile('README.md')).toBe('Original README')
    expect(journal.rows.size).toBe(0)
    expect(applied).not.toHaveBeenCalled()
    expect(rollbackApplied).not.toHaveBeenCalled()
  })

  it('restores both native files and a private receipt if final journal cleanup fails', async () => {
    const f = fixture()
    const intent = await deleting(f)
    const applied = vi.fn()
    const rollbackApplied = vi.fn()
    journal.failRemove = 1
    await expect(commitWorkspaceFileMutation(f.fs, async () => intent, { check, applied, rollbackApplied })).rejects.toThrow('Journal cleanup failed')
    expect(await f.fs.readFile('README.md')).toBe('Original README')
    expect(applied).toHaveBeenCalledOnce()
    expect(rollbackApplied).toHaveBeenCalledOnce()
    expect(journal.rows.size).toBe(0)
  })

  it('preserves new author bytes and original preimages while gating writes and creative facts', async () => {
    const f = fixture()
    const intent = await deleting(f)
    vi.mocked(f.fs.deleteFile).mockImplementationOnce(async (path) => {
      f.files.set(path, new Blob(['Independent author after removal']))
      throw new Error('Native removal failed late')
    })
    await expect(commitWorkspaceFileMutation(f.fs, async () => intent, { check })).rejects.toThrow('ADV_STUDIO_WORKSPACE_RECOVERY_REQUIRED')
    expect(await f.fs.readFile('README.md')).toBe('Independent author after removal')
    expect(new TextDecoder().decode(journal.rows.get(intent.id)!.before[0]!.data)).toBe('Original README')
    const laterWrite = vi.fn(async () => {})
    await expect(runStudioProjectWrite(f.fs, laterWrite)).rejects.toThrow('ADV_STUDIO_WORKSPACE_RECOVERY_REQUIRED')
    await expect(whenStudioProjectWritesSettle(f.fs)).rejects.toThrow('ADV_STUDIO_WORKSPACE_RECOVERY_REQUIRED')
    await expect(createStudioCreativeWorkspace(f.fs, 'unit').snapshot()).rejects.toThrow('ADV_STUDIO_WORKSPACE_RECOVERY_REQUIRED')
    expect(laterWrite).not.toHaveBeenCalled()
  })

  it('restores other missing originals even when another author prevents complete compensation', async () => {
    const f = fixture()
    const intent = await deleting(f, ['README.md', 'adv/world.md'])
    const remove = vi.mocked(f.fs.deleteFile).getMockImplementation()!
    vi.mocked(f.fs.deleteFile).mockImplementation(async (path) => {
      await remove(path)
      if (path === 'README.md') {
        f.files.set(path, new Blob(['Independent new README']))
        throw new Error('Late failure after both removals')
      }
    })
    await expect(commitWorkspaceFileMutation(f.fs, async () => intent, { check })).rejects.toThrow('ADV_STUDIO_WORKSPACE_RECOVERY_REQUIRED')
    expect(await f.fs.readFile('README.md')).toBe('Independent new README')
    expect(await f.fs.readFile('adv/world.md')).toBe('Original world')
    expect(journal.rows.has(intent.id)).toBe(true)
  })

  it('retains imported bytes in the journal when an independent replacement prevents cleanup', async () => {
    const f = fixture()
    const intent = await importing()
    vi.mocked(f.fs.writeBlob).mockImplementationOnce(async (path) => {
      f.files.set(path, new Blob(['Independent import-path replacement']))
      throw new Error('Persisted before failure')
    })
    await expect(commitWorkspaceFileMutation(f.fs, async () => intent, { check })).rejects.toThrow('ADV_STUDIO_WORKSPACE_RECOVERY_REQUIRED')
    expect(await f.fs.readFile('import.md')).toBe('Independent import-path replacement')
    expect(new TextDecoder().decode(journal.rows.get(intent.id)!.after[0]!.data)).toBe('Imported saved bytes')
  })

  it('restores interrupted originals through an exact reviewed recovery while ordinary writes remain gated', async () => {
    const f = fixture()
    const intent = await deleting(f)
    journal.rows.set(intent.id, intent)
    f.files.delete('README.md')
    setStudioProjectWriteBarrier(f.fs, 'ADV_STUDIO_WORKSPACE_RECOVERY_REQUIRED')
    const reviewed = await reviewWorkspaceMutation(f.fs, intent, check)
    expect(reviewed).toEqual([])
    const applied = vi.fn()
    await recoverWorkspaceFileMutation(f.fs, intent, reviewed, 'restore', { check, applied })
    expect(await f.fs.readFile('README.md')).toBe('Original README')
    expect(applied).toHaveBeenCalledOnce()
    expect(journal.rows.size).toBe(0)
    expect(() => assertStudioProjectReady(f.fs)).not.toThrow()
  })

  it.each(['restore', 'keep'] as const)('rejects an author change after a %s recovery review without discarding the backup', async (mode) => {
    const f = fixture()
    const intent = await deleting(f)
    journal.rows.set(intent.id, intent)
    setStudioProjectWriteBarrier(f.fs, 'ADV_STUDIO_WORKSPACE_RECOVERY_REQUIRED')
    const reviewed = await reviewWorkspaceMutation(f.fs, intent, check)
    f.files.set('README.md', new Blob(['New author after recovery review']))
    await expect(recoverWorkspaceFileMutation(f.fs, intent, reviewed, mode, { check })).rejects.toThrow('ADV_STUDIO_SOURCE_CONFLICT')
    expect(await f.fs.readFile('README.md')).toBe('New author after recovery review')
    expect(journal.rows.has(intent.id)).toBe(true)
  })

  it('lets the author keep an exact reviewed state and release its recovery barrier', async () => {
    const f = fixture()
    const intent = await deleting(f)
    journal.rows.set(intent.id, intent)
    f.files.set('README.md', new Blob(['Reviewed current author version']))
    setStudioProjectWriteBarrier(f.fs, 'ADV_STUDIO_WORKSPACE_RECOVERY_REQUIRED')
    const reviewed = await reviewWorkspaceMutation(f.fs, intent, check)
    await recoverWorkspaceFileMutation(f.fs, intent, reviewed, 'keep', { check })
    expect(await f.fs.readFile('README.md')).toBe('Reviewed current author version')
    expect(journal.rows.size).toBe(0)
    expect(() => assertStudioProjectReady(f.fs)).not.toThrow()
  })

  it('rejects an already discarded recovery record before touching any project files', async () => {
    const f = fixture()
    const intent = await deleting(f)
    await expect(recoverWorkspaceFileMutation(f.fs, intent, [], 'restore', { check })).rejects.toThrow('ADV_STUDIO_SOURCE_CONFLICT')
    expect(f.fs.writeBlob).not.toHaveBeenCalled()
    expect(f.fs.deleteFile).not.toHaveBeenCalled()
  })

  it('rejects corrupt byte receipts and invalid create/delete combinations before persistence', async () => {
    const f = fixture()
    const intent = await importing()
    intent.after[0]!.sha256 = 'corrupt'
    await expect(commitWorkspaceFileMutation(f.fs, async () => intent, { check })).rejects.toThrow('ADV_STUDIO_WORKSPACE_JOURNAL_INVALID')
    expect(f.fs.writeBlob).not.toHaveBeenCalled()
    expect(journal.rows.size).toBe(0)
  })
})
