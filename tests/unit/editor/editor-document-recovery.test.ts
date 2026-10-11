import type { ProjectWorkspace } from '../../../editor/core/app/workspaces/project'
import { createPinia, disposePinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, reactive } from 'vue'
import { useFileStore } from '../../../editor/core/app/stores/useFileStore'
import { useProjectDrafts } from '../../../editor/core/app/stores/useProjectDrafts'
import { readDocumentRecovery, writeDocumentRecovery } from '../../../editor/core/app/workspaces/document-recovery'

let pinia: ReturnType<typeof createPinia>
let monaco: { fileContent: string, language: string }
let project: any
const handle = (content: string) => ({ name: 'story.md', getFile: async () => ({ text: async () => content }) }) as FileSystemFileHandle
const saved = (base = 'original', content = 'draft') => ({ version: 1 as const, selected: 'story.md', source: { path: 'story.md', base, content }, forms: {} })
beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
  monaco = reactive({ fileContent: '', language: 'plaintext' })
  project = reactive({ workspace: {}, getLocalFileHandle: vi.fn(async () => handle('original')), writeProjectFiles: vi.fn(async () => {}) })
  vi.stubGlobal('useProjectStore', () => project)
  vi.stubGlobal('useFileStore', useFileStore)
  vi.stubGlobal('useMonacoStore', () => monaco)
  vi.stubGlobal('useGameStore', () => ({ gameConfig: {} }))
  vi.stubGlobal('useConsoleStore', () => ({ success: vi.fn(), warn: vi.fn() }))
  vi.stubGlobal('useAppStore', () => reactive({ activeInspector: undefined }))
})
afterEach(() => {
  disposePinia(pinia)
  localStorage.clear()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})
