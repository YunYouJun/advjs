import type { IFileSystem } from '../utils/fs'
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { effectScope, reactive, ref } from 'vue'
import { useProjectContent } from '../composables/useProjectContent'

const mocks = vi.hoisted(() => ({ createFs: vi.fn() }))
let store: { currentProject: null | { projectId: string } }
vi.mock('../stores/useStudioStore', () => ({ useStudioStore: () => store }))
vi.mock('../stores/useSettingsStore', () => ({ useSettingsStore: () => ({ cos: {} }) }))
vi.mock('../utils/fs', () => ({ createFsForProject: mocks.createFs, AUDIO_EXTENSIONS: [] }))
vi.mock('../utils/projectRuntimeFiles', () => ({ discoverRuntimeChapterFiles: async () => [] }))
vi.mock('../composables/useKnowledgeBase', () => ({ useKnowledgeBase: () => ({ entries: ref([]), loadFromFs: async () => {}, watchForChangesFs: () => {}, $reset: () => {} }) }))

describe('native project readiness', () => {
  it('waits for the queued current-project watcher and the actual filesystem before reporting ready', async () => {
    store = reactive({ currentProject: null })
    let resolveFs!: (fs: IFileSystem) => void
    mocks.createFs.mockReturnValue(new Promise<IFileSystem>((resolve) => {
      resolveFs = resolve
    }))
    const scope = effectScope()
    const content = scope.run(useProjectContent)!
    try {
      store.currentProject = { projectId: 'restored-project' }
      // Callers see the new project immediately, before its loader watcher runs.
      let settled = false
      const ready = content.whenReady().then(() => {
        settled = true
      })
      await flushPromises()
      expect(mocks.createFs).toHaveBeenCalledOnce()
      expect(content.getFs()).toBeNull()
      expect(settled).toBe(false)
      const fs = { listFiles: async () => [], listFilesByExts: async () => [], exists: async () => false } as unknown as IFileSystem
      resolveFs(fs)
      await ready
      expect(content.getFs()).toBe(fs)
      let resolveOlder!: (fs: IFileSystem) => void
      let resolveNewer!: (fs: IFileSystem) => void
      mocks.createFs.mockImplementationOnce(() => new Promise<IFileSystem>((resolve) => {
        resolveOlder = resolve
      }))
      mocks.createFs.mockImplementationOnce(() => new Promise<IFileSystem>((resolve) => {
        resolveNewer = resolve
      }))
      store.currentProject = { projectId: 'older-project' }
      await flushPromises()
      store.currentProject = { projectId: 'newer-project' }
      const newerReady = content.whenReady()
      await flushPromises()
      const newerFs = { ...fs }
      resolveNewer(newerFs)
      await newerReady
      expect(content.getFs()).toBe(newerFs)
      resolveOlder({ ...fs })
      await flushPromises()
      expect(content.getFs()).toBe(newerFs)
      const previousFs = {
        ...fs,
        listFiles: async (dir: string) => dir === 'adv/characters' ? ['adv/characters/previous.character.md'] : [],
        readFile: async () => '---\nid: previous\nname: Previous project character\n---\n',
      } as unknown as IFileSystem
      mocks.createFs.mockResolvedValueOnce(previousFs)
      store.currentProject = { projectId: 'previous-populated-project' }
      await content.whenReady()
      expect(content.characters.value[0]!.id).toBe('previous')
      let releaseOldRead!: (value: string) => void
      const oldReader = {
        ...fs,
        listFiles: async (dir: string) => dir === 'adv/characters' ? ['adv/characters/old.character.md'] : [],
        readFile: vi.fn(() => new Promise<string>(resolve => releaseOldRead = resolve)),
      } as unknown as IFileSystem
      mocks.createFs.mockResolvedValueOnce(oldReader)
      store.currentProject = { projectId: 'slow-source-reader' }
      await vi.waitFor(() => expect(oldReader.readFile).toHaveBeenCalled())
      expect(content.characters.value).toEqual([])
      const finalFs = { ...fs }
      mocks.createFs.mockResolvedValueOnce(finalFs)
      store.currentProject = { projectId: 'final-current-reader' }
      await content.whenReady()
      releaseOldRead('---\nid: old\nname: Old project character\n---\n')
      await flushPromises()
      expect(content.getFs()).toBe(finalFs)
      expect(content.characters.value).toEqual([])
      expect(content.stats.value.characters).toBe(0)
    }
    finally {
      scope.stop()
    }
  })
})
