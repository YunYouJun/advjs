import type { App } from 'vue'
import type { ProjectSourcePosition } from '../../../editor/core/app/stores/useMonacoStore'
import { createPinia, disposePinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, effectScope, h, nextTick, onMounted, reactive, ref, shallowReactive, watch } from 'vue'
import InspectorFileView from '../../../editor/core/app/components/panel/view/InspectorFileView.vue'
import { useProjectSourceNavigation } from '../../../editor/core/app/composables/useProjectSourceNavigation'
import { useFileStore } from '../../../editor/core/app/stores/useFileStore'
import { useMonacoStore } from '../../../editor/core/app/stores/useMonacoStore'
import { useProjectDrafts } from '../../../editor/core/app/stores/useProjectDrafts'

let layout: { state: { active: { main: string } }, select: ReturnType<typeof vi.fn> }
vi.mock('../../../editor/core/app/extensions/layout-state', () => ({ useEditorLayoutState: () => layout }))
vi.mock('@advjs/client', () => ({ AdvGameLoadStatusEnum: { SUCCESS: 'success' }, useAdvContext: () => ({ $adv: {} }) }))

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (cause: Error) => void
  const promise = new Promise<T>((done, fail) => {
    resolve = done
    reject = fail
  })
  return { promise, resolve, reject }
}

const path = 'adv/chapters/intro.adv.md'
const content = '# Intro\n\n> Begin.\n'
const source: ProjectSourcePosition = { path, line: 3, column: 3 }
function handle(text = content) {
  return { name: 'intro.adv.md', getFile: async () => ({ text: async () => text }) } as unknown as FileSystemFileHandle
}

let pinia: ReturnType<typeof createPinia>
let scope: ReturnType<typeof effectScope>
let project: {
  workspace: object | undefined
  project: { files: Record<string, string> }
  isRestoringProject: boolean
  getLocalFileHandle: ReturnType<typeof vi.fn<(path: string) => Promise<FileSystemFileHandle>>>
}
let file: {
  isDirty: boolean
  loading: boolean
  openedFilePath: string
  setOpenedFileHandle: ReturnType<typeof vi.fn<(handle: FileSystemFileHandle, path: string, options?: { forceReload?: boolean }) => Promise<void>>>
}
let monaco: ReturnType<typeof useMonacoStore>
let app: App | undefined

beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
  scope = effectScope()
  monaco = useMonacoStore()
  project = shallowReactive({ workspace: {}, project: { files: { [path]: content } }, isRestoringProject: false, getLocalFileHandle: vi.fn(async () => handle()) })
  file = reactive({
    isDirty: false,
    loading: false,
    openedFilePath: '',
    setOpenedFileHandle: vi.fn(async (target, nextPath) => {
      const workspace = project.workspace
      file.loading = true
      try {
        const text = await target.getFile().then(value => value.text())
        if (workspace !== project.workspace)
          return
        if (file.isDirty)
          throw new Error('Save or discard the current file before opening another file.')
        file.openedFilePath = nextPath
        monaco.fileContent = text
      }
      finally { file.loading = false }
    }),
  })
  layout = {
    state: reactive({ active: { main: 'advjs.core/flow-editor' } }),
    select: vi.fn((_: string, next: string) => { layout.state.active.main = next }),
  }
  vi.stubGlobal('useProjectStore', () => project)
  vi.stubGlobal('useFileStore', () => file)
  vi.stubGlobal('useMonacoStore', () => monaco)
  vi.stubGlobal('useEditorLocale', () => ({ locale: ref('en') }))
})