describe('noncredential document recovery', () => {
  it('restores the original base and requires explicit conflict resolution before overwrite', async () => {
    writeDocumentRecovery('a', saved(), localStorage)
    project.getLocalFileHandle.mockResolvedValue(handle('external'))
    await useProjectDrafts().activate(project.workspace, 'a')
    const file = useFileStore()
    expect(monaco.fileContent).toBe('draft')
    expect(file.externalConflict).toEqual({ path: 'story.md', content: 'external' })
    await expect(file.saveOpenedFile()).rejects.toThrow('Resolve')
    expect(project.writeProjectFiles).not.toHaveBeenCalled()
    await file.keepLocalChange()
    expect(project.writeProjectFiles).toHaveBeenCalledWith([{ path: 'story.md', content: 'draft', expected: 'external' }])
  })
  it('restores an unchanged source as dirty and saves against its original revision', async () => {
    writeDocumentRecovery('a', saved(), localStorage)
    await useProjectDrafts().activate(project.workspace, 'a')
    const file = useFileStore()
    expect(file.isDirty).toBe(true)
    expect(file.externalConflict).toBeUndefined()
    await expect(file.setOpenedFileHandle(handle('another'), 'other.md')).rejects.toThrow('Save or discard')
    await file.saveOpenedFile()
    expect(project.writeProjectFiles).toHaveBeenCalledWith([{ path: 'story.md', content: 'draft', expected: 'original' }])
    await nextTick()
    expect(readDocumentRecovery('a', localStorage).source).toBeUndefined()
  })

  it('ignores restoration superseded while the source contents are still loading', async () => {
    writeDocumentRecovery('a', saved(), localStorage)
    let finish!: (value: { text: () => Promise<string> }) => void
    project.getLocalFileHandle.mockResolvedValue({ name: 'story.md', getFile: () => new Promise(resolve => finish = resolve) })
    const pending = useProjectDrafts().activate(project.workspace, 'a')
    await nextTick()
    await useFileStore().setOpenedFileHandle(handle('other'), 'other.md')
    finish({ text: async () => 'original' })
    await pending
    expect(useFileStore().openedFilePath).toBe('other.md')
    expect(monaco.fileContent).toBe('other')
  })

  it('recovers a deleted draft without writing until an explicit keep-local choice', async () => {
    writeDocumentRecovery('a', saved(), localStorage)
    project.getLocalFileHandle.mockRejectedValue(new DOMException('missing', 'NotFoundError'))
    await useProjectDrafts().activate(project.workspace, 'a')
    expect(useFileStore().externalConflict?.content).toBeNull()
    expect(monaco.fileContent).toBe('draft')
    await useFileStore().keepLocalChange()
    expect(project.writeProjectFiles).toHaveBeenCalledWith([{ path: 'story.md', content: 'draft', expected: null }])
  })
  it('cannot revive a stale selection after switching projects during a handle read', async () => {
    writeDocumentRecovery('a', saved(), localStorage)
    let finish!: (value: FileSystemFileHandle) => void
    project.getLocalFileHandle.mockImplementation(() => new Promise(resolve => finish = resolve))
    const pending = useProjectDrafts().activate(project.workspace, 'a')
    project.workspace = {} as ProjectWorkspace
    await useProjectDrafts().activate(project.workspace, 'b')
    finish(handle('original'))
    await pending
    expect(useFileStore().openedFilePath).toBe('')
    expect(monaco.fileContent).toBe('')
  })
  it('does not overwrite an intervening selection or newly typed draft', async () => {
    writeDocumentRecovery('a', saved(), localStorage)
    let finish!: (value: FileSystemFileHandle) => void
    project.getLocalFileHandle.mockImplementation(() => new Promise(resolve => finish = resolve))
    const pending = useProjectDrafts().activate(project.workspace, 'a')
    await useFileStore().setOpenedFileHandle(handle('other'), 'other.md')
    monaco.fileContent = 'new work'
    finish(handle('original'))
    await pending
    expect(useFileStore().openedFilePath).toBe('other.md')
    expect(monaco.fileContent).toBe('new work')
  })
  it('persists only selected path and markdown source, isolating identical paths and character drafts', async () => {
    const drafts = useProjectDrafts()
    await drafts.activate(project.workspace, 'a')
    await useFileStore().setOpenedFileHandle(handle('original'), 'story.md')
    monaco.fileContent = 'work'
    drafts.saveFormDraft('character:create', { base: null, content: '{"name":"A"}' })
    await nextTick()
    expect(readDocumentRecovery('a', localStorage).source).toEqual({ path: 'story.md', base: 'original', content: 'work' })
    expect(readDocumentRecovery('b', localStorage).source).toBeUndefined()
    project.workspace = {}
    await drafts.activate(project.workspace, 'b')
    expect(drafts.formDraft('character:create')).toBeUndefined()
    drafts.saveFormDraft('character:create', { base: null, content: 'stale' }, 'a')
    expect(drafts.formDraft('character:create')).toBeUndefined()
    await useFileStore().setOpenedFileHandle(handle('secret'), '.env')
    monaco.fileContent = 'token'
    await nextTick()
    expect(localStorage.getItem('advjs:editor:documents:b')).not.toContain('token')
  })
  it('restores clean selections from current disk and never persists object URLs or bridge credentials', async () => {
    writeDocumentRecovery('a', { version: 1, selected: 'portrait.png', forms: {} }, localStorage)
    vi.stubGlobal('URL', class extends URL {
      static createObjectURL = vi.fn(() => 'blob:recovered')
      static revokeObjectURL = vi.fn()
    })
    project.workspace = { readAsset: vi.fn(async () => new Blob(['image'])) }
    await useProjectDrafts().activate(project.workspace, 'a')
    expect(useFileStore().previewUrl).toBe('blob:recovered')
    project.workspace = {}
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:recovered')
    writeDocumentRecovery('b', { version: 1, selected: 'story.md', forms: {} }, localStorage)
    project.getLocalFileHandle.mockResolvedValue(handle('new disk'))
    await useProjectDrafts().activate(project.workspace, 'b')
    expect(monaco.fileContent).toBe('new disk')
    expect(useFileStore().isDirty).toBe(false)
    expect(localStorage.getItem('advjs:editor:documents:a')).not.toContain('blob:')
    expect(Object.keys(localStorage).some(key => /token|session/iu.test(key))).toBe(false)
  })

  it('retains recovery when disk access fails and tolerates corrupt or unavailable storage', async () => {
    localStorage.setItem('advjs:editor:documents:bad', '{broken')
    expect(readDocumentRecovery('bad', localStorage)).toEqual({ version: 1, forms: {} })
    expect(readDocumentRecovery('bad', { getItem() {
      throw new Error('blocked')
    } })).toEqual({ version: 1, forms: {} })
    writeDocumentRecovery('a', saved(), localStorage)
    project.getLocalFileHandle.mockRejectedValue(new DOMException('blocked', 'NotAllowedError'))
    await useProjectDrafts().activate(project.workspace, 'a')
    expect(useProjectDrafts().recoveryError).toContain('could not be restored')
    expect(readDocumentRecovery('a', localStorage).source?.content).toBe('draft')
    expect(useFileStore().openedFilePath).toBe('')
    window.dispatchEvent(new Event('pagehide'))
    expect(readDocumentRecovery('a', localStorage).source?.content).toBe('draft')
  })
})

