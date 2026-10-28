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
    }
    finally {
      scope.stop()
    }
  })
})
