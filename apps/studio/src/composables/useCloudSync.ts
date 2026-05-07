import type { ConflictFile, CosConfig } from '../utils/cloudSync'
import type { IFileSystem } from '../utils/fs'
import { onUnmounted, ref, watch } from 'vue'
import { useSettingsStore } from '../stores/useSettingsStore'
import { useStudioStore } from '../stores/useStudioStore'
import {
  classifySyncCandidates,
  downloadFromCloud,
  listCloudFilesDetailed,
  uploadToCloud,
} from '../utils/cloudSync'
import { createFsForProject } from '../utils/fs'

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'failed'

/**
 * Cloud sync composable for auto-save and periodic bidirectional sync.
 */
export function useCloudSync() {
  const settingsStore = useSettingsStore()
  const studioStore = useStudioStore()

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
    const { bucket, region, secretId, secretKey } = settingsStore.cos
    return { bucket, region, secretId, secretKey }
  }

  /**
   * Check if COS is properly configured.
   */
  function isCosConfigured(): boolean {
    const { bucket, region, secretId, secretKey } = settingsStore.cos
    return !!(bucket && region && secretId && secretKey)
  }

  /**
   * Auto-save a single file to cloud with debounce.
   * Call this on every content change; it debounces internally (2s).
   */
  function autoSave(filePath: string, content: string) {
    if (!settingsStore.cos.autoSave || !isCosConfigured())
      return

    isDirty.value = true

    if (autoSaveTimer)
      clearTimeout(autoSaveTimer)

    autoSaveTimer = setTimeout(async () => {
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

    isSaving.value = true
    try {
      await uploadToCloud(getCosConfig(), filePath, content)
      isDirty.value = false
      lastSaved.value = new Date()
    }
    catch {
      // Save failed, keep dirty state
    }
    finally {
      isSaving.value = false
    }
  }

  /**
   * Pending conflicts from the most recent `performSync()` call. UI surfaces
   * them in `SyncConflictModal.vue`. Cleared when `resolveConflicts()` runs
   * or the user dismisses without resolving.
   */
  const pendingConflicts = ref<ConflictFile[]>([])

  /** Internal: cached fs handle for the project that produced pendingConflicts. */
  let conflictFs: IFileSystem | null = null
  /** Internal: cached config + prefix for resolveConflicts to use. */
  let conflictContext: { config: CosConfig, prefix: string } | null = null

  /**
   * Perform a full bidirectional sync.
   *
   * Conflict-aware:
   *   1. List both sides + classify each path against the project's last-synced
   *      baseline (`StudioProject.syncedAt`).
   *   2. Auto-apply uploads + downloads for unambiguous cases.
   *   3. Surface true conflicts via `pendingConflicts` ref — caller (e.g. the
   *      Sync button in `ProjectOverview.vue`) opens `SyncConflictModal` and
   *      calls `resolveConflicts()` once the user picks a side per file.
   *
   * Falls back to the legacy "newer wins" strategy when `syncedAt` is missing
   * (first sync ever — no shared baseline to detect divergence).
   */
  async function performSync(): Promise<{ uploaded: number, downloaded: number, conflicts: number }> {
    const project = studioStore.currentProject
    if (!project || !isCosConfigured())
      return { uploaded: 0, downloaded: 0, conflicts: 0 }

    isSyncing.value = true
    syncStatus.value = 'syncing'
    pendingConflicts.value = []
    conflictFs = null
    conflictContext = null

    try {
      const config = getCosConfig()
      const prefix = project.cosPrefix || `${project.name}/`
      let uploaded = 0
      let downloaded = 0

      const cloudFiles = await listCloudFilesDetailed(config, prefix)

      let fs: IFileSystem | null = null
      try {
        fs = await createFsForProject({
          dirHandle: project.dirHandle,
          projectId: project.projectId || project.name,
          source: project.source,
        })
      }
      catch {
        // No FS available — bail out gracefully.
      }

      if (!fs) {
        syncStatus.value = 'failed'
        return { uploaded: 0, downloaded: 0, conflicts: 0 }
      }

      const localFileEntries = await fs.collectAllFiles('')

      // Map paths → mtime (epoch ms) for the classifier.
      const cloudPaths = new Map<string, number>()
      const cloudByPath = new Map<string, { lastModified: Date }>()
      for (const cf of cloudFiles) {
        const rel = cf.key.startsWith(prefix) ? cf.key.slice(prefix.length) : cf.key
        if (!rel || rel.endsWith('/'))
          continue
        const ms = new Date(cf.lastModified).getTime()
        cloudPaths.set(rel, ms)
        cloudByPath.set(rel, { lastModified: new Date(cf.lastModified) })
      }

      const localPaths = new Map<string, number>()
      const localByPath = new Map<string, { content: string, mtime: number }>()
      for (const lf of localFileEntries) {
        const ms = lf.lastModified.getTime()
        localPaths.set(lf.path, ms)
        localByPath.set(lf.path, { content: lf.content, mtime: ms })
      }

      const candidates = classifySyncCandidates({
        localPaths,
        cloudPaths,
        baselineMs: project.syncedAt,
      })

      const conflicts: ConflictFile[] = []

      for (const c of candidates) {
        if (c.decision === 'upload') {
          const local = localByPath.get(c.path)
          if (!local)
            continue
          try {
            await uploadToCloud(config, prefix + c.path, local.content)
            uploaded++
          }
          catch {
            // Per-file failures are absorbed; loop continues.
          }
        }
        else if (c.decision === 'download') {
          try {
            const content = await downloadFromCloud(config, prefix + c.path)
            await fs.writeFile(c.path, content)
            downloaded++
          }
          catch {
            // Per-file failures are absorbed; loop continues.
          }
        }
        else if (c.decision === 'conflict') {
          // Materialize both sides so the modal can render diff without
          // re-fetching. Conflict files are usually a small handful, so
          // upfront download is fine.
          const local = localByPath.get(c.path)
          let cloudContent = ''
          try {
            cloudContent = await downloadFromCloud(config, prefix + c.path)
          }
          catch {
            // Cloud read failed — skip rather than block other conflicts.
            continue
          }
          conflicts.push({
            path: c.path,
            localContent: local?.content ?? '',
            cloudContent,
            localMtime: c.localMtime ?? 0,
            cloudMtime: c.cloudMtime ?? 0,
          })
        }
      }

      // Update sync baseline only if there's nothing left for the user to
      // decide. Otherwise we'd lose the divergence point and a re-sync would
      // miss the same conflicts.
      if (conflicts.length === 0) {
        studioStore.updateProject(project.projectId, { syncedAt: Date.now() } as any)
        syncStatus.value = 'success'
        lastSyncTime.value = new Date()
      }
      else {
        pendingConflicts.value = conflicts
        conflictFs = fs
        conflictContext = { config, prefix }
        syncStatus.value = 'idle'
      }

      return { uploaded, downloaded, conflicts: conflicts.length }
    }
    catch {
      syncStatus.value = 'failed'
      return { uploaded: 0, downloaded: 0, conflicts: 0 }
    }
    finally {
      isSyncing.value = false
    }
  }

  /**
   * Apply user-selected resolutions for the conflicts produced by the most
   * recent `performSync()`. Each map key is a file path; value is the side
   * the user wants to keep (or 'skip' to leave both untouched).
   *
   * After applying, the project's `syncedAt` baseline is bumped iff every
   * conflict was resolved (skipped files remain divergent → next sync will
   * surface them again, which is the right behavior).
   */
  async function resolveConflicts(
    resolutions: Map<string, 'use-local' | 'use-cloud' | 'skip'>,
  ): Promise<{ resolved: number, skipped: number }> {
    if (!conflictFs || !conflictContext || pendingConflicts.value.length === 0)
      return { resolved: 0, skipped: 0 }

    const fs = conflictFs
    const { config, prefix } = conflictContext
    let resolved = 0
    let skipped = 0

    for (const conflict of pendingConflicts.value) {
      const choice = resolutions.get(conflict.path) ?? 'skip'
      if (choice === 'skip') {
        skipped++
        continue
      }
      try {
        if (choice === 'use-local')
          await uploadToCloud(config, prefix + conflict.path, conflict.localContent)
        else // use-cloud
          await fs.writeFile(conflict.path, conflict.cloudContent)
        resolved++
      }
      catch {
        // Failed write counts as skip — user can retry on the next sync.
        skipped++
      }
    }

    pendingConflicts.value = []

    const project = studioStore.currentProject
    if (project && skipped === 0) {
      studioStore.updateProject(project.projectId, { syncedAt: Date.now() } as any)
      syncStatus.value = 'success'
      lastSyncTime.value = new Date()
    }

    conflictFs = null
    conflictContext = null
    return { resolved, skipped }
  }

  /**
   * Discard pending conflicts without applying any resolution. The next
   * `performSync()` will re-detect them.
   */
  function dismissConflicts() {
    pendingConflicts.value = []
    conflictFs = null
    conflictContext = null
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
