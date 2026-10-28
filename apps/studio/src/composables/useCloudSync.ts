import type { ConflictFile, CosConfig } from '../utils/cloudSync'
import type { CloudSyncSnapshot } from '../utils/cloudSyncWorkspace'
import { onUnmounted, ref, watch } from 'vue'
import { useAuthStore } from '../stores/useAuthStore'
import { useSettingsStore } from '../stores/useSettingsStore'
import { useStudioStore } from '../stores/useStudioStore'
import {
  classifySyncCandidates,
  downloadBlobFromCloud,
  listCloudFilesDetailed,
  uploadToCloud,
} from '../utils/cloudSync'
import { createCloudSyncWorkspace, isCloudSyncPath } from '../utils/cloudSyncWorkspace'
import { isTextFile } from '../utils/fs'
import { useProjectContent } from './useProjectContent'

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'failed'

/**
 * Cloud sync composable for auto-save and periodic bidirectional sync.
 */
export function useCloudSync() {
  const settingsStore = useSettingsStore()
  const studioStore = useStudioStore()
  const authStore = useAuthStore()
  const projectContent = useProjectContent()
  let scopeEpoch = 0
  let disposed = false
  let saveSequence = 0
  let editRevision = 0

  // Auto-save state
  const isDirty = ref(false)
  const isSaving = ref(false)
  const lastSaved = ref<Date | null>(null)

  // Auto-sync state
  const syncStatus = ref<SyncStatus>('idle')
  const lastSyncTime = ref<Date | null>(null)
  const isSyncing = ref(false)

  let autoSaveTimer: ReturnType<typeof setTimeout> | null = null
  let autoSyncTimer: ReturnType<typeof setInterval> | null = null

  /**
   * Get COS config stripped of non-COS fields (for passing to cloudSync utils).
   */
  function getCosConfig(): CosConfig {
    const { bucket, region } = settingsStore.cos
    return { bucket, region }
  }

  /**
   * Check if COS is properly configured.
   */
  function isCosConfigured(): boolean {
    const { bucket, region } = settingsStore.cos
    return !!(bucket && region)
  }

  /**
   * Auto-save a single file to cloud with debounce.
   * Call this on every content change; it debounces internally (2s).
   */
  function autoSave(filePath: string, content: string) {
    if (!settingsStore.cos.autoSave || !isCosConfigured())
      return

    isDirty.value = true
    editRevision++

    if (autoSaveTimer)
      clearTimeout(autoSaveTimer)

    const epoch = scopeEpoch
    autoSaveTimer = setTimeout(async () => {
      if (epoch !== scopeEpoch || disposed)
        return
      await saveNow(filePath, content)
    }, 2000)
  }

  /**
   * Immediately save a file to cloud (bypasses debounce).
   */
  async function saveNow(filePath: string, content: string) {
    if (!isCosConfigured())
      return

    if (autoSaveTimer) {
      clearTimeout(autoSaveTimer)
      autoSaveTimer = null
    }

    const epoch = scopeEpoch
    const sequence = ++saveSequence
    const revision = editRevision
    isSaving.value = true
    try {
      await uploadToCloud(getCosConfig(), filePath, content)
      if (!disposed && epoch === scopeEpoch && sequence === saveSequence && revision === editRevision) {
        isDirty.value = false
        lastSaved.value = new Date()
      }
    }
    catch {
      // Save failed, keep dirty state
    }
    finally {
      if (sequence === saveSequence)
        isSaving.value = false
    }
  }

  /**
   * Pending conflicts from the most recent `performSync()` call. UI surfaces
   * them in `SyncConflictModal.vue`. Failed/skipped choices stay available
   * until resolved, dismissed, or invalidated by a project/account switch.
   */
  const pendingConflicts = ref<ConflictFile[]>([])

  interface ConflictContext {
    config: CosConfig
    prefix: string
    projectId: string
    startedAt: number
    cloudMtimes: Map<string, number>
    workspace: ReturnType<typeof createCloudSyncWorkspace>
    expected: CloudSyncSnapshot
    assertCurrent: () => void
    hadFailures: boolean
  }
  let conflictContext: ConflictContext | null = null
  // Downloaded bytes survive failed adoption and skipped choices for explicit review.
  const conflictPayloads = new Map<string, Blob>()

  async function showConflicts(context: ConflictContext, payloads: Map<string, Blob>) {
    const conflicts: ConflictFile[] = []
    for (const [path, cloud] of payloads) {
      const local = context.expected.get(path)
      const binary = !isTextFile(path)
      conflicts.push({
        path,
        binary,
        localContent: binary ? '' : await local?.content.text() ?? '',
        cloudContent: binary ? '' : await cloud.text(),
        localMtime: local?.lastModified.getTime() ?? 0,
        cloudMtime: context.cloudMtimes.get(path) ?? 0,
      })
    }
    context.assertCurrent()
    conflictContext = context
    conflictPayloads.clear()
    for (const [path, blob] of payloads)
      conflictPayloads.set(path, blob)
    pendingConflicts.value = conflicts
  }

  function finishSync(context: ConflictContext) {
    context.assertCurrent()
    // The start time keeps edits made during transfer/review after the baseline.
    studioStore.updateProject(context.projectId, { syncedAt: context.startedAt })
    syncStatus.value = 'success'
    lastSyncTime.value = new Date()
  }

  /** Read before network waits, then adopt one validated local batch. */
  async function performSync(): Promise<{ uploaded: number, downloaded: number, conflicts: number, failed: string[] }> {
    const result = { uploaded: 0, downloaded: 0, conflicts: pendingConflicts.value.length, failed: [] as string[] }
    if (isSyncing.value || result.conflicts)
      return result
    const project = studioStore.currentProject
    if (!project || !isCosConfigured())
      return result

    const epoch = scopeEpoch
    const projectId = project.projectId
    const startedAt = Date.now()
    const config = getCosConfig()
    const prefix = project.cosPrefix || `${project.name}/`
    const assertScope = () => {
      if (disposed || epoch !== scopeEpoch)
        throw new Error('ADV_STUDIO_SYNC_SCOPE_CHANGED')
    }
    isSyncing.value = true
    syncStatus.value = 'syncing'
    try {
      await projectContent.whenReady()
      assertScope()
      const fs = projectContent.getFs()
      if (!fs)
        throw new Error('ADV_STUDIO_SYNC_LOCAL_WORKSPACE_REQUIRED')
      const assertCurrent = () => {
        assertScope()
        if (projectContent.getFs() !== fs)
          throw new Error('ADV_STUDIO_SYNC_WORKSPACE_CHANGED')
      }
      const workspace = createCloudSyncWorkspace(fs, assertCurrent)
      const expected = await workspace.capture()
      const cloudPaths = new Map<string, number>()
      const context: ConflictContext = { config, prefix, projectId, startedAt, cloudMtimes: cloudPaths, workspace, expected, assertCurrent, hadFailures: false }
      const cloudFiles = await listCloudFilesDetailed(config, prefix)
      assertCurrent()
      for (const file of cloudFiles) {
        const path = file.key.startsWith(prefix) ? file.key.slice(prefix.length) : ''
        if (path && path.endsWith('/'))
          continue
        const mtime = new Date(file.lastModified).getTime()
        if (!isCloudSyncPath(path) || !Number.isFinite(mtime) || cloudPaths.has(path)) {
          result.failed.push(file.key)
          continue
        }
        cloudPaths.set(path, mtime)
      }
      const localPaths = new Map([...expected].map(([path, file]) => [path, file.lastModified.getTime()]))
      const candidates = classifySyncCandidates({ localPaths, cloudPaths, baselineMs: project.syncedAt })
      const downloads = new Map<string, Blob>()
      const conflicts = new Map<string, Blob>()
      for (const candidate of candidates) {
        assertCurrent()
        try {
          if (candidate.decision === 'upload') {
            await workspace.check(expected)
            await uploadToCloud(config, prefix + candidate.path, expected.get(candidate.path)!.content)
            result.uploaded++
          }
          else if (candidate.decision === 'download' || candidate.decision === 'conflict') {
            const content = await downloadBlobFromCloud(config, prefix + candidate.path)
            assertCurrent()
            ;(candidate.decision === 'download' ? downloads : conflicts).set(candidate.path, content)
          }
        }
        catch {
          assertCurrent()
          result.failed.push(candidate.path)
        }
      }
      try {
        if (downloads.size) {
          context.expected = await workspace.apply(expected, downloads)
          result.downloaded = downloads.size
        }
        else {
          await workspace.check(expected)
        }
      }
      catch {
        assertCurrent()
        result.failed.push(...downloads.keys(), '*local-source')
        // Retain the fetched candidates, but require a new review of today's source.
        for (const [path, content] of downloads)
          conflicts.set(path, content)
        context.expected = await workspace.capture()
      }
      assertCurrent()
      context.hadFailures = result.failed.length > 0
      if (conflicts.size) {
        await showConflicts(context, conflicts)
        result.conflicts = conflicts.size
        syncStatus.value = context.hadFailures ? 'failed' : 'idle'
      }
      else if (context.hadFailures) {
        syncStatus.value = 'failed'
      }
      else {
        await workspace.check(context.expected)
        finishSync(context)
      }
    }
    catch {
      result.failed.push('*sync')
      if (!disposed && epoch === scopeEpoch)
        syncStatus.value = 'failed'
    }
    finally {
      isSyncing.value = false
    }
    return result
  }

  /** Resolve only the reviewed project version, retaining skipped/failed payloads. */
  async function resolveConflicts(
    resolutions: Map<string, 'use-local' | 'use-cloud' | 'skip'>,
  ): Promise<{ resolved: number, skipped: number }> {
    const context = conflictContext
    const pending = new Map(conflictPayloads)
    if (!context || isSyncing.value)
      return { resolved: 0, skipped: pending.size }
    isSyncing.value = true
    let resolved = 0
    try {
      context.assertCurrent()
      await context.workspace.check(context.expected)
      const downloads = new Map<string, Blob>()
      for (const [path, content] of pending) {
        const choice = resolutions.get(path) ?? 'skip'
        if (choice === 'use-cloud') {
          downloads.set(path, content)
        }
        else if (choice === 'use-local') {
          const local = context.expected.get(path)
          if (!local)
            continue
          await context.workspace.check(context.expected)
          await uploadToCloud(context.config, context.prefix + path, local.content)
          context.assertCurrent()
          resolved++
          pending.delete(path)
        }
      }
      if (downloads.size) {
        context.expected = await context.workspace.apply(context.expected, downloads)
        for (const path of downloads.keys())
          pending.delete(path)
        resolved += downloads.size
      }
      await context.workspace.check(context.expected)
      if (pending.size) {
        await showConflicts(context, pending)
        syncStatus.value = context.hadFailures ? 'failed' : 'idle'
      }
      else {
        dismissConflicts()
        if (context.hadFailures)
          syncStatus.value = 'failed'
        else
          finishSync(context)
      }
    }
    catch {
      try {
        context.assertCurrent()
        syncStatus.value = 'failed'
        context.hadFailures = true
        context.expected = await context.workspace.capture()
        await showConflicts(context, pending)
      }
      catch {
        // A switched scope cannot receive the previous project's candidates.
      }
    }
    finally {
      isSyncing.value = false
    }
    return { resolved, skipped: pending.size }
  }

  function dismissConflicts() {
    pendingConflicts.value = []
    conflictContext = null
    conflictPayloads.clear()
  }

  /**
   * Start automatic periodic sync.
   */
  function startAutoSync() {
    stopAutoSync()

    if (!settingsStore.cos.autoSync || !isCosConfigured())
      return

    const intervalMs = settingsStore.cos.syncInterval * 60 * 1000
    autoSyncTimer = setInterval(() => {
      performSync()
    }, intervalMs)
  }

  /**
   * Stop automatic periodic sync.
   */
  function stopAutoSync() {
    if (autoSyncTimer) {
      clearInterval(autoSyncTimer)
      autoSyncTimer = null
    }
  }

  // Invalidate work immediately, including switch-away/switch-back and logout.
  watch(
    () => [studioStore.currentProject?.projectId, studioStore.currentProject?.name, studioStore.currentProject?.source, studioStore.currentProject?.dirHandle, studioStore.currentProject?.cosPrefix, authStore.userId, settingsStore.cos.bucket, settingsStore.cos.region],
    () => {
      scopeEpoch++
      saveSequence++
      isSaving.value = false
      isDirty.value = false
      lastSaved.value = null
      lastSyncTime.value = null
      syncStatus.value = 'idle'
      if (autoSaveTimer) {
        clearTimeout(autoSaveTimer)
        autoSaveTimer = null
      }
      dismissConflicts()
    },
    { flush: 'sync' },
  )

  // Watch for autoSync setting changes
  watch(
    () => settingsStore.cos.autoSync,
    (enabled) => {
      if (enabled)
        startAutoSync()
      else
        stopAutoSync()
    },
  )

  // Watch for syncInterval changes
  watch(
    () => settingsStore.cos.syncInterval,
    () => {
      if (settingsStore.cos.autoSync) {
        stopAutoSync()
        startAutoSync()
      }
    },
  )

  // Clean up timers when the component using this composable is unmounted
  onUnmounted(() => {
    disposed = true
    scopeEpoch++
    dismissConflicts()
    if (autoSaveTimer) {
      clearTimeout(autoSaveTimer)
      autoSaveTimer = null
    }
    stopAutoSync()
  })

  return {
    // Auto-save
    isDirty,
    isSaving,
    lastSaved,
    autoSave,
    saveNow,

    // Auto-sync
    syncStatus,
    lastSyncTime,
    isSyncing,
    performSync,
    startAutoSync,
    stopAutoSync,

    // Conflict resolution
    pendingConflicts,
    resolveConflicts,
    dismissConflicts,

    // Utils
    isCosConfigured,
  }
}