it('does not restore a failed keep-local conflict into another project at the same path', async () => {
  writeDocumentRecovery('a', saved(), localStorage)
  project.getLocalFileHandle.mockResolvedValue(handle('external A'))
  await useProjectDrafts().activate(project.workspace, 'a')
  let fail!: (error: Error) => void
  project.writeProjectFiles.mockImplementation(() => new Promise((_resolve, reject) => fail = reject))
  const saving = useFileStore().keepLocalChange().catch(() => {})
  project.workspace = {}
  await useProjectDrafts().activate(project.workspace, 'b')
  await useFileStore().setOpenedFileHandle(handle('B'), 'story.md')
  fail(new Error('A failed'))
  await saving
  expect(useFileStore().externalConflict).toBeUndefined()
  expect(monaco.fileContent).toBe('B')
})

it('roundtrips an edited source through a fresh Pinia lifetime without writing disk', async () => {
  await useProjectDrafts().activate(project.workspace, 'a')
  await useFileStore().setOpenedFileHandle(handle('original'), 'story.md')
  monaco.fileContent = 'unsaved after reload'
  await nextTick()
  disposePinia(pinia)
  pinia = createPinia()
  setActivePinia(pinia)
  monaco.fileContent = ''
  await useProjectDrafts().activate(project.workspace, 'a')
  expect(monaco.fileContent).toBe('unsaved after reload')
  expect(useFileStore().isDirty).toBe(true)
  expect(project.writeProjectFiles).not.toHaveBeenCalled()
})

it('keeps the live source and reports denied recovery writes', async () => {
  await useProjectDrafts().activate(project.workspace, 'a')
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('denied', 'SecurityError')
  })
  await useFileStore().setOpenedFileHandle(handle('original'), 'story.md')
  monaco.fileContent = 'still here'
  await nextTick()
  expect(monaco.fileContent).toBe('still here')
  expect(useFileStore().isDirty).toBe(true)
  expect(useProjectDrafts().recoveryError).toContain('unavailable')
})

it('clears a form draft only when its persisted revision still matches', async () => {
  const drafts = useProjectDrafts()
  await drafts.activate(project.workspace, 'a')
  drafts.saveFormDraft('character:edit:hero', { base: 'base', content: 'new revision' })
  drafts.saveFormDraft('character:edit:hero', undefined, 'a', 'old revision')
  expect(drafts.formDraft('character:edit:hero')?.content).toBe('new revision')
  drafts.saveFormDraft('character:edit:hero', undefined, 'a', 'new revision')
  expect(drafts.formDraft('character:edit:hero')).toBeUndefined()
})
