import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { computed, effectScope, nextTick, reactive, ref, shallowRef, watch } from 'vue'
import { rememberLocalEditorSession, resolveLocalEditorSession } from '../../editor/core/app/adapters/local/session'
import { useLocalWorkspaceView } from '../../editor/core/app/composables/useLocalWorkspaceView'
import { useFileStore } from '../../editor/core/app/stores/useFileStore'

const scopes: ReturnType<typeof effectScope>[] = []
beforeEach(() => {
  sessionStorage.clear()
  localStorage.clear()
  setActivePinia(createPinia())
})
afterEach(() => {
  scopes.splice(0).forEach(scope => scope.stop())
  vi.unstubAllGlobals()
})

it('reconnects after the launch fragment is removed and prefers a fresh launch token', () => {
  const url = 'http://127.0.0.1:3348/'
  const session = resolveLocalEditorSession(`${url}#advjs-token=first`, sessionStorage)!
  rememberLocalEditorSession(session, sessionStorage)
  expect(resolveLocalEditorSession(url, sessionStorage)).toEqual(session)
  expect(resolveLocalEditorSession(`${url}play`, sessionStorage)).toEqual(session)
  expect(resolveLocalEditorSession(`${url}#advjs-token=new`, sessionStorage)?.token).toBe('new')
  expect(localStorage.length).toBe(0)
  rememberLocalEditorSession(undefined, sessionStorage)
  expect(resolveLocalEditorSession(url, sessionStorage)).toBeUndefined()
})

it('does not replay a stored credential on another origin or non-loopback site', () => {
  rememberLocalEditorSession({ origin: 'http://127.0.0.1:3348', token: 'secret' }, sessionStorage)
  expect(resolveLocalEditorSession('http://127.0.0.1:3349/', sessionStorage)).toBeUndefined()
  expect(resolveLocalEditorSession('https://editor.advjs.org/', sessionStorage)).toBeUndefined()
  sessionStorage.setItem('advjs:editor:local-session', '{broken')
  expect(resolveLocalEditorSession('http://127.0.0.1:3348/', sessionStorage)).toBeUndefined()
})

it('keeps valid launch links usable when storage is blocked', () => {
  const storage = {
    getItem: () => { throw new Error('blocked') },
    setItem: () => { throw new Error('blocked') },
  } as unknown as Storage
  const session = resolveLocalEditorSession('http://localhost:3348/#advjs-token=launch', storage)
  expect(session?.token).toBe('launch')
  expect(() => rememberLocalEditorSession(session, storage)).not.toThrow()
})

function editor(files: Record<string, string>, identity = '/projects/story') {
  setActivePinia(createPinia())
  const app = reactive({ activeInspector: undefined as string | undefined, inspectorTab: 'inspector' })
  const monaco = reactive({ fileContent: '', language: '' })
  const character = reactive({ selectedCharacter: undefined, selectedCharacterHandle: undefined })
  const getHandle = async (path: string) => ({
    name: path.split('/').at(-1)!,
    path,
    getFile: async () => ({ text: async () => files[path] }),
  })
  const project = reactive({
    workspaceMode: 'local',
    workspaceIdentity: identity,
    project: { files },
    getLocalFileHandle: vi.fn(getHandle),
    commitProject: vi.fn(),
  })
  for (const [key, value] of Object.entries({
    ref,
    shallowRef,
    computed,
    watch,
    useFileStore,
    useAppStore: () => app,
    useProjectStore: () => project,
    useCharacterStore: () => character,
    useMonacoStore: () => monaco,
    useGameStore: () => ({}),
    useConsoleStore: () => ({ success: vi.fn(), warn: vi.fn() }),
  })) vi.stubGlobal(key, value)
  const scope = effectScope()
  scopes.push(scope)
  const fileStore = scope.run(useFileStore)!
  const view = scope.run(useLocalWorkspaceView)!
  return { app, monaco, character, project, view, fileStore, scope }
}

it('restores the selected source and unsaved draft without writing to disk', async () => {
  const path = 'adv/chapters/intro.adv.md'
  const files = { [path]: '# Saved' }
  const first = editor(files)
  await first.view.restore()
  await first.fileStore.setOpenedFileHandle(await first.project.getLocalFileHandle(path) as unknown as FileSystemFileHandle, path)
  first.monaco.fileContent = '# Draft'
  first.app.inspectorTab = 'context'
  await nextTick()
  first.scope.stop()
  const reloaded = editor(files)
  await reloaded.view.restore()
  expect(reloaded.fileStore.openedFilePath).toBe(path)
  expect(reloaded.monaco.fileContent).toBe('# Draft')
  expect(reloaded.fileStore.isDirty).toBe(true)
  expect(reloaded.app.inspectorTab).toBe('context')
  expect(reloaded.project.commitProject).not.toHaveBeenCalled()
  expect(files[path]).toBe('# Saved')
})

it('keeps both the recovered draft and a newer disk version for conflict resolution', async () => {
  const path = 'adv/chapters/intro.adv.md'
  sessionStorage.setItem('advjs:editor:view:/projects/story', JSON.stringify({ kind: 'file', path, draft: { base: '# Old', content: '# Draft' } }))
  const reloaded = editor({ [path]: '# External edit' })
  await reloaded.view.restore()
  expect(reloaded.monaco.fileContent).toBe('# Draft')
  expect(reloaded.fileStore.externalConflict).toEqual({ path, content: '# External edit' })
  reloaded.fileStore.acceptExternalChange()
  expect(reloaded.monaco.fileContent).toBe('# External edit')
  expect(reloaded.fileStore.isDirty).toBe(false)
})

it('restores a character card and ignores another project or a deleted selection', async () => {
  const path = 'adv/characters/hero.character.md'
  sessionStorage.setItem('advjs:editor:view:/projects/story', JSON.stringify({ kind: 'character', path, tab: 'inspector' }))
  const files = { [path]: '---\nid: hero\nname: Hero\n---\n' }
  const restored = editor(files)
  await restored.view.restore()
  expect(restored.character.selectedCharacter).toMatchObject({ id: 'hero', name: 'Hero' })
  expect(restored.app.activeInspector).toBe('character')
  restored.scope.stop()
  const other = editor(files, '/projects/other')
  await other.view.restore()
  expect(other.project.getLocalFileHandle).not.toHaveBeenCalled()
  other.scope.stop()
  const deleted = editor({})
  await deleted.view.restore()
  expect(deleted.project.getLocalFileHandle).not.toHaveBeenCalled()
})
