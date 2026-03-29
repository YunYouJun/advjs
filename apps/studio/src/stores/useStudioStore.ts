import { defineStore } from 'pinia'
import { ref } from 'vue'
import { loadDirHandle, restoreAndVerifyHandle, saveDirHandle } from '../utils/dirHandleStore'

export interface StudioProject {
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

  // Restore project list from localStorage (without dirHandle)
  function loadFromStorage() {
    try {
      const saved = localStorage.getItem('advjs-studio-projects')
      if (saved) {
        const parsed = JSON.parse(saved) as Array<{
          name: string
          url?: string
          source?: 'local' | 'url' | 'cos'
          cosPrefix?: string
          lastOpened: number
        }>
        projects.value = parsed.map(p => ({
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
      name: p.name,
      url: p.url,
      source: p.source,
      cosPrefix: p.cosPrefix,
      lastOpened: p.lastOpened,
    }))
    localStorage.setItem('advjs-studio-projects', JSON.stringify(serializable))
  }

  function addProject(project: StudioProject) {
    // Remove existing project with same name
    const idx = projects.value.findIndex(p => p.name === project.name)
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

      // Persist current project name for auto-restore on reload
      localStorage.setItem('advjs-studio-current', project.name)

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
   * Reads project name from localStorage, finds it in the project list,
   * then restores the dirHandle from IndexedDB and verifies permission.
   */
  async function autoRestoreLastProject(): Promise<boolean> {
    const lastName = localStorage.getItem('advjs-studio-current')
    if (!lastName)
      return false

    const project = projects.value.find(p => p.name === lastName)
    if (!project)
      return false

    // For non-local projects, no handle needed
    if (project.source !== 'local') {
      currentProject.value = project
      return true
    }

    // Try to restore dirHandle + verify permission silently
    const handle = await restoreAndVerifyHandle(project.name)
    if (handle) {
      project.dirHandle = handle
      currentProject.value = project
      return true
    }

    // Permission denied or handle not found — don't auto-restore
    return false
  }

  // Initialize from storage
  loadFromStorage()

  return {
    currentProject,
    projects,
    addProject,
    removeProject,
    setCurrentProject,
    restoreDirHandle,
    autoRestoreLastProject,
  }
})
