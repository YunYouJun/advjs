import type { AGUIFileMutationRequest, AGUIFileTransferResult } from '@advjs/gui'
import type { WorkspaceFileEntry } from '../utils/workspaceFileSnapshot'
import type { WorkspaceMutationRecord } from '../utils/workspaceMutationJournal'
import type { useWorkspaceTextEditor, WorkspaceTextScope } from './useWorkspaceTextEditor'
import { alertController, toastController } from '@ionic/vue'
import JSZip from 'jszip'
import { onScopeDispose, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { notifyStudioFileSystemRefresh } from '../utils/fs/mutations'
import { setStudioProjectWriteBarrier, whenStudioProjectWritesSettle } from '../utils/projectWriteQueue'
import { commitWorkspaceFileMutation, recoverWorkspaceFileMutation, reviewWorkspaceMutation } from '../utils/workspaceFileMutation'
import { assertWorkspacePath, snapshotWorkspaceFiles, validateWorkspaceEntries, workspaceBytesHash, workspaceContains, workspaceEntryEqual } from '../utils/workspaceFileSnapshot'
import { isLocalWorkspaceMutation, refreshWorkspaceMutationBarrier, subscribeWorkspaceMutationChanges, validateWorkspaceMutationRecord } from '../utils/workspaceMutationJournal'
import { snapshotWorkspaceMutation, workspaceMutationAfter } from '../utils/workspaceTransferRecord'

const html = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' })[char]!)

/** Native file CRUD, author confirmation and persistent interrupted-operation recovery. */
export function useWorkspaceFileMutations(getScope: () => WorkspaceTextScope | null, editor: ReturnType<typeof useWorkspaceTextEditor>, reloadContent: () => Promise<void>, refreshFiles: () => void = () => {}) {
  const { t } = useI18n()
  const records = shallowRef<WorkspaceMutationRecord[]>([])
  const error = shallowRef('')
  const busy = shallowRef(false)
  const downloads = new Map<string, ReturnType<typeof setTimeout>>()
  let refreshRevision = 0
  let restartSubscription = () => {}
  function check(scope: WorkspaceTextScope) {
    const now = getScope()
    if (!now || now.fs !== scope.fs || now.root !== scope.root || now.projectId !== scope.projectId)
      throw new Error('ADV_STUDIO_CONTENT_SCOPE_CHANGED')
  }
  async function refresh() {
    const revision = ++refreshRevision
    const scope = getScope()
    if (!scope)
      return
    try {
      const next = await refreshWorkspaceMutationBarrier(scope.fs, scope.projectId, scope.root)
      check(scope)
      if (revision !== refreshRevision)
        return
      const wasBlocked = records.value.length > 0 || Boolean(error.value)
      const externalRecovery = Boolean(error.value) || records.value.some(record => !isLocalWorkspaceMutation(record))
      records.value = next
      error.value = ''
      notifyStudioFileSystemRefresh(scope.fs)
      if (wasBlocked && !next.length && !busy.value) {
        await reloadContent().catch(() => {})
        if (revision === refreshRevision && getScope()?.fs === scope.fs && externalRecovery)
          refreshFiles()
      }
    }
    catch {
      if (revision === refreshRevision && getScope()?.fs === scope.fs)
        error.value = t('workspace.recoveryReadFailed')
    }
  }
  watch(() => getScope()?.fs, (_fs, _previous, onCleanup) => {
    refreshRevision++
    records.value = []
    error.value = ''
    const scope = getScope()
    if (!scope)
      return
    let stop: (() => void) | undefined
    const start = () => {
      stop?.()
      stop = subscribeWorkspaceMutationChanges(() => {
        void refresh()
      }, () => {
        refreshRevision++
        setStudioProjectWriteBarrier(scope.fs, 'ADV_STUDIO_WORKSPACE_RECOVERY_UNKNOWN')
        error.value = t('workspace.recoveryReadFailed')
        notifyStudioFileSystemRefresh(scope.fs)
      })
    }
    restartSubscription = start
    start()
    const foreground = () => {
      if (!document.hidden)
        void refresh()
    }
    window.addEventListener('focus', foreground)
    document.addEventListener('visibilitychange', foreground)
    onCleanup(() => {
      refreshRevision++
      stop?.()
      restartSubscription = () => {}
      window.removeEventListener('focus', foreground)
      document.removeEventListener('visibilitychange', foreground)
    })
  }, { immediate: true })
  onScopeDispose(() => downloads.forEach((timer, url) => {
    clearTimeout(timer)
    URL.revokeObjectURL(url)
  }))
  async function failure(cause: unknown) {
    const message = cause instanceof Error ? cause.message : String(cause)
    const toast = await toastController.create({
      message: t(/RECOVERY|JOURNAL/.test(message) ? 'workspace.recoveryRequired' : /STORAGE_LIMIT/.test(message) ? 'workspace.mutationLimit' : /CONFLICT|SCOPE_CHANGED|OVERLAP/.test(message) ? 'workspace.fileTransferConflict' : 'workspace.fileTransferFailed'),
      duration: 6000,
      color: 'warning',
      position: 'top',
    })
    await toast.present()
  }
  async function confirm(message: string, button: string, destructive = false) {
    const alert = await alertController.create({
      header: t(destructive ? 'common.confirmDelete' : 'workspace.recoveryTitle'),
      message,
      buttons: [{ text: t('common.cancel'), role: 'cancel' }, { text: button, role: 'confirm', cssClass: destructive ? 'danger' : undefined }],
    })
    await alert.present()
    return (await alert.onDidDismiss()).role === 'confirm'
  }
  async function makeRecord(scope: WorkspaceTextScope, kind: WorkspaceMutationRecord['kind'], roots: string[], before: WorkspaceFileEntry[], after: WorkspaceFileEntry[], drafts: WorkspaceMutationRecord['drafts'] = []): Promise<WorkspaceMutationRecord> {
    const bytes = await validateWorkspaceEntries(roots, before, drafts) + await validateWorkspaceEntries(roots, after)
    check(scope)
    return { id: crypto.randomUUID(), projectId: scope.projectId, root: scope.root, createdAt: Date.now(), kind, roots, before, after, drafts, bytes }
  }
  async function perform(request: AGUIFileMutationRequest): Promise<AGUIFileTransferResult> {
    if (busy.value)
      return { success: false }
    const scope = getScope()
    if (!scope)
      return { success: false }
    busy.value = true
    let deletion: Awaited<ReturnType<typeof editor.prepareDeletion>> | undefined
    try {
      await whenStudioProjectWritesSettle(scope.fs)
      check(scope)
      if (request.kind === 'delete') {
        const paths: string[] = []
        for (const item of request.items) {
          const path = item.handle && await scope.root.resolve(item.handle)
          check(scope)
          if (!path?.length)
            throw new Error('ADV_STUDIO_CONTENT_PATH_INVALID')
          paths.push(path.join('/'))
        }
        const roots = [...new Set(paths)].filter(path => !paths.some(other => other !== path && workspaceContains(other, path)))
        const before = await snapshotWorkspaceFiles(scope.fs, roots, () => check(scope))
        if (roots.some(path => !before.some(entry => entry.path === path)))
          throw new Error('ADV_STUDIO_SOURCE_CONFLICT')
        deletion = await editor.prepareDeletion(scope, roots)
        const record = await makeRecord(scope, 'delete', roots, before, [], deletion.drafts)
        const message = [t('workspace.deleteFilesMessage', { count: roots.length }), ...roots, ...(deletion.drafts.length ? [t('workspace.deletePrivateDrafts', { count: deletion.drafts.length })] : [])].map(html).join('<br>')
        if (!await confirm(message, t('common.delete'), true))
          return { success: false }
        await commitWorkspaceFileMutation(scope.fs, async () => record, {
          check: () => {
            check(scope)
            deletion!.check()
          },
          applied: deletion.commit,
          rollbackApplied: deletion.rollback,
        })
        return { success: true }
      }
      const targetHandle = request.targetDir.handle
      const files = request.kind === 'import' ? [...request.files] : undefined
      if (files && (!files.length || files.length > 100 || files.reduce((size, file) => size + file.size, 0) > 64 * 1024 * 1024))
        throw new Error('ADV_STUDIO_WORKSPACE_STORAGE_LIMIT')
      const name = request.kind === 'create' ? request.name : undefined
      const kind = request.kind === 'create' ? request.entryKind : 'file'
      const receipt = await commitWorkspaceFileMutation(scope.fs, async () => {
        const target = await scope.root.resolve(targetHandle)
        check(scope)
        if (!target)
          throw new Error('ADV_STUDIO_CONTENT_SCOPE_CHANGED')
        const reserved = await editor.draftPaths(scope)
        const after: WorkspaceFileEntry[] = []
        const input = files ?? [new File([], name!)]
        for (const file of input) {
          const base = file.name
          const join = (value: string) => [...target, value].join('/')
          let path = join(base)
          assertWorkspacePath(path)
          const dot = kind === 'file' ? base.lastIndexOf('.') : -1
          const stem = dot > 0 ? base.slice(0, dot) : base
          const suffix = dot > 0 ? base.slice(dot) : ''
          let n = 0
          while (reserved.has(path) || await scope.fs.exists(path)) {
            check(scope)
            path = join(`${stem} ${++n}${suffix}`)
          }
          reserved.add(path)
          if (kind === 'directory') {
            after.push({ path, kind: 'directory' })
          }
          else {
            const data = await file.arrayBuffer()
            after.push({ path, kind: 'file', data, sha256: await workspaceBytesHash(data) })
          }
        }
        return makeRecord(scope, request.kind, after.map(entry => entry.path), [], after)
      }, { check: () => check(scope) })
      return { success: true, ...(request.kind === 'create' ? { createdName: receipt.roots[0]!.split('/').at(-1)! } : {}) }
    }
    catch (cause) {
      await failure(cause)
      return { success: false }
    }
    finally {
      deletion?.release()
      await refresh()
      if (getScope()?.fs === scope.fs && !records.value.length && !error.value)
        await reloadContent().catch(() => {})
      busy.value = false
    }
  }
  async function recover(id: string, mode: 'restore' | 'keep') {
    if (busy.value)
      return
    const scope = getScope()
    const record = records.value.find(record => record.id === id)
    if (!scope || !record)
      return
    busy.value = true
    try {
      if (!await record.root.isSameEntry(scope.root))
        throw new Error('ADV_STUDIO_CONTENT_SCOPE_CHANGED')
      const restoration = mode === 'restore' ? await editor.prepareDraftRestoration(scope, record.drafts) : undefined
      const validate = () => {
        check(scope)
        restoration?.check()
      }
      const actual = await reviewWorkspaceMutation(scope.fs, record, validate)
      const before = new Map(record.before.map(entry => [entry.path, entry]))
      const current = new Map(actual.map(entry => [entry.path, entry]))
      const paths = [...new Set([...record.before, ...workspaceMutationAfter(record), ...actual].map(entry => entry.path))].sort()
      const previews = paths.slice(0, 16).map((path) => {
        const entry = current.get(path)
        const status = !entry ? 'workspace.recoveryMissing' : workspaceEntryEqual(entry, before.get(path)) ? 'workspace.recoveryOriginal' : 'workspace.recoveryCurrent'
        let text = ''
        if (entry?.kind === 'file') {
          try {
            text = new TextDecoder('utf-8', { fatal: true }).decode(entry.data!.slice(0, 4096), { stream: true }).slice(0, 800)
            if (text.includes('\0'))
              throw new Error('Binary preview')
          }
          catch { text = t('workspace.recoveryBinary', { bytes: entry.data!.byteLength }) }
        }
        return `<p><strong>${html(path)}</strong><br>${html(t(status))}${text ? `<br>${html(text).replace(/\n/g, '<br>')}` : ''}</p>`
      })
      const review = [...record.roots, t('workspace.recoveryCurrentFiles', { count: actual.filter(entry => entry.kind === 'file').length }), ...(paths.length > 16 ? [t('workspace.recoveryRemaining', { count: paths.length - 16 })] : []), t(mode === 'restore' ? 'workspace.recoveryRestoreMessage' : 'workspace.recoveryKeepMessage')].map(html).join('<br>') + previews.join('')
      if (!await confirm(review, t(mode === 'restore' ? 'workspace.restoreOperation' : 'workspace.keepCurrentFiles'), mode === 'keep'))
        return
      await recoverWorkspaceFileMutation(scope.fs, record, actual, mode, { check: validate, applied: restoration?.commit })
    }
    catch (cause) { await failure(cause) }
    finally {
      await refresh()
      if (getScope()?.fs === scope.fs && !records.value.length && !error.value) {
        await reloadContent().catch(() => {})
        if (getScope()?.fs === scope.fs)
          refreshFiles()
      }
      busy.value = false
    }
  }
  async function download(id: string) {
    if (busy.value)
      return
    const record = records.value.find(record => record.id === id)
    if (!record)
      return
    busy.value = true
    try {
      await validateWorkspaceMutationRecord(record)
      const scope = getScope()
      if (!scope || !await record.root.isSameEntry(scope.root))
        throw new Error('ADV_STUDIO_CONTENT_SCOPE_CHANGED')
      let current: WorkspaceFileEntry[] = []
      let currentUnavailable = false
      try {
        current = await snapshotWorkspaceMutation(scope.fs, record, () => check(scope))
      }
      catch {
        check(scope)
        currentUnavailable = true
      }
      const zip = new JSZip()
      if (currentUnavailable)
        zip.file('CURRENT-UNAVAILABLE.txt', t('workspace.recoveryCurrentUnavailable'))
      for (const [prefix, entries] of [['saved', record.before], ['pending-imports', workspaceMutationAfter(record)], ['current', current]] as const) {
        for (const entry of entries) {
          if (entry.kind === 'directory')
            zip.folder(`${prefix}/${entry.path}`)
          else
            zip.file(`${prefix}/${entry.path}`, entry.data!)
        }
      }
      for (const draft of record.drafts)
        zip.file(`private-drafts/${draft.path}`, draft.content)
      const url = URL.createObjectURL(await zip.generateAsync({ type: 'blob' }))
      downloads.set(url, setTimeout(() => {
        URL.revokeObjectURL(url)
        downloads.delete(url)
      }, 30_000))
      const link = document.createElement('a')
      link.href = url
      link.download = `workspace-recovery-${record.createdAt}.zip`
      link.click()
    }
    catch (cause) { await failure(cause) }
    finally { busy.value = false }
  }
  async function retry() {
    if (busy.value)
      return
    const scope = getScope()
    busy.value = true
    try {
      restartSubscription()
      await refresh()
      if (scope && getScope()?.fs === scope.fs && !records.value.length && !error.value) {
        await reloadContent()
        if (getScope()?.fs === scope.fs)
          refreshFiles()
      }
    }
    catch (cause) { await failure(cause) }
    finally { busy.value = false }
  }
  return { records, error, busy, refresh, retry, perform, recover, download }
}
