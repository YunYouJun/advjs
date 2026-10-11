import type { DocumentRecovery } from '../workspaces/document-recovery'
import type { ProjectWorkspace } from '../workspaces/project'
import { defineStore } from 'pinia'
import { computed, onScopeDispose, ref, watch } from 'vue'
import { readDocumentRecovery, recoverableSource, writeDocumentRecovery } from '../workspaces/document-recovery'

/** Recovery is a local copy; only successful workspace writes count as saves. */
export const useProjectDrafts = defineStore('editor:project-drafts', () => {
  const entries = ref(new Map<string, { dirty: boolean, save: () => Promise<boolean> }>())
  const dirty = computed(() => [...entries.value.values()].some(entry => entry.dirty))
  const projectId = ref('')
  const recoveryError = ref('')
  let state: DocumentRecovery = { version: 1, forms: {} }
  let activeWorkspace: ProjectWorkspace | undefined
  let stop: (() => void) | undefined
  let restoring = false
  let sequence = 0

  function persist() {
    if (!projectId.value)
      return
    try {
      writeDocumentRecovery(projectId.value, state, localStorage)
      recoveryError.value = ''
    }
    catch {
      recoveryError.value = 'Draft recovery is unavailable. Save your changes to the project before closing.'
      useConsoleStore().warn(recoveryError.value)
    }
  }
  function capture() {
    if (restoring || useProjectStore().workspace !== activeWorkspace)
      return
    const file = useFileStore().recoveryDocument()
    // Failed or cancelled restoration must survive pagehide and project switches.
    if (!file.path && state.selected)
      return
    state.selected = file.path || undefined
    state.source = file.dirty && recoverableSource(file.path) ? { path: file.path, base: file.base, content: file.content } : undefined
    persist()
  }
  async function activate(workspace: ProjectWorkspace, id: string) {
    stop?.()
    const request = ++sequence
    activeWorkspace = workspace
    projectId.value = id
    entries.value.clear()
    recoveryError.value = ''
    try {
      state = id ? readDocumentRecovery(id, localStorage) : { version: 1, forms: {} }
    }
    catch {
      state = { version: 1, forms: {} }
    }
    const file = useFileStore()
    const project = useProjectStore()
    const version = file.openVersion
    const current = () => request === sequence && project.workspace === workspace
    const untouched = () => current() && file.openVersion === version && !file.isDirty && !file.loading && !dirty.value
    restoring = true
    const selected = state.source?.path ?? state.selected
    try {
      if (selected && untouched()) {
        let handle: FileSystemFileHandle | undefined
        try {
          handle = await project.getLocalFileHandle(selected) as unknown as FileSystemFileHandle
        }
        catch (error) {
          if (!state.source || !(error instanceof DOMException && error.name === 'NotFoundError'))
            throw error
        }
        if (!untouched())
          return
        if (handle)
          await file.setOpenedFileHandle(handle, selected)
        if (!current() || file.isDirty || (handle && (file.openedFilePath !== selected || file.openVersion !== version + 1)))
          return
        if (state.source)
          file.restoreDraft(state.source, !handle)
      }
    }
    catch (error) {
      if (current()) {
        recoveryError.value = 'The previous document could not be restored. Your saved recovery copy has been retained.'
        useConsoleStore().warn(recoveryError.value, { error: String(error) })
      }
    }
    finally {
      if (current()) {
        restoring = false
        stop = watch(() => file.recoveryDocument(), capture, { deep: true })
      }
    }
  }
  function formDraft(key: string) {
    return state.forms[key]
  }
  function saveFormDraft(key: string, draft: { base: string | null, content: string } | undefined, owner = projectId.value, expectedContent?: string) {
    if (!owner || owner !== projectId.value)
      return
    if (!draft && expectedContent !== undefined && state.forms[key]?.content !== expectedContent)
      return
    if (draft)
      state.forms[key] = draft
    else
      delete state.forms[key]
    persist()
  }
  function register(id: string, entry: { dirty: boolean, save: () => Promise<boolean> }) {
    entries.value.set(id, entry)
  }
  function remove(id: string) {
    entries.value.delete(id)
  }
  async function saveAll() {
    for (const entry of entries.value.values()) {
      if (entry.dirty && !await entry.save())
        return false
    }
    const files = useFileStore()
    if (files.isDirty)
      await files.saveOpenedFile()
    return true
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', capture)
    onScopeDispose(() => {
      stop?.()
      window.removeEventListener('pagehide', capture)
    })
  }
  return { dirty, register, remove, saveAll, activate, capture, projectId, recoveryError, formDraft, saveFormDraft }
})
