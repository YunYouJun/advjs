import type { IFileSystem } from '../utils/fs'
import { Blob as NodeBlob } from 'node:buffer'
import { webcrypto } from 'node:crypto'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive, shallowRef } from 'vue'
import { useCloudSync } from '../composables/useCloudSync'
import { createCloudSyncWorkspace, isCloudSyncPath } from '../utils/cloudSyncWorkspace'
import { MemoryFsAdapter } from '../utils/fs/MemoryFsAdapter'
import { observeStudioFileSystem } from '../utils/fs/mutations'

const storage = vi.hoisted(() => ({ rows: new Map<string, any>(), failNext: false }))
const remote = vi.hoisted(() => ({ list: vi.fn(), download: vi.fn(), upload: vi.fn() }))
vi.mock('../utils/db', () => ({ db: {
  table: () => ({
    where: () => ({ startsWith: (prefix: string) => ({ toArray: async () => [...storage.rows].filter(([key]) => key.startsWith(prefix)).map(([, row]) => row) }) }),
    async bulkDelete(keys: string[]) { keys.forEach(key => storage.rows.delete(key)) },
    async bulkPut(rows: any[]) {
      if (storage.failNext) {
        storage.failNext = false
        throw new Error('storage unavailable')
      }
      rows.forEach(row => storage.rows.set(row.key, row))
    },
  }),
  async transaction(_mode: string, _table: unknown, operation: () => Promise<void>) {
    const before = new Map(storage.rows)
    try {
      return await operation()
    }
    catch (error) {
      storage.rows = before
      throw error
    }
  },
} }))
vi.mock('../utils/cloudSync', async original => ({ ...await original<object>(), listCloudFilesDetailed: remote.list, downloadBlobFromCloud: remote.download, uploadToCloud: remote.upload }))
const studio = reactive({ currentProject: { projectId: 'station', name: 'Station', syncedAt: undefined as number | undefined }, updateProject: vi.fn() })
const auth = reactive({ userId: 'author1' })
const settings = reactive({ cos: { bucket: 'managed', region: 'cn', autoSave: true, autoSync: false, syncInterval: 5 } })
const currentFs = shallowRef<IFileSystem | null>(null)
vi.mock('../stores/useStudioStore', () => ({ useStudioStore: () => studio }))
vi.mock('../stores/useAuthStore', () => ({ useAuthStore: () => auth }))
vi.mock('../stores/useSettingsStore', () => ({ useSettingsStore: () => settings }))
vi.mock('../composables/useProjectContent', () => ({ useProjectContent: () => ({ getFs: () => currentFs.value, whenReady: async () => {} }) }))

const path = 'adv/chapter.adv.md'
const mediaPath = 'public/voice.wav'
let wrapper: ReturnType<typeof mount> | undefined
function gate<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((accept) => {
    resolve = accept
  })
  return { promise, resolve }
}
function cloudFile(path: string) {
  return { key: `Station/${path}`, lastModified: new Date(Date.now() + 60_000).toISOString(), size: 4 }
}
async function fixture(files = { [path]: 'Author source' }) {
  const fs = observeStudioFileSystem(new MemoryFsAdapter('station'))
  for (const [path, content] of Object.entries(files))
    await fs.writeFile(path, content)
  await fs.flush!()
  currentFs.value = fs
  let sync!: ReturnType<typeof useCloudSync>
  wrapper = mount({ setup() {
    sync = useCloudSync()
    return () => null
  } })
  remote.list.mockResolvedValue([cloudFile(path)])
  remote.download.mockResolvedValue(new Blob(['Cloud source']))
  remote.upload.mockResolvedValue(undefined)
  return { fs, sync }
}
async function reopened() {
  const fs = new MemoryFsAdapter('station')
  await fs.init()
  return fs
}

