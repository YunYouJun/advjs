import type { IFileSystem } from '../utils/fs'
import type { StudioContentSource } from '../utils/projectContentMutation'
import { computed, shallowReactive, shallowRef } from 'vue'
import { isAudioFile, isImageFile } from '../utils/fs'
import { commitStudioContentSource, isStudioContentConflict, readStudioContentSource } from '../utils/projectContentMutation'

export interface WorkspaceTextScope {
  projectId: string
  fs: IFileSystem
  root: FileSystemDirectoryHandle
}
interface Request { scope: WorkspaceTextScope, path: string }
interface Draft {
  scope: WorkspaceTextScope
  source: StudioContentSource
  content: string
  error: string
  saving: boolean
  pending?: Promise<WorkspaceSaveResult>
}
interface ReloadTicket { request: Request, draft?: Draft, content?: string }
interface WorkspaceSaveResult { success: boolean, error?: string, conflict?: boolean, newerDraft?: boolean }

/** Page-local author drafts; saved sources always belong to a verified native project root. */
export function useWorkspaceTextEditor(getScope: () => WorkspaceTextScope | null) {
  const active = shallowRef<Draft>()
  const isLoading = shallowRef(false)
  const readError = shallowRef('')
  const drafts = new Set<Draft>()
  const request = shallowRef<Request>()
  // Preserve the existing editor's text formats, including extensionless files
  // and SVG source. Known binary media never become editable text buffers.
  const acceptsPath = (path: string) => !isAudioFile(path) && (!isImageFile(path) || path.toLowerCase().endsWith('.svg'))
  const message = (error: unknown) => error instanceof Error ? error.message : String(error)

  function assertScope(scope: WorkspaceTextScope) {
    const now = getScope()
    if (!now || now.projectId !== scope.projectId || now.fs !== scope.fs || now.root !== scope.root)
      throw new Error('ADV_STUDIO_CONTENT_SCOPE_CHANGED')
  }
  function reset() {
    request.value = undefined
    active.value = undefined
    readError.value = ''
    isLoading.value = false
    for (const draft of drafts) {
      if (!draft.saving && draft.content === draft.source.content)
        drafts.delete(draft)
    }
  }
  async function open(path: string, discardDraft = false): Promise<boolean> {
    const scope = getScope()
    reset()
    if (!scope) {
      readError.value = 'ADV_STUDIO_CONTENT_SCOPE_CHANGED'
      return false
    }
    const opening = { scope, path }
    request.value = opening
    isLoading.value = true
    const assertCurrent = () => {
      assertScope(scope)
      if (request.value !== opening)
        throw new Error('ADV_STUDIO_CONTENT_SCOPE_CHANGED')
    }
    try {
      for (const draft of drafts) {
        if (draft.scope.projectId !== scope.projectId || draft.source.path !== path)
          continue
        const sameRoot = draft.scope.root === scope.root || await draft.scope.root.isSameEntry(scope.root)
        assertCurrent()
        if (!sameRoot)
          continue
        if (draft.pending && draft.scope.fs !== scope.fs)
          await draft.pending
        assertCurrent()
        if (discardDraft) {
          drafts.delete(draft)
          break
        }
        // Rebind an adapter only after checking the same physical root. Keep the
        // original source bytes, including when another author has since saved.
        draft.scope = scope
        draft.source = Object.freeze({ ...draft.source, fs: scope.fs })
        active.value = draft
        return true
      }
      const source = await readStudioContentSource(scope.fs, path, assertCurrent, acceptsPath)
      if (source.content === null)
        throw new Error('ADV_STUDIO_CONTENT_MISSING')
      const bytes = await (await scope.fs.readBlob(path)).arrayBuffer()
      assertCurrent()
      let text: string
      try {
        text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
        if (text.includes('\0'))
          throw new Error('Binary null byte')
      }
      catch {
        throw new Error('ADV_STUDIO_CONTENT_NOT_TEXT')
      }
      if (text !== source.content)
        throw new Error('ADV_STUDIO_SOURCE_CONFLICT')
      assertCurrent()
      const draft = shallowReactive<Draft>({ scope, source, content: source.content, error: '', saving: false })
      drafts.add(draft)
      active.value = draft
      return true
    }
    catch (error) {
      if (request.value === opening)
        readError.value = message(error)
      return false
    }
    finally {
      if (request.value === opening)
        isLoading.value = false
    }
  }
  function update(content: string) {
    if (active.value && !isLoading.value)
      active.value.content = content
  }
  async function save(): Promise<WorkspaceSaveResult> {
    const draft = active.value
    if (!draft || draft.saving || isLoading.value)
      return { success: false, error: 'ADV_STUDIO_CONTENT_SAVE_BUSY' }
    const source = draft.source
    const scope = draft.scope
    const submitted = draft.content
    draft.saving = true
    const operation = (async (): Promise<WorkspaceSaveResult> => {
      try {
        await commitStudioContentSource(source, submitted, () => assertScope(scope), acceptsPath)
        // A different file may be open by now; this receipt belongs only to draft.
        draft.source = Object.freeze({ ...source, content: submitted })
        draft.error = ''
        return { success: true, newerDraft: draft.content !== submitted }
      }
      catch (error) {
        draft.error = message(error)
        return { success: false, error: draft.error, conflict: isStudioContentConflict(error) }
      }
      finally {
        draft.saving = false
        draft.pending = undefined
      }
    })()
    draft.pending = operation
    return operation
  }
  function captureReload(): ReloadTicket | undefined {
    return request.value ? { request: request.value, draft: active.value, content: active.value?.content } : undefined
  }
  async function reload(ticket: ReloadTicket | undefined): Promise<boolean> {
    if (!ticket || request.value !== ticket.request || active.value !== ticket.draft || active.value?.content !== ticket.content || active.value?.saving)
      return false
    try {
      assertScope(ticket.request.scope)
    }
    catch {
      return false
    }
    return open(ticket.request.path, true)
  }
  return {
    path: computed(() => request.value?.path ?? ''),
    content: computed(() => active.value?.content ?? ''),
    isDirty: computed(() => Boolean(active.value && active.value.content !== active.value.source.content)),
    isSaving: computed(() => active.value?.saving ?? false),
    isReady: computed(() => Boolean(active.value)),
    error: computed(() => active.value?.error || readError.value),
    isLoading,
    open,
    reset,
    update,
    save,
    captureReload,
    reload,
  }
}
