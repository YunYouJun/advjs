import type { BrowserProjectSession, BrowserSessionStorage, RecentProject, SavedBrowserProject } from './browser-session'
import { computed, shallowRef } from 'vue'

export type ProjectRecoveryStatus = 'idle' | 'restoring' | 'permission-required' | 'unavailable'

export function createBrowserProjectRecovery(options: {
  storage: BrowserSessionStorage
  open: (handle: FileSystemDirectoryHandle) => Promise<unknown>
  pick: () => Promise<FileSystemDirectoryHandle>
  warn: (error: unknown) => void
}) {
  const session = shallowRef<BrowserProjectSession>({ projects: [] })
  const status = shallowRef<ProjectRecoveryStatus>('idle')
  const pending = shallowRef<SavedBrowserProject>()
  const error = shallowRef<unknown>()
  let loaded: Promise<void> | undefined

  const recentProjects = computed<RecentProject[]>(() => session.value.projects.map(({ handle: _handle, ...project }) => project))

  function load() {
    return loaded ??= options.storage.load().then((saved) => {
      session.value = saved
    }).catch((error) => {
      options.warn(error)
    })
  }

  async function persist() {
    try {
      await options.storage.save(session.value)
    }
    catch (error) {
      // Opening/editing a project still works if the browser blocks storage.
      options.warn(error)
    }
  }

  async function remember(handle: FileSystemDirectoryHandle, templateId?: string) {
    await load()
    let existing: SavedBrowserProject | undefined
    for (const project of session.value.projects) {
      if (!project.handle)
        continue
      try {
        if (await handle.isSameEntry(project.handle)) {
          existing = project
          break
        }
      }
      catch {
        // A deleted directory must not prevent opening another project.
      }
    }
    const project: SavedBrowserProject = {
      id: existing?.id ?? crypto.randomUUID(),
      name: handle.name,
      templateId: templateId ?? existing?.templateId ?? '',
      lastOpenedAt: Date.now(),
      handle,
    }
    session.value = {
      currentId: project.id,
      projects: [project, ...session.value.projects.filter(item => item.id !== project.id && (item.handle || item.name !== project.name))].slice(0, 10),
    }
    pending.value = undefined
    error.value = undefined
    status.value = 'idle'
    await persist()
  }

  async function openSaved(project: SavedBrowserProject, interactive: boolean) {
    error.value = undefined
    pending.value = project
    status.value = 'restoring'
    try {
      let handle = project.handle
      if (!handle) {
        if (!interactive) {
          status.value = 'unavailable'
          return false
        }
        handle = await options.pick()
      }
      else {
        // Call requestPermission directly from the click handler, using the
        // cached handle, before storage or compilation can consume the gesture.
        const permission = interactive
          ? await handle.requestPermission({ mode: 'readwrite' })
          : await handle.queryPermission({ mode: 'readwrite' })
        if (permission !== 'granted') {
          status.value = 'permission-required'
          return false
        }
      }
      await options.open(handle)
      await remember(handle, project.templateId)
      return true
    }
    catch (failure) {
      if (failure instanceof DOMException && failure.name === 'AbortError') {
        status.value = 'idle'
        pending.value = undefined
      }
      else {
        error.value = failure
        status.value = 'unavailable'
        options.warn(failure)
      }
      return false
    }
  }

  async function restore() {
    status.value = 'restoring'
    await load()
    const project = session.value.projects.find(item => item.id === session.value.currentId)
    if (!project) {
      status.value = 'idle'
      return false
    }
    return await openSaved(project, false)
  }

  function reopen(id: string) {
    const project = session.value.projects.find(item => item.id === id)
    return project ? openSaved(project, true) : Promise.resolve(false)
  }

  async function remove(id: string) {
    session.value = {
      currentId: session.value.currentId === id ? undefined : session.value.currentId,
      projects: session.value.projects.filter(project => project.id !== id),
    }
    if (pending.value?.id === id) {
      pending.value = undefined
      error.value = undefined
      status.value = 'idle'
    }
    await persist()
  }

  return { load, remember, restore, reopen, remove, recentProjects, status, pending, error }
}
