import type { BrowserProjectSession, BrowserSessionStorage, RecentProject, SavedBrowserProject } from './browser-session'
import { computed, shallowRef } from 'vue'

export type ProjectRecoveryStatus = 'idle' | 'restoring' | 'permission-required' | 'unavailable'

export function createBrowserProjectRecovery(options: {
  storage: BrowserSessionStorage
  open: (handle: FileSystemDirectoryHandle) => Promise<unknown>
  pick: () => Promise<FileSystemDirectoryHandle>
  isCurrent?: (handle: FileSystemDirectoryHandle) => boolean
  warn: (error: unknown) => void
}) {
  const session = shallowRef<BrowserProjectSession>({ projects: [] })
  const status = shallowRef<ProjectRecoveryStatus>('idle')
  const pending = shallowRef<SavedBrowserProject>()
  const error = shallowRef<unknown>()
  let openSequence = 0
  let loaded: Promise<void> | undefined
  const identities = new WeakMap<FileSystemDirectoryHandle, string>()

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

  /** Resolve identity without recording an unsuccessful attempt as the current project. */
  async function identify(handle: FileSystemDirectoryHandle) {
    await load()
    const cached = identities.get(handle)
    if (cached)
      return cached
    for (const project of session.value.projects) {
      try {
        if (project.handle && await handle.isSameEntry(project.handle)) {
          identities.set(handle, project.id)
          return project.id
        }
      }
      catch {
        // Deleted or inaccessible handles are not identities for this project.
      }
    }
    const id = crypto.randomUUID()
    identities.set(handle, id)
    return id
  }

  async function remember(handle: FileSystemDirectoryHandle, templateId?: string, current = () => true) {
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
    if (!current())
      return
    const id = existing?.id ?? await identify(handle)
    if (!current())
      return
    const project: SavedBrowserProject = {
      id,
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
    return project.id
  }

  async function openSaved(project: SavedBrowserProject, interactive: boolean) {
    const request = ++openSequence
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
        if (request !== openSequence)
          return false
        if (permission !== 'granted') {
          status.value = 'permission-required'
          return false
        }
      }
      if (request !== openSequence)
        return false
      if (await options.open(handle) === false)
        return false
      const current = () => request === openSequence && (options.isCurrent?.(handle!) ?? true)
      await remember(handle, project.templateId, current)
      return current()
    }
    catch (failure) {
      if (request !== openSequence)
        return false
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
    const request = ++openSequence
    status.value = 'restoring'
    await load()
    if (request !== openSequence)
      return false
    const project = session.value.projects.find(item => item.id === session.value.currentId)
    if (!project) {
      status.value = 'idle'
      return false
    }
    return await openSaved(project, false)
  }

  function cancelPending() {
    openSequence++
    pending.value = undefined
    status.value = 'idle'
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
      openSequence++
      pending.value = undefined
      error.value = undefined
      status.value = 'idle'
    }
    await persist()
  }

  return { load, identify, remember, restore, cancelPending, reopen, remove, recentProjects, status, pending, error }
}
