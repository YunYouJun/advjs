import type { EditorProjectModel } from '../../../editor/core/app/adapters/browser/project'
import type { ProjectFileChange } from '../../../editor/core/app/workspaces/project'
import { createPinia, disposePinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive, shallowReactive } from 'vue'
import { compileEditorProject } from '../../../editor/core/app/adapters/browser/project'
import { useContentCreationStore } from '../../../editor/core/app/stores/useContentCreationStore'
import { useProjectDrafts } from '../../../editor/core/app/stores/useProjectDrafts'

interface TestWorkspace {
  writeFiles: ReturnType<typeof vi.fn>
}

interface TestProjectStore {
  workspace: TestWorkspace | undefined
  project: EditorProjectModel
  isRestoringProject: boolean
  writeProjectFiles: ReturnType<typeof vi.fn<(changes: ProjectFileChange[]) => Promise<void>>>
  getLocalFileHandle: ReturnType<typeof vi.fn<(path: string) => Promise<FileSystemFileHandle>>>
}

interface TestFileStore {
  isDirty: boolean
  loading: boolean
  openedFilePath: string
  content: string
  setOpenedFileHandle: ReturnType<typeof vi.fn<(handle: FileSystemFileHandle, path: string) => Promise<void>>>
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (cause: Error) => void
  const promise = new Promise<T>((done, fail) => {
    resolve = done
    reject = fail
  })
  return { promise, resolve, reject }
}

function fileHandle(path: string, content = '# Created\n') {
  return {
    name: path.split('/').at(-1),
    getFile: vi.fn(async () => ({ text: async () => content })),
  } as unknown as FileSystemFileHandle
}

let pinia: ReturnType<typeof createPinia>
let project: TestProjectStore
let file: TestFileStore

beforeEach(async () => {
  pinia = createPinia()
  setActivePinia(pinia)
  const files = {
    'adv.config.json': '{"format":"adv-md","root":"adv"}\n',
    'adv/chapters/intro.adv.md': '# Intro\n\n> Begin.\n',
  }
  const model = await compileEditorProject({ id: 'content-creation', files })
  const savedFiles = new Map(Object.entries(files))
  // The production project store keeps its workspace in a shallowRef. Preserve
  // that identity here so switching projects exercises the synchronous watcher.
  project = shallowReactive({
    workspace: { writeFiles: vi.fn() },
    project: model,
    isRestoringProject: false,
    writeProjectFiles: vi.fn(async (changes: ProjectFileChange[]) => {
      for (const change of changes)
        savedFiles.set(change.path, change.content!)
    }),
    getLocalFileHandle: vi.fn(async (path: string) => fileHandle(path, savedFiles.get(path))),
  })
  file = reactive({
    isDirty: false,
    loading: false,
    openedFilePath: 'adv/chapters/intro.adv.md',
    content: '# Intro\n\n> Begin.\n',
    setOpenedFileHandle: vi.fn(async (handle: FileSystemFileHandle, path: string) => {
      function assertCanSwitch() {
        if (file.isDirty)
          throw new Error('Save or discard the current file before opening another file.')
      }
      assertCanSwitch()
      const workspace = project.workspace
      file.loading = true
      try {
        const content = await handle.getFile().then(value => value.text())
        if (workspace !== project.workspace)
          return
        // Match useFileStore's second guard after reading the next document.
        assertCanSwitch()
        file.openedFilePath = path
        file.content = content
      }
      finally {
        if (workspace === project.workspace)
          file.loading = false
      }
    }),
  })
  vi.stubGlobal('useProjectStore', () => project)
  vi.stubGlobal('useFileStore', () => file)
})

afterEach(() => {
  disposePinia(pinia)
  vi.unstubAllGlobals()
})

