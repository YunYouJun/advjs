import { createPinia, setActivePinia } from 'pinia'
import { expect, it } from 'vitest'
import { useStudioStore } from '../stores/useStudioStore'

it('persists the actual sync baseline and restores it when reopening the project list', () => {
  localStorage.clear()
  setActivePinia(createPinia())
  const store = useStudioStore()
  store.projects.push({ projectId: 'station', name: 'Station', lastOpened: 1 })
  store.currentProject = store.projects[0]!
  store.updateProject('station', { syncedAt: 12345 })
  expect(store.currentProject.syncedAt).toBe(12345)
  expect(JSON.parse(localStorage.getItem('advjs-studio-projects')!)[0].syncedAt).toBe(12345)
  setActivePinia(createPinia())
  expect(useStudioStore().projects[0]?.syncedAt).toBe(12345)
  localStorage.clear()
})
