import type { IFileSystem } from '../utils/fs'
import type { StudioContentSource } from '../utils/projectContentMutation'
import type { StudioFileTransfer } from '../utils/projectFileTransfer'
import type { WorkspacePrivateDraft } from '../utils/workspaceFileSnapshot'
import { computed, shallowReactive, shallowRef } from 'vue'
import { isAudioFile, isImageFile } from '../utils/fs'
import { commitStudioContentSource, isStudioContentConflict, readStudioContentSource } from '../utils/projectContentMutation'
import { workspaceContains } from '../utils/workspaceFileSnapshot'

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
  const moving = new Set<Draft>()
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
    if (!draft || draft.saving || moving.has(draft) || isLoading.value)
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
    if (!ticket || request.value !== ticket.request || active.value !== ticket.draft || active.value?.content !== ticket.content || active.value?.saving || (active.value && moving.has(active.value)))
      return false
    try {
      assertScope(ticket.request.scope)
    }
    catch {
      return false
    }
    return open(ticket.request.path, true)
  }
  async function ownedDrafts(scope: WorkspaceTextScope) {
    const owned: Draft[] = []
    for (const draft of drafts) {
      if (draft.scope.projectId === scope.projectId && await draft.scope.root.isSameEntry(scope.root))
        owned.push(draft)
    }
    assertScope(scope)
    return owned
  }
  async function draftPaths(scope: WorkspaceTextScope) {
    return new Set((await ownedDrafts(scope)).map(draft => draft.source.path))
  }
  async function prepareDeletion(scope: WorkspaceTextScope, paths: readonly string[]) {
    const affected = (await ownedDrafts(scope)).filter(draft => paths.some(path => workspaceContains(path, draft.source.path)))
    if (affected.some(draft => draft.saving || moving.has(draft)))
      throw new Error('ADV_STUDIO_TRANSFER_DRAFT_CONFLICT')
    const captured = affected.map(draft => ({ draft, content: draft.content }))
    const oldRequest = request.value
    const oldActive = active.value
    captured.forEach(({ draft }) => moving.add(draft))
    const privateDrafts: WorkspacePrivateDraft[] = captured.filter(({ draft }) => draft.content !== draft.source.content).map(({ draft }) => ({ path: draft.source.path, source: draft.source.content, content: draft.content }))
    function check() {
      assertScope(scope)
      if (captured.some(({ draft, content }) => draft.content !== content || draft.saving))
        throw new Error('ADV_STUDIO_TRANSFER_DRAFT_CONFLICT')
      for (const draft of drafts) {
        if (draft.scope.root === scope.root && paths.some(path => workspaceContains(path, draft.source.path)) && !captured.some(item => item.draft === draft))
          throw new Error('ADV_STUDIO_TRANSFER_DRAFT_CONFLICT')
      }
    }
    return {
      drafts: privateDrafts,
      check,
      commit() {
        check()
        affected.forEach(draft => drafts.delete(draft))
        if (request.value && paths.some(path => workspaceContains(path, request.value!.path))) {
          request.value = undefined
          active.value = undefined
          isLoading.value = false
          readError.value = ''
        }
      },
      rollback() {
        for (const draft of affected) {
          if ([...drafts].some(other => other !== draft && (other.scope.root === scope.root || other.scope.root === draft.scope.root) && other.source.path === draft.source.path && other.content !== draft.content))
            throw new Error('ADV_STUDIO_TRANSFER_DRAFT_CONFLICT')
          drafts.add(draft)
        }
        const now = getScope()
        if (!request.value && now?.fs === scope.fs && now.root === scope.root) {
          request.value = oldRequest
          active.value = oldActive
        }
      },
      release() { affected.forEach(draft => moving.delete(draft)) },
    }
  }
  async function prepareDraftRestoration(scope: WorkspaceTextScope, saved: readonly WorkspacePrivateDraft[]) {
    const owned = await ownedDrafts(scope)
    const captured = owned.filter(draft => saved.some(item => item.path === draft.source.path)).map(draft => ({ draft, content: draft.content }))
    function check() {
      assertScope(scope)
      if (captured.some(({ draft, content }) => draft.content !== content || draft.saving || moving.has(draft)))
        throw new Error('ADV_STUDIO_TRANSFER_DRAFT_CONFLICT')
      for (const item of saved) {
        if (captured.some(({ draft }) => draft.source.path === item.path && draft.content !== item.content))
          throw new Error('ADV_STUDIO_TRANSFER_DRAFT_CONFLICT')
        if ([...drafts].some(draft => draft.scope.root === scope.root && draft.source.path === item.path && (!captured.some(value => value.draft === draft) || draft.content !== item.content)))
          throw new Error('ADV_STUDIO_TRANSFER_DRAFT_CONFLICT')
      }
    }
    check()
    return {
      check,
      commit() {
        check()
        for (const item of saved) {
          if (owned.some(draft => draft.source.path === item.path))
            continue
          const draft = shallowReactive<Draft>({ scope, source: Object.freeze({ fs: scope.fs, path: item.path, content: item.source }), content: item.content, error: '', saving: false })
          drafts.add(draft)
          captured.push({ draft, content: draft.content })
          owned.push(draft)
          if (!active.value) {
            request.value = { scope, path: item.path }
            active.value = draft
            isLoading.value = false
            readError.value = ''
          }
        }
      },
    }
  }
  async function prepareRelocation(scope: WorkspaceTextScope, transfers: readonly StudioFileTransfer[]) {
    const moves = transfers.filter(transfer => transfer.move)
    const under = (parent: string, path: string) => path === parent || path.startsWith(`${parent}/`)
    const affected: { draft: Draft, source: StudioContentSource, path: string }[] = []
    const owned = await ownedDrafts(scope)
    if (transfers.some(transfer => owned.some(draft => draft.source.path === transfer.target)))
      throw new Error('ADV_STUDIO_TRANSFER_DRAFT_CONFLICT')
    for (const draft of owned) {
      const move = moves.find(move => under(move.source, draft.source.path))
      if (!move)
        continue
      const path = move.target + draft.source.path.slice(move.source.length)
      if (draft.saving || moving.has(draft) || owned.some(other => other !== draft && other.source.path === path))
        throw new Error('ADV_STUDIO_TRANSFER_DRAFT_CONFLICT')
      affected.push({ draft, source: draft.source, path })
    }
    affected.forEach(({ draft }) => moving.add(draft))
    let reopen: Request | undefined
    let previousRequest: Request | undefined
    let relocatedRequest: Request | undefined
    return {
      drafts: owned.filter(draft => draft.content !== draft.source.content && transfers.some(transfer => under(transfer.source, draft.source.path))).map(draft => ({ path: draft.source.path, source: draft.source.content, content: draft.content })),
      commit() {
        assertScope(scope)
        previousRequest = request.value
        for (const { draft, path } of affected) {
          draft.source = Object.freeze({ ...draft.source, path })
          if (active.value === draft && request.value)
            request.value = { scope: request.value.scope, path }
        }
        const current = request.value
        const move = current && moves.find(move => under(move.source, current.path))
        if (current && move && !active.value) {
          reopen = { scope: current.scope, path: move.target + current.path.slice(move.source.length) }
          request.value = reopen
          isLoading.value = false
          readError.value = ''
        }
        relocatedRequest = request.value
      },
      rollback() {
        for (const { draft, source } of affected) {
          if ([...drafts].some(other => other !== draft && (other.scope.root === scope.root || other.scope.root === draft.scope.root) && other.source.path === source.path && other.content !== draft.content))
            throw new Error('ADV_STUDIO_TRANSFER_DRAFT_CONFLICT')
        }
        for (const { draft, source } of affected)
          draft.source = source
        if (request.value === relocatedRequest && getScope()?.fs === scope.fs)
          request.value = previousRequest
        reopen = undefined
      },
      async after() {
        if (reopen && request.value === reopen)
          await open(reopen.path)
      },
      release() { affected.forEach(({ draft }) => moving.delete(draft)) },
    }
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
    prepareRelocation,
    prepareDeletion,
    prepareDraftRestoration,
    draftPaths,
  }
}