describe('editor content creation lifecycle', () => {
  it('does not begin creation without a writable standard workspace or during restoration', () => {
    project.workspace = undefined
    const creation = useContentCreationStore()
    expect(creation.available).toBe(false)
    creation.begin('scene', 'en')
    expect(creation.draft).toBeUndefined()
    project.workspace = { writeFiles: vi.fn() }
    project.isRestoringProject = true
    creation.begin('scene', 'en')
    expect(creation.draft).toBeUndefined()
    project.isRestoringProject = false
    project.project = { ...project.project, mode: 'legacy-json' }
    creation.begin('scene', 'en')
    expect(creation.draft).toBeUndefined()
    expect(project.writeProjectFiles).not.toHaveBeenCalled()
  })

  it('stops a pending form from writing when project restoration begins', async () => {
    const creation = useContentCreationStore()
    creation.begin('scene', 'zh-CN')
    project.isRestoringProject = true
    expect(await creation.create('zh-CN')).toBe(false)
    expect(creation.error).toContain('项目正在恢复')
    expect(creation.draft).toBeDefined()
    expect(project.writeProjectFiles).not.toHaveBeenCalled()
  })

  it('preserves a registered character form draft before leaving the authoring route', async () => {
    const creation = useContentCreationStore()
    useProjectDrafts().register('character-form', { dirty: true, save: vi.fn(async () => true) })
    creation.begin('scene', 'zh-CN')
    expect(await creation.create('zh-CN')).toBe(false)
    expect(creation.error).toContain('请先保存或放弃')
    expect(project.writeProjectFiles).not.toHaveBeenCalled()
    expect(file.setOpenedFileHandle).not.toHaveBeenCalled()
  })

  it('keeps the original draft and submits repeated clicks only once', async () => {
    const write = deferred<void>()
    project.writeProjectFiles.mockReturnValueOnce(write.promise)
    const creation = useContentCreationStore()
    creation.begin('scene', 'en')
    const draft = creation.draft
    draft!.title = 'Rainy courtyard'
    creation.begin('chapter', 'en')
    expect(creation.draft).toBe(draft)
    const pending = creation.create('en')
    expect(creation.busy).toBe(true)
    await expect(creation.create('en')).resolves.toBe(false)
    creation.cancel()
    expect(creation.draft).toBe(draft)
    expect(project.writeProjectFiles).toHaveBeenCalledOnce()
    expect(project.writeProjectFiles).toHaveBeenCalledWith([
      expect.objectContaining({ path: 'adv/scenes/scene-01.md', expected: null, content: expect.stringContaining('Rainy courtyard') }),
    ])
    write.resolve()
    await expect(pending).resolves.toBe(true)
    expect(file.openedFilePath).toBe('adv/scenes/scene-01.md')
    expect(project.getLocalFileHandle).toHaveBeenCalledOnce()
    expect(creation.busy).toBe(false)
  })

  it.each(['isDirty', 'loading'] as const)('blocks writes while the current file has %s state', async (state) => {
    file[state] = true
    const creation = useContentCreationStore()
    creation.begin('chapter', 'zh-CN')
    const draft = creation.draft
    await expect(creation.create('zh-CN')).resolves.toBe(false)
    expect(creation.error).toContain('请先保存或放弃')
    expect(creation.draft).toBe(draft)
    expect(creation.busy).toBe(false)
    expect(project.writeProjectFiles).not.toHaveBeenCalled()
    expect(project.getLocalFileHandle).not.toHaveBeenCalled()
    expect(file.setOpenedFileHandle).not.toHaveBeenCalled()
  })

  it('retains user input after a failed write and can submit it again', async () => {
    project.writeProjectFiles.mockRejectedValueOnce(new Error('Storage unavailable'))
    const creation = useContentCreationStore()
    creation.begin('scene', 'en')
    creation.draft!.id = 'courtyard'
    creation.draft!.title = 'Courtyard'
    const draft = creation.draft
    await expect(creation.create('en')).resolves.toBe(false)
    expect(creation.error).toBe('Storage unavailable')
    expect(creation.busy).toBe(false)
    expect(creation.draft).toBe(draft)
    expect(creation.draft).toEqual({ kind: 'scene', id: 'courtyard', title: 'Courtyard' })
    expect(project.getLocalFileHandle).not.toHaveBeenCalled()
    await expect(creation.create('en')).resolves.toBe(true)
    expect(project.writeProjectFiles).toHaveBeenCalledTimes(2)
    expect(creation.error).toBe('')
    expect(file.openedFilePath).toBe('adv/scenes/courtyard.md')
  })

  it.each(['handle', 'open'] as const)('retries only opening after a successful write and a failed %s operation', async (failure) => {
    if (failure === 'handle')
      project.getLocalFileHandle.mockRejectedValueOnce(new Error('Read unavailable'))
    else
      file.setOpenedFileHandle.mockRejectedValueOnce(new Error('Read unavailable'))
    const creation = useContentCreationStore()
    creation.begin('scene', 'en')
    await expect(creation.create('en')).resolves.toBe(false)
    expect(creation.error).toBe('Read unavailable')
    expect(creation.draft?.createdPath).toBe('adv/scenes/scene-01.md')
    expect(creation.busy).toBe(false)
    await expect(creation.create('en')).resolves.toBe(true)
    expect(project.writeProjectFiles).toHaveBeenCalledOnce()
    expect(project.getLocalFileHandle).toHaveBeenCalledTimes(2)
    expect(file.openedFilePath).toBe('adv/scenes/scene-01.md')
    expect(creation.error).toBe('')
  })

  it.each(['success', 'failure'] as const)('clears the draft on a workspace switch and ignores a late write %s', async (result) => {
    const oldWrite = deferred<void>()
    const newWrite = deferred<void>()
    project.writeProjectFiles.mockReturnValueOnce(oldWrite.promise).mockReturnValueOnce(newWrite.promise)
    const creation = useContentCreationStore()
    creation.begin('scene', 'en')
    const oldDraft = creation.draft
    const oldPending = creation.create('en')
    project.workspace = { writeFiles: vi.fn() }
    expect(creation.draft).toBeUndefined()
    expect(creation.busy).toBe(false)
    expect(creation.error).toBe('')
    creation.begin('chapter', 'en')
    creation.draft!.title = 'New workspace chapter'
    const newDraft = creation.draft
    const newPending = creation.create('en')
    if (result === 'success')
      oldWrite.resolve()
    else
      oldWrite.reject(new Error('Old workspace failure'))
    await expect(oldPending).resolves.toBe(false)
    expect(oldDraft?.createdPath).toBeUndefined()
    expect(creation.draft).toBe(newDraft)
    expect(creation.draft?.title).toBe('New workspace chapter')
    expect(creation.error).toBe('')
    expect(creation.busy).toBe(true)
    expect(project.getLocalFileHandle).not.toHaveBeenCalled()
    expect(file.setOpenedFileHandle).not.toHaveBeenCalled()
    newWrite.resolve()
    await expect(newPending).resolves.toBe(true)
    expect(file.openedFilePath).toBe('adv/chapters/chapter-01.adv.md')
    expect(creation.busy).toBe(false)
  })

  it('ignores a stale file handle after switching workspaces', async () => {
    const read = deferred<FileSystemFileHandle>()
    project.getLocalFileHandle.mockReturnValueOnce(read.promise)
    const creation = useContentCreationStore()
    creation.begin('scene', 'en')
    const pending = creation.create('en')
    await vi.waitFor(() => expect(project.getLocalFileHandle).toHaveBeenCalledOnce())
    project.workspace = { writeFiles: vi.fn() }
    creation.begin('chapter', 'en')
    const draft = creation.draft
    read.resolve(fileHandle('adv/scenes/scene-01.md'))
    await expect(pending).resolves.toBe(false)
    expect(creation.draft).toBe(draft)
    expect(creation.error).toBe('')
    expect(creation.busy).toBe(false)
    expect(file.setOpenedFileHandle).not.toHaveBeenCalled()
  })

  it('preserves edits made while the created file is opening and can reopen without another write', async () => {
    const text = deferred<string>()
    project.getLocalFileHandle.mockResolvedValueOnce({
      name: 'scene-01.md',
      getFile: vi.fn(async () => ({ text: () => text.promise })),
    } as unknown as FileSystemFileHandle)
    const creation = useContentCreationStore()
    creation.begin('scene', 'en')
    const pending = creation.create('en')
    await vi.waitFor(() => expect(file.loading).toBe(true))
    file.isDirty = true
    file.content = '# Unsaved intro\n'
    text.resolve('# Created scene\n')
    await expect(pending).resolves.toBe(false)
    expect(file.openedFilePath).toBe('adv/chapters/intro.adv.md')
    expect(file.content).toBe('# Unsaved intro\n')
    expect(file.isDirty).toBe(true)
    expect(file.loading).toBe(false)
    expect(creation.error).toContain('Save or discard')
    expect(creation.draft?.createdPath).toBe('adv/scenes/scene-01.md')
    file.isDirty = false
    await expect(creation.create('en')).resolves.toBe(true)
    expect(project.writeProjectFiles).toHaveBeenCalledOnce()
    expect(file.openedFilePath).toBe('adv/scenes/scene-01.md')
    expect(creation.error).toBe('')
  })
})
