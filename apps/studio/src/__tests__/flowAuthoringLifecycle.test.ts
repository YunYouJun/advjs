import type { IFileSystem } from '../utils/fs'
import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, reactive, shallowRef } from 'vue'
import { useFlowAuthoring } from '../composables/useFlowAuthoring'

const mocks = vi.hoisted(() => ({ project: null as any, studio: null as any, auth: null as any }))
vi.mock('../composables/useProjectContent', () => ({ useProjectContent: () => mocks.project }))
vi.mock('../stores/useStudioStore', () => ({ useStudioStore: () => mocks.studio }))
vi.mock('../stores/useAuthStore', () => ({ useAuthStore: () => mocks.auth }))

const path = 'adv/chapters/intro.chapter.json'
const scopes: ReturnType<typeof effectScope>[] = []
function filesystem(title = 'Intro') {
  const files = new Map([
    ['adv.config.json', JSON.stringify({ id: 'flow-native', root: 'adv', format: 'flow' })],
    [path, JSON.stringify({ schemaVersion: 1, id: 'intro', title, nodes: [{ id: 'speech', type: 'narration', text: 'Before', next: 'end', notes: { keep: true } }, { id: 'end', type: 'end' }] })],
  ])
  const fs = {
    backend: 'memory',
    exists: async (path: string) => files.has(path),
    readFile: async (path: string) => files.get(path)!,
    writeFile: vi.fn(async (path: string, content: string) => { files.set(path, content) }),
    deleteFile: async (path: string) => { files.delete(path) },
    collectAllFiles: async (root = '') => [...files].filter(([path]) => !root || path.startsWith(`${root}/`)).map(([path, content]) => ({ path, content, lastModified: new Date() })),
  } as unknown as IFileSystem
  return { fs, files }
}
function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((accept) => {
    resolve = accept
  })
  return { promise, resolve }
}
function workspace() {
  const current = filesystem()
  const fs = shallowRef(current.fs)
  mocks.project = { getFs: () => fs.value, isLoading: shallowRef(false), whenReady: async () => {}, reload: vi.fn(async () => {}) }
  const active = shallowRef(true)
  const file = shallowRef(path)
  const scope = effectScope()
  scopes.push(scope)
  return { ...current, fsRef: fs, active, api: scope.run(() => useFlowAuthoring(active, file))! }
}
beforeEach(() => {
  mocks.studio = reactive({ currentProjectId: 'first' })
  mocks.auth = reactive({ userId: 'actor' })
})
afterEach(() => scopes.splice(0).forEach(scope => scope.stop()))

describe('studio native Flow draft lifecycle', () => {
  it('keeps inactive and conflicted drafts while blocking an in-flight save after leaving the page', async () => {
    const { api, active, files, fs } = workspace()
    await vi.waitFor(() => expect(api.document.value?.title).toBe('Intro'))
    await flushPromises()
    api.dispatch({ type: 'set-title', title: 'My retained draft' })
    const gate = deferred()
    const collect = fs.collectAllFiles
    fs.collectAllFiles = async (root) => {
      await gate.promise
      return collect(root)
    }
    const saving = api.save()
    await flushPromises()
    active.value = false
    expect(api.document.value?.title).toBe('My retained draft')
    expect(api.dirty.value).toBe(true)
    gate.resolve()
    await saving
    expect(fs.writeFile).not.toHaveBeenCalled()
    fs.collectAllFiles = collect
    active.value = true
    await flushPromises()
    expect(api.document.value?.title).toBe('My retained draft')
    const external = JSON.parse(files.get(path)!)
    external.title = 'Other host'
    files.set(path, JSON.stringify(external))
    await api.save()
    expect(api.error.value).toContain('Source changed')
    active.value = false
    active.value = true
    await flushPromises()
    expect(api.document.value?.title).toBe('My retained draft')
    expect(api.error.value).toContain('Source changed')
    expect(api.canUndo.value).toBe(true)
    expect(JSON.parse(files.get(path)!).title).toBe('Other host')
  })

  it('treats formatting as clean but retains actual layout and story order edits in dirty history', async () => {
    const { api } = workspace()
    await vi.waitFor(() => expect(api.document.value?.title).toBe('Intro'))
    await flushPromises()
    expect(api.dirty.value).toBe(false)
    api.dispatch({ type: 'move-node', nodeId: 'speech', position: { x: 70, y: 90 } })
    expect(api.dirty.value).toBe(true)
    api.undo()
    expect(api.dirty.value).toBe(false)
    api.redo()
    expect(api.dirty.value).toBe(true)
    api.undo()
    api.dispatch({ type: 'reorder-node', nodeId: 'end', index: 0 })
    expect(api.document.value?.nodes.map(node => node.id)).toEqual(['end', 'speech'])
    expect(api.dirty.value).toBe(true)
    api.undo()
    expect(api.dirty.value).toBe(false)
  })

  it('clears drafts on account, project or filesystem replacement even while the page is inactive', async () => {
    const { api, active, fsRef } = workspace()
    await vi.waitFor(() => expect(api.document.value?.title).toBe('Intro'))
    await flushPromises()
    api.dispatch({ type: 'set-title', title: 'Private account draft' })
    active.value = false
    mocks.auth.userId = 'other-actor'
    expect(api.document.value).toBeUndefined()
    active.value = true
    await vi.waitFor(() => expect(api.document.value?.title).toBe('Intro'))
    await flushPromises()
    api.dispatch({ type: 'set-title', title: 'Old project draft' })
    active.value = false
    mocks.studio.currentProjectId = 'second'
    expect(api.document.value).toBeUndefined()
    active.value = true
    await vi.waitFor(() => expect(api.document.value?.title).toBe('Intro'))
    await flushPromises()
    api.dispatch({ type: 'set-title', title: 'Old filesystem draft' })
    active.value = false
    fsRef.value = filesystem('Replacement source').fs
    expect(api.document.value).toBeUndefined()
    active.value = true
    await vi.waitFor(() => expect(api.document.value?.title).toBe('Replacement source'))
    expect(api.canUndo.value).toBe(false)
    expect(api.dirty.value).toBe(false)
  })
})
