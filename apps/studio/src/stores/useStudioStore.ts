import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { claimDefaultData, DEFAULT_PROJECT_ID, hasDefaultData } from '../utils/db'
import { loadDirHandle, restoreAndVerifyHandle, saveDirHandle } from '../utils/dirHandleStore'
import { setProjectIdGetter } from '../utils/projectScope'
import { toSlug } from '../utils/slug'
import { useCharacterChatStore } from './useCharacterChatStore'
import { useCharacterDiaryStore } from './useCharacterDiaryStore'
import { useCharacterMemoryStore } from './useCharacterMemoryStore'
import { useCharacterStateStore } from './useCharacterStateStore'
import { useChatStore } from './useChatStore'
import { useGroupChatStore } from './useGroupChatStore'
import { useViewModeStore } from './useViewModeStore'
import { useWorldClockStore } from './useWorldClockStore'
import { useWorldEventStore } from './useWorldEventStore'

export interface StudioProject {
  /** Slug-style persistent unique identifier */
  projectId: string
  name: string
  /** Browser local project directory handle (not serializable to JSON, stored in IndexedDB) */
  dirHandle?: FileSystemDirectoryHandle
  /** Online project URL */
  url?: string
  /** Project source type */
  source?: 'local' | 'url' | 'cos'
  /** COS object key prefix for cloud projects */
  cosPrefix?: string
  lastOpened: number
}

export const useStudioStore = defineStore('studio', () => {
  const currentProject = ref<StudioProject | null>(null)
  const projects = ref<StudioProject[]>([])

  const currentProjectId = computed(() =>
    currentProject.value?.projectId ?? DEFAULT_PROJECT_ID,
  )

  // Register the global getter so per-project stores can resolve the current projectId
  setProjectIdGetter(() => currentProjectId.value)

  // Restore project list from localStorage (without dirHandle)
  function loadFromStorage() {
    try {
      const saved = localStorage.getItem('advjs-studio-projects')
      if (saved) {
        const parsed = JSON.parse(saved) as Array<{
          projectId?: string
          name: string
          url?: string
          source?: 'local' | 'url' | 'cos'
          cosPrefix?: string
          lastOpened: number
        }>
        projects.value = parsed.map(p => ({
          projectId: p.projectId || toSlug(p.name) || p.name,
          name: p.name,
          url: p.url,
          source: p.source,
          cosPrefix: p.cosPrefix,
          lastOpened: p.lastOpened,
        }))
      }
    }
    catch {
      // ignore parse errors
    }
  }

  function saveToStorage() {
    const serializable = projects.value.map(p => ({
      projectId: p.projectId,
      name: p.name,
      url: p.url,
      source: p.source,
      cosPrefix: p.cosPrefix,
      lastOpened: p.lastOpened,
    }))
    localStorage.setItem('advjs-studio-projects', JSON.stringify(serializable))
  }

  function addProject(project: StudioProject) {
    // Remove existing project with same projectId
    const idx = projects.value.findIndex(p => p.projectId === project.projectId)
    if (idx !== -1)
      projects.value.splice(idx, 1)

    projects.value.unshift(project)
    saveToStorage()
  }

  function removeProject(index: number) {
    projects.value.splice(index, 1)
    saveToStorage()
  }

  function setCurrentProject(project: StudioProject | null) {
    currentProject.value = project
    if (project) {
      project.lastOpened = Date.now()
      addProject(project)

      // Persist current projectId for auto-restore on reload
      localStorage.setItem('advjs-studio-current', project.projectId)

      // Persist dirHandle to IndexedDB (non-blocking)
      if (project.dirHandle) {
        saveDirHandle(project.name, project.dirHandle).catch(() => {
          // IndexedDB not available — non-critical
        })
      }
    }
    else {
      localStorage.removeItem('advjs-studio-current')
    }
  }

  /**
   * Switch to a different project with full flush → reset → reload cycle.
   * This is the primary entry point for project switching.
   */
  async function switchProject(project: StudioProject | null) {
    // 1. Flush all pending writes for the current (old) project
    const chatStore = useCharacterChatStore()
    const memoryStore = useCharacterMemoryStore()
    const stateStore = useCharacterStateStore()
    const groupChatStore = useGroupChatStore()
    const eventStore = useWorldEventStore()
    const clockStore = useWorldClockStore()
    const generalChatStore = useChatStore()
    const viewModeStore = useViewModeStore()
    const diaryStore = useCharacterDiaryStore()

    // Await all flush promises to ensure pending writes complete before reset
    await Promise.all([
      chatStore.flush(),
      memoryStore.flush(),
      stateStore.flush(),
      groupChatStore.flush(),
      eventStore.flush(),
      clockStore.flush(),
      viewModeStore.flush(),
      diaryStore.flush(),
    ])

    // 2. Reset all project-scoped stores
    chatStore.$reset()
    memoryStore.$reset()
    stateStore.$reset()
    groupChatStore.$reset()
    eventStore.$reset()
    clockStore.$reset()
    generalChatStore.$reset()
    viewModeStore.$reset()
    diaryStore.$reset()

    // 4. Update the current project ref + persist
    setCurrentProject(project)

    if (!project)
      return

    // 5. Claim _default_ data if this is the first project opened after migration
    try {
      if (await hasDefaultData()) {
        await claimDefaultData(project.projectId)
      }
    }
    catch {
      // non-critical
    }

    // 6. Init all stores with the new project's data (in parallel)
    const pid = project.projectId
    await Promise.all([
      chatStore.init(pid),
      memoryStore.init(pid),
      stateStore.init(pid),
      groupChatStore.init(pid),
      eventStore.init(pid),
      clockStore.init(pid),
      viewModeStore.init(pid),
      diaryStore.init(pid),
    ])
  }

  /**
   * Try to restore a project's dirHandle from IndexedDB.
   * Only loads the handle — does NOT verify permission.
   */
  async function restoreDirHandle(project: StudioProject): Promise<boolean> {
    if (project.dirHandle)
      return true

    try {
      const handle = await loadDirHandle(project.name)
      if (handle) {
        project.dirHandle = handle
        return true
      }
    }
    catch {
      // IndexedDB not available
    }
    return false
  }

  /**
   * Auto-restore last opened project on page reload.
   * Reads projectId from localStorage, finds it in the project list,
   * then restores the dirHandle from IndexedDB and verifies permission.
   */
  async function autoRestoreLastProject(): Promise<boolean> {
    const lastId = localStorage.getItem('advjs-studio-current')
    if (!lastId)
      return false

    // Try by projectId first, then fallback to name for old data
    const project = projects.value.find(p => p.projectId === lastId)
      || projects.value.find(p => p.name === lastId)
    if (!project)
      return false

    // For non-local projects, no handle needed
    if (project.source !== 'local') {
      await switchProject(project)
      return true
    }

    // Try to restore dirHandle + verify permission silently
    const handle = await restoreAndVerifyHandle(project.name)
    if (handle)
      project.dirHandle = handle

    // Always restore the project — if dirHandle is missing, the UI will show
    // a reconnect button so the user can re-grant permission with a user gesture.
    await switchProject(project)
    return !!handle
  }

  // Initialize from storage
  loadFromStorage()

  return {
    currentProject,
    currentProjectId,
    projects,
    addProject,
    removeProject,
    setCurrentProject,
    switchProject,
    restoreDirHandle,
    autoRestoreLastProject,
  }
})