beforeEach(() => {
  vi.stubGlobal('Blob', NodeBlob)
  vi.stubGlobal('crypto', webcrypto)
  storage.rows.clear()
  storage.failNext = false
  vi.clearAllMocks()
  studio.currentProject = { projectId: 'station', name: 'Station', syncedAt: undefined }
  auth.userId = 'author1'
  currentFs.value = null
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('cloud sync local adoption', () => {
  it('durably adopts text and binary together through the shared editor adapter', async () => {
    const { fs, sync } = await fixture()
    remote.list.mockResolvedValue([cloudFile(path), cloudFile(mediaPath)])
    remote.download.mockImplementation(async (_config, key) => key.endsWith('.wav') ? new Blob([new Uint8Array([0, 128, 255])], { type: 'audio/wav' }) : new Blob(['Cloud source']))
    const start = Date.now()
    expect(await sync.performSync()).toEqual({ uploaded: 0, downloaded: 2, conflicts: 0, failed: [] })
    expect(await fs.readFile(path)).toBe('Cloud source')
    const restored = await reopened()
    expect(await restored.readFile(path)).toBe('Cloud source')
    expect([...new Uint8Array(await (await restored.readBlob(mediaPath)).arrayBuffer())]).toEqual([0, 128, 255])
    expect(sync.syncStatus.value).toBe('success')
    expect(studio.updateProject).toHaveBeenCalledWith('station', { syncedAt: expect.any(Number) })
    expect(studio.updateProject.mock.calls[0]![1].syncedAt).toBeGreaterThanOrEqual(start)
  })

  it('preserves an author edit during download and retains fetched bytes for a new review', async () => {
    const { fs, sync } = await fixture()
    const entered = gate<void>()
    const download = gate<Blob>()
    remote.download.mockImplementation(() => {
      entered.resolve()
      return download.promise
    })
    const pending = sync.performSync()
    await entered.promise
    await fs.writeFile(path, 'New author draft')
    download.resolve(new Blob(['Cloud source']))
    expect(await pending).toMatchObject({ downloaded: 0, conflicts: 1 })
    expect(await fs.readFile(path)).toBe('New author draft')
    expect(sync.pendingConflicts.value[0]).toMatchObject({ localContent: 'New author draft', cloudContent: 'Cloud source' })
    expect(studio.updateProject).not.toHaveBeenCalled()
    expect(sync.syncStatus.value).toBe('failed')
    expect(await sync.resolveConflicts(new Map([[path, 'use-cloud']]))).toEqual({ resolved: 1, skipped: 0 })
    expect(await (await reopened()).readFile(path)).toBe('Cloud source')
    // Earlier failures require a complete re-sync before a new baseline.
    expect(studio.updateProject).not.toHaveBeenCalled()
    expect(remote.download).toHaveBeenCalledTimes(1)
  })

  it('aborts a whole source/media batch on persistence failure and reuses its candidates', async () => {
    const { sync } = await fixture()
    remote.list.mockResolvedValue([cloudFile(path), cloudFile(mediaPath)])
    remote.download.mockImplementation(async () => {
      storage.failNext = true
      return new Blob(['Cloud bytes'])
    })
    expect(await sync.performSync()).toMatchObject({ downloaded: 0, conflicts: 2 })
    const restored = await reopened()
    expect(await restored.readFile(path)).toBe('Author source')
    expect(await restored.exists(mediaPath)).toBe(false)
    expect(studio.updateProject).not.toHaveBeenCalled()
    expect(await sync.resolveConflicts(new Map([[path, 'use-cloud'], [mediaPath, 'use-cloud']]))).toEqual({ resolved: 2, skipped: 0 })
    expect(remote.download).toHaveBeenCalledTimes(2)
    expect(await (await reopened()).readFile(path)).toBe('Cloud bytes')
  })

  it('does not advance the baseline after a failed upload or conflict download', async () => {
    const { sync } = await fixture()
    remote.list.mockResolvedValue([])
    remote.upload.mockRejectedValueOnce(new Error('upload unknown'))
    expect(await sync.performSync()).toMatchObject({ uploaded: 0, failed: [path] })
    expect(sync.syncStatus.value).toBe('failed')
    studio.currentProject.syncedAt = 1
    remote.list.mockResolvedValue([cloudFile(path)])
    remote.download.mockRejectedValueOnce(new Error('offline'))
    expect(await sync.performSync()).toMatchObject({ conflicts: 0, failed: [path] })
    expect(studio.updateProject).not.toHaveBeenCalled()
  })

  it('rejects an incomplete local snapshot before sending or replacing any file', async () => {
    const { fs, sync } = await fixture()
    vi.spyOn(fs, 'readBlob').mockRejectedValue(new Error('unreadable source'))
    expect(await sync.performSync()).toMatchObject({ failed: ['*sync'] })
    expect(remote.list).not.toHaveBeenCalled()
    expect(remote.upload).not.toHaveBeenCalled()
    expect(studio.updateProject).not.toHaveBeenCalled()
  })

  it.each(['project', 'account', 'dispose'] as const)('discards late downloads after %s changes', async (change) => {
    const { fs, sync } = await fixture()
    const entered = gate<void>()
    const download = gate<Blob>()
    remote.download.mockImplementation(() => {
      entered.resolve()
      return download.promise
    })
    const pending = sync.performSync()
    await entered.promise
    if (change === 'project') {
      studio.currentProject = { projectId: 'other', name: 'Other', syncedAt: undefined }
      studio.currentProject = { projectId: 'station', name: 'Station', syncedAt: undefined }
    }
    else if (change === 'account') {
      auth.userId = 'author2'
    }
    else {
      wrapper!.unmount()
      wrapper = undefined
    }
    download.resolve(new Blob(['Late cloud source']))
    await pending
    expect(await fs.readFile(path)).toBe('Author source')
    expect(sync.pendingConflicts.value).toEqual([])
    expect(studio.updateProject).not.toHaveBeenCalled()
  })

  it('requires a new review if the source changes after opening a conflict, and retains skipped files', async () => {
    const { fs, sync } = await fixture()
    studio.currentProject.syncedAt = 1
    expect(await sync.performSync()).toMatchObject({ conflicts: 1 })
    await fs.writeFile(path, 'Changed after review')
    expect(await sync.resolveConflicts(new Map([[path, 'use-cloud']]))).toEqual({ resolved: 0, skipped: 1 })
    expect(await fs.readFile(path)).toBe('Changed after review')
    expect(sync.pendingConflicts.value[0]!.localContent).toBe('Changed after review')
    expect(await sync.resolveConflicts(new Map([[path, 'skip']]))).toEqual({ resolved: 0, skipped: 1 })
    expect(sync.pendingConflicts.value).toHaveLength(1)
    expect(await sync.performSync()).toMatchObject({ conflicts: 1 })
    expect(remote.download).toHaveBeenCalledTimes(1)
    expect(studio.updateProject).not.toHaveBeenCalled()
  })

  it.each(['use-local', 'use-cloud'] as const)('saves the baseline only after the reviewed conflict is resolved (%s)', async (choice) => {
    const { fs, sync } = await fixture()
    studio.currentProject.syncedAt = 1
    expect(await sync.performSync()).toMatchObject({ conflicts: 1 })
    expect(await sync.resolveConflicts(new Map([[path, choice]]))).toEqual({ resolved: 1, skipped: 0 })
    expect(await fs.readFile(path)).toBe(choice === 'use-local' ? 'Author source' : 'Cloud source')
    expect(sync.syncStatus.value).toBe('success')
    expect(studio.updateProject).toHaveBeenCalledTimes(1)
    expect(sync.pendingConflicts.value).toEqual([])
  })

  it('does not let an earlier save receipt clear a newer debounced draft', async () => {
    const { sync } = await fixture()
    vi.useFakeTimers()
    const upload = gate<void>()
    remote.upload.mockReturnValueOnce(upload.promise)
    const earlier = sync.saveNow(path, 'Earlier source')
    sync.autoSave(path, 'Newer draft')
    upload.resolve()
    await earlier
    expect(sync.isDirty.value).toBe(true)
    expect(sync.lastSaved.value).toBeNull()
    await vi.advanceTimersByTimeAsync(2001)
    expect(remote.upload).toHaveBeenLastCalledWith(expect.any(Object), path, 'Newer draft')
    expect(sync.isDirty.value).toBe(false)
  })

  it('cancels queued auto-save and discards a late receipt on account switch', async () => {
    const { sync } = await fixture()
    vi.useFakeTimers()
    const upload = gate<void>()
    remote.upload.mockReturnValueOnce(upload.promise)
    const earlier = sync.saveNow(path, 'Earlier account source')
    sync.autoSave(path, 'Queued old account draft')
    auth.userId = 'author2'
    upload.resolve()
    await earlier
    await vi.advanceTimersByTimeAsync(2001)
    expect(remote.upload).toHaveBeenCalledTimes(1)
    expect(sync.lastSaved.value).toBeNull()
    expect(sync.isSaving.value).toBe(false)
  })

  it('rejects unsafe/foreign cloud keys and prevents overlapping sync dispatch', async () => {
    const { sync } = await fixture()
    const entered = gate<void>()
    const list = gate<any[]>()
    remote.list.mockImplementation(() => {
      entered.resolve()
      return list.promise
    })
    const first = sync.performSync()
    await entered.promise
    expect(await sync.performSync()).toMatchObject({ downloaded: 0 })
    list.resolve([cloudFile('../escape.md'), { ...cloudFile(path), key: 'Foreign/other.md' }])
    expect(await first).toMatchObject({ failed: ['Station/../escape.md', 'Foreign/other.md'] })
    expect(remote.list).toHaveBeenCalledTimes(1)
    expect(remote.download).not.toHaveBeenCalled()
    expect(studio.updateProject).not.toHaveBeenCalled()
  })
})

describe('cloud sync with a non-transactional adapter', () => {
  it.each([false, true])('compensates only its own bytes after a later write failure (concurrent author edit: %s)', async (authorEdit) => {
    const { fs } = await fixture()
    fs.transaction = undefined
    const workspace = createCloudSyncWorkspace(fs, () => {})
    const before = await workspace.capture()
    vi.spyOn(fs, 'writeBlob').mockImplementation(async () => {
      if (authorEdit)
        await fs.writeFile(path, 'Concurrent author source')
      throw new Error('native write failed')
    })
    await expect(workspace.apply(before, new Map([[path, new Blob(['Cloud source'])], [mediaPath, new Blob(['Cloud audio'])]]))).rejects.toThrow('native write failed')
    expect(await (await reopened()).readFile(path)).toBe(authorEdit ? 'Concurrent author source' : 'Author source')
    expect(await (await reopened()).exists(mediaPath)).toBe(false)
  })
})

it('accepts ordinary hidden files without allowing hidden directories or path traversal', () => {
  expect(isCloudSyncPath('.gitignore')).toBe(true)
  expect(isCloudSyncPath('adv/.project.json')).toBe(true)
  expect(isCloudSyncPath('.git/config')).toBe(false)
  expect(isCloudSyncPath('adv/../private.md')).toBe(false)
  expect(isCloudSyncPath('/absolute.md')).toBe(false)
})
