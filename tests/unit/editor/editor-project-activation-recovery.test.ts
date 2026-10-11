import { acceptHMRUpdate, createPinia, defineStore, setActivePinia } from 'pinia'
import { beforeEach, expect, it, vi } from 'vitest'
import { computed, ref, shallowRef } from 'vue'

vi.mock('advjs', () => ({ defaultAdvConfig: {} }))
vi.mock('../../../editor/core/app/stores/useProjectDrafts', () => ({ useProjectDrafts: () => ({ capture() {}, activate: async () => {} }) }))
vi.mock('../../../editor/core/app/workspaces/browser-session', () => ({ createBrowserSessionStorage: () => ({ load: async () => ({ projects: [{ id: 'existing', name: 'Existing', handle: {}, lastOpenedAt: 1 }] }), save: async () => {} }) }))
vi.mock('../../../editor/core/app/adapters/browser/workspace', () => ({ createBrowserProjectWorkspace: (handle: any) => ({ kind: 'browser', snapshot: async () => ({ name: handle.name, root: handle, project: { files: {}, compilation: { diagnostics: [], project: { chapters: [], characters: [], scenes: [] } } } }) }) }))
beforeEach(() => {
  setActivePinia(createPinia())
  for (const [key, value] of Object.entries({ computed, ref, shallowRef, defineStore, acceptHMRUpdate })) vi.stubGlobal(key, value)
  vi.stubGlobal('useConsoleStore', () => ({ success() {}, warn() {}, error() {} }))
  vi.stubGlobal('useFileStore', () => ({}))
  vi.stubGlobal('useGameStore', () => ({}))
})
it('a slow older browser identity lookup cannot supersede the newer project', async () => {
  const { useProjectStore } = await import('../../../editor/core/app/stores/useProjectStore')
  const project = useProjectStore()
  let release!: (v: boolean) => void
  const a = { name: 'A', isSameEntry: () => new Promise<boolean>(resolve => release = resolve) }
  const b = { name: 'B', isSameEntry: async () => false }
  const older = project.openBrowserProject(a as any)
  await vi.waitFor(() => expect(release).toBeDefined())
  await project.openBrowserProject(b as any)
  expect(project.rootDir?.name).toBe('B')
  // Resolve all subsequent identity comparisons too.
  a.isSameEntry = async () => false
  release(false)
  await older
  expect(project.rootDir?.name).toBe('B')
})

it('a delayed older remember cannot replace the latest recent-project selection', async () => {
  const { useProjectStore } = await import('../../../editor/core/app/stores/useProjectStore')
  const project = useProjectStore()
  let release!: (v: boolean) => void
  let calls = 0
  const a = { name: 'A', isSameEntry: () => ++calls === 2 ? new Promise<boolean>(resolve => release = resolve) : Promise.resolve(false) }
  const b = { name: 'B', isSameEntry: async () => false }
  const older = project.openBrowserProject(a as any)
  await vi.waitFor(() => expect(release).toBeDefined())
  await project.openBrowserProject(b as any)
  release(false)
  await older
  expect(project.rootDir?.name).toBe('B')
  expect(project.recentProjects[0]?.name).toBe('B')
})