afterEach(() => {
  app?.unmount()
  app = undefined
  document.body.innerHTML = ''
  scope.stop()
  disposePinia(pinia)
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

function navigation() {
  return scope.run(() => useProjectSourceNavigation())!
}

function sourceEditor() {
  const navigate = vi.fn(async (_: ProjectSourcePosition, current: () => boolean) => current())
  const release = monaco.registerSourceEditor({ canNavigate: target => target === file.openedFilePath && !file.loading, navigate })
  return { navigate, release }
}

describe('project source navigation', () => {
  it('opens the workspace file, selects its main view, and reveals the saved line', async () => {
    const editor = sourceEditor()
    const action = navigation()
    await expect(action.navigate(source)).resolves.toBe(true)
    expect(project.getLocalFileHandle).toHaveBeenCalledWith(path)
    expect(file.setOpenedFileHandle).toHaveBeenCalledWith(expect.objectContaining({ name: 'intro.adv.md' }), path, { forceReload: true })
    expect(layout.select).toHaveBeenCalledWith('main', 'advjs.core/file')
    expect(editor.navigate).toHaveBeenCalledWith(source, expect.any(Function))
    expect(action.busy.value).toBe(false)
    expect(action.error.value).toBe('')
  })

  it.each(['other file', 'same file'])('preserves a dirty draft in the %s without presenting saved positions as current', async (kind) => {
    file.isDirty = true
    file.openedFilePath = kind === 'same file' ? path : 'adv/chapters/draft.adv.md'
    monaco.fileContent = '# Unsaved draft\n'
    const action = navigation()
    expect(await action.navigate(source)).toBe(false)
    expect(action.error.value).toContain('Save or discard')
    expect(monaco.fileContent).toBe('# Unsaved draft\n')
    expect(project.getLocalFileHandle).not.toHaveBeenCalled()
    expect(layout.select).not.toHaveBeenCalled()
  })

  it('protects a registered authoring form draft', async () => {
    useProjectDrafts().register('character-form', { dirty: true, save: async () => true })
    const action = navigation()
    expect(await action.navigate(source)).toBe(false)
    expect(action.error.value).toContain('Save or discard')
    expect(file.setOpenedFileHandle).not.toHaveBeenCalled()
  })

  it.each(['missing', 'restoring', 'loading'])('blocks navigation when the project or file is %s', async (state) => {
    if (state === 'missing')
      project.workspace = undefined
    else if (state === 'restoring')
      project.isRestoringProject = true
    else
      file.loading = true
    const action = navigation()
    expect(await action.navigate(source)).toBe(false)
    expect(action.error.value).not.toBe('')
    expect(project.getLocalFileHandle).not.toHaveBeenCalled()
    expect(layout.select).not.toHaveBeenCalled()
  })

  it.each(['handle', 'open'])('preserves edits made while the source %s is loading', async (phase) => {
    const read = deferred<FileSystemFileHandle>()
    const text = deferred<string>()
    if (phase === 'handle')
      project.getLocalFileHandle.mockReturnValueOnce(read.promise)
    else
      project.getLocalFileHandle.mockResolvedValueOnce({ name: 'intro.adv.md', getFile: async () => ({ text: () => text.promise }) } as unknown as FileSystemFileHandle)
    file.openedFilePath = 'adv/chapters/draft.adv.md'
    const action = navigation()
    const pending = action.navigate(source)
    if (phase === 'open')
      await vi.waitFor(() => expect(file.loading).toBe(true))
    file.isDirty = true
    monaco.fileContent = '# New unsaved draft\n'
    read.resolve(handle())
    text.resolve(content)
    expect(await pending).toBe(false)
    expect(monaco.fileContent).toBe('# New unsaved draft\n')
    expect(file.openedFilePath).toBe('adv/chapters/draft.adv.md')
    expect(layout.select).not.toHaveBeenCalled()
  })

  it.each(['success', 'failure'])('ignores a late handle %s after switching workspaces', async (result) => {
    const read = deferred<FileSystemFileHandle>()
    project.getLocalFileHandle.mockReturnValueOnce(read.promise)
    const action = navigation()
    const pending = action.navigate(source)
    project.workspace = {}
    expect(action.busy.value).toBe(false)
    if (result === 'success')
      read.resolve(handle())
    else
      read.reject(new Error('Old workspace failed'))
    expect(await pending).toBe(false)
    expect(file.setOpenedFileHandle).not.toHaveBeenCalled()
    expect(layout.select).not.toHaveBeenCalled()
    expect(action.error.value).toBe('')
  })

  it('cancels a pending read when project restoration begins', async () => {
    const read = deferred<FileSystemFileHandle>()
    project.getLocalFileHandle.mockReturnValueOnce(read.promise)
    const action = navigation()
    const pending = action.navigate(source)
    project.isRestoringProject = true
    read.resolve(handle())
    expect(await pending).toBe(false)
    expect(action.busy.value).toBe(false)
    expect(file.setOpenedFileHandle).not.toHaveBeenCalled()
  })

  it('waits for Monaco registration and reports a bounded failure when it never loads', async () => {
    vi.useFakeTimers()
    const action = navigation()
    const pending = action.navigate(source)
    await vi.advanceTimersByTimeAsync(0)
    expect(action.busy.value).toBe(true)
    const editor = sourceEditor()
    expect(await pending).toBe(true)
    editor.release()
    const timeout = action.navigate(source)
    await vi.advanceTimersByTimeAsync(5000)
    expect(await timeout).toBe(false)
    expect(action.error.value).toContain('not ready')
    expect(action.busy.value).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('cancels pending positioning on disposal and ignores a later editor registration', async () => {
    const action = navigation()
    const pending = action.navigate(source)
    await vi.waitFor(() => expect(layout.select).toHaveBeenCalledOnce())
    scope.stop()
    expect(await pending).toBe(false)
    const editor = sourceEditor()
    await nextTick()
    expect(editor.navigate).not.toHaveBeenCalled()
    expect(action.busy.value).toBe(false)
  })

  it('keeps an in-flight navigation singular when the same node is activated again', async () => {
    const read = deferred<FileSystemFileHandle>()
    project.getLocalFileHandle.mockReturnValueOnce(read.promise)
    const editor = sourceEditor()
    const action = navigation()
    const pending = action.navigate(source)
    expect(await action.navigate(source)).toBe(false)
    expect(project.getLocalFileHandle).toHaveBeenCalledOnce()
    expect(action.busy.value).toBe(true)
    read.resolve(handle())
    expect(await pending).toBe(true)
    expect(editor.navigate).toHaveBeenCalledOnce()
  })

  it('releases only the current source editor and cancels a pending location when it is destroyed', async () => {
    const oldRelease = monaco.registerSourceEditor({ canNavigate: () => false, navigate: vi.fn() })
    const current = monaco.registerSourceEditor({ canNavigate: () => false, navigate: vi.fn() })
    oldRelease()
    expect(monaco.sourceEditor).toBeDefined()
    const action = navigation()
    const pending = action.navigate(source)
    await vi.waitFor(() => expect(layout.select).toHaveBeenCalledOnce())
    current()
    expect(await pending).toBe(false)
    expect(monaco.sourceEditor).toBeUndefined()
    expect(action.error.value).toContain('not ready')
  })

  it('does not focus source after the user switches away from its view', async () => {
    const action = navigation()
    const pending = action.navigate(source)
    await vi.waitFor(() => expect(layout.select).toHaveBeenCalledOnce())
    layout.state.active.main = 'advjs.core/game'
    expect(await pending).toBe(false)
    const editor = sourceEditor()
    expect(editor.navigate).not.toHaveBeenCalled()
  })

  it('does not reveal an old graph location when compilation changes during editor loading', async () => {
    const action = navigation()
    const pending = action.navigate(source)
    await vi.waitFor(() => expect(layout.select).toHaveBeenCalledOnce())
    project.project = { files: { [path]: '# Recompiled chapter\n' } }
    const editor = sourceEditor()
    expect(await pending).toBe(false)
    expect(action.error.value).toContain('Source has changed')
    expect(editor.navigate).not.toHaveBeenCalled()
  })

  it('rejects source that changed since compilation and lets the user retry after refresh', async () => {
    const updated = '# Changed source\n'
    project.getLocalFileHandle.mockResolvedValue(handle(updated))
    const editor = sourceEditor()
    const action = navigation()
    expect(await action.navigate(source)).toBe(false)
    expect(action.error.value).toContain('Source has changed')
    expect(layout.select).not.toHaveBeenCalled()
    expect(editor.navigate).not.toHaveBeenCalled()
    project.project = { files: { [path]: updated } }
    expect(await action.navigate(source)).toBe(true)
  })

  it('reloads the real FileStore for same-file external edits and rejects the old graph until refresh', async () => {
    vi.stubGlobal('useGameStore', () => ({ gameConfig: {} }))
    vi.stubGlobal('useConsoleStore', () => ({ success: vi.fn(), warn: vi.fn() }))
    vi.stubGlobal('useAppStore', () => ({ activeInspector: 'file' }))
    const realFile = useFileStore()
    vi.stubGlobal('useFileStore', () => realFile)
    let disk = content
    const diskHandle = { name: 'intro.adv.md', getFile: async () => ({ text: async () => disk }) } as unknown as FileSystemFileHandle
    project.getLocalFileHandle.mockResolvedValue(diskHandle)
    await realFile.setOpenedFileHandle(diskHandle, path)
    const navigate = vi.fn(async (_: ProjectSourcePosition, current: () => boolean) => current())
    monaco.registerSourceEditor({ canNavigate: target => target === realFile.openedFilePath && !realFile.loading, navigate })
    const action = navigation()
    disk = '# Externally changed\n\n> New lines.\n'
    expect(await action.navigate(source)).toBe(false)
    expect(action.error.value).toContain('Source has changed')
    expect(monaco.fileContent).toBe(disk)
    expect(realFile.isDirty).toBe(false)
    expect(navigate).not.toHaveBeenCalled()
    project.project = { files: { [path]: disk } }
    expect(await action.navigate(source)).toBe(true)
    expect(monaco.fileContent).toBe(disk)
    expect(navigate).toHaveBeenCalledOnce()
  })

  it('preserves edits made while the real FileStore force-reloads the same source', async () => {
    vi.stubGlobal('useGameStore', () => ({ gameConfig: {} }))
    vi.stubGlobal('useConsoleStore', () => ({ success: vi.fn(), warn: vi.fn() }))
    vi.stubGlobal('useAppStore', () => ({ activeInspector: 'file' }))
    const realFile = useFileStore()
    await realFile.setOpenedFileHandle(handle(), path)
    const text = deferred<string>()
    const diskHandle = { name: 'intro.adv.md', getFile: async () => ({ text: () => text.promise }) } as unknown as FileSystemFileHandle
    const pending = realFile.setOpenedFileHandle(diskHandle, path, { forceReload: true })
    expect(realFile.loading).toBe(true)
    monaco.fileContent = '# Unsaved while loading\n'
    text.resolve(content)
    await expect(pending).rejects.toThrow('Save or discard')
    expect(monaco.fileContent).toBe('# Unsaved while loading\n')
    expect(realFile.isDirty).toBe(true)
    expect(realFile.loading).toBe(false)
  })

  it('waits for the mounted Inspector model to update when force-reloading already-open source after a graph refresh', async () => {
    vi.stubGlobal('useGameStore', () => ({ gameConfig: {}, startChapter: '', startNode: '' }))
    vi.stubGlobal('useConsoleStore', () => ({ success: vi.fn(), warn: vi.fn() }))
    vi.stubGlobal('useAppStore', () => ({ activeInspector: 'file' }))
    vi.stubGlobal('useColorMode', () => ({ value: 'dark' }))
    const realFile = useFileStore()
    vi.stubGlobal('useFileStore', () => realFile)
    let disk = content
    const diskHandle = { name: 'intro.adv.md', getFile: async () => ({ text: async () => disk }) } as unknown as FileSystemFileHandle
    project.getLocalFileHandle.mockResolvedValue(diskHandle)
    await realFile.setOpenedFileHandle(diskHandle, path)

    let editorValue = content
    let position = { lineNumber: 1, column: 1 }
    const cursorListeners: (() => void)[] = []
    const instance = {
      getValue: () => editorValue,
      getModel: () => ({ validatePosition: (value: typeof position) => value }),
      getPosition: () => position,
      getScrollTop: () => 0,
      getScrollLeft: () => 0,
      setScrollPosition: vi.fn(),
      setPosition: vi.fn((value: typeof position) => {
        position = value
        cursorListeners.forEach(listener => listener())
      }),
      layout: vi.fn(),
      revealPositionInCenterIfOutsideViewport: vi.fn(),
      focus: vi.fn(),
      onDidChangeCursorPosition: (listener: () => void) => {
        cursorListeners.push(listener)
        return { dispose: vi.fn() }
      },
      onDidScrollChange: () => ({ dispose: vi.fn() }),
    }
    // Match nuxt-monaco-editor: modelValue reaches the child on the next Vue
    // render, and its model update emits the same value back to the store.
    const MonacoStub = defineComponent({
      props: { modelValue: { type: String, default: '' } },
      emits: ['update:modelValue', 'load'],
      setup(props, { emit }) {
        watch(() => props.modelValue, (value) => {
          editorValue = value
          emit('update:modelValue', value)
        })
        onMounted(() => emit('load', instance))
        return () => h('div', { 'data-monaco-stub': '' })
      },
    })
    const SlotStub = defineComponent({ setup: (_, { slots }) => () => h('div', slots.default?.()) })
    app = createApp({ render: () => h(InspectorFileView) })
    app.component('ClientOnly', SlotStub)
    app.component('AGUIToolbar', SlotStub)
    app.component('AGUIButton', SlotStub)
    app.component('LazyMonacoEditor', MonacoStub)
    app.component('AEAdvConfigActions', SlotStub)
    const root = document.createElement('div')
    document.body.append(root)
    app.mount(root)
    await nextTick()
    await nextTick()
    expect(monaco.sourceEditor?.canNavigate(path)).toBe(true)

    disk = '# Refreshed intro\n\n## Anchor\n\n> New source.\n'
    project.project = { files: { [path]: disk } }
    expect(editorValue).toBe(content)
    const action = navigation()
    expect(await action.navigate({ path, line: 5, column: 3 })).toBe(true)
    expect(editorValue).toBe(disk)
    expect(instance.setPosition).toHaveBeenLastCalledWith({ lineNumber: 5, column: 3 })
    expect(instance.revealPositionInCenterIfOutsideViewport).toHaveBeenCalledWith({ lineNumber: 5, column: 3 })
    expect(instance.focus).toHaveBeenCalledOnce()
    expect(realFile.isDirty).toBe(false)
    expect(action.error.value).toBe('')
    app.unmount()
    app = undefined
    expect(monaco.sourceEditor).toBeUndefined()
  })

  it.each(['/outside.md', '../outside.md', 'adv\\chapter.md', 'adv//chapter.md', 'adv/./chapter.md', 'adv/.git/config'])('rejects invalid project path %s before reading it', async (unsafe) => {
    const action = navigation()
    expect(await action.navigate({ path: unsafe })).toBe(false)
    expect(action.error.value).toContain('Invalid project source path')
    expect(project.getLocalFileHandle).not.toHaveBeenCalled()
  })

  it('reports missing source and invalid positions before reading a file', async () => {
    const action = navigation()
    expect(await action.navigate({ path: 'adv/chapters/missing.adv.md' })).toBe(false)
    expect(action.error.value).toContain('Source is missing')
    expect(await action.navigate({ ...source, line: 0 })).toBe(false)
    expect(action.error.value).toContain('Invalid source position')
    expect(project.getLocalFileHandle).not.toHaveBeenCalled()
  })
})
