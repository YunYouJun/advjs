import type { CosConfig } from '../utils/cloudSync'
import { onUnmounted, ref, watch } from 'vue'
import { useSettingsStore } from '../stores/useSettingsStore'
import { useStudioStore } from '../stores/useStudioStore'
import {
  downloadFromCloud,
  listCloudFilesDetailed,
  uploadToCloud,
} from '../utils/cloudSync'
import { writeFileToDir } from '../utils/fileAccess'

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
   * Perform a full bidirectional sync.
   * Strategy: compare last-modified timestamps; newer file wins.
   */
  async function performSync(): Promise<{ uploaded: number, downloaded: number }> {
    const project = studioStore.currentProject
    if (!project || !isCosConfigured())
      return { uploaded: 0, downloaded: 0 }

    isSyncing.value = true
    syncStatus.value = 'syncing'

    try {
      const config = getCosConfig()
      const prefix = project.cosPrefix || `${project.name}/`
      let uploaded = 0
      let downloaded = 0

      // Get cloud file list with metadata
      const cloudFiles = await listCloudFilesDetailed(config, prefix)

      // If we have a local dirHandle, do bidirectional sync
      if (project.dirHandle) {
        // Collect local files
        const localFiles = await collectLocalFiles(project.dirHandle)

        // Build cloud file map: relative path → lastModified
        const cloudMap = new Map<string, Date>()
        for (const cf of cloudFiles) {
          const relativePath = cf.key.startsWith(prefix) ? cf.key.slice(prefix.length) : cf.key
          if (relativePath && !relativePath.endsWith('/'))
            cloudMap.set(relativePath, new Date(cf.lastModified))
        }

        // Build local file map
        const localMap = new Map<string, { content: string, lastModified: Date }>()
        for (const lf of localFiles)
          localMap.set(lf.path, { content: lf.content, lastModified: lf.lastModified })

        // Upload local files that are newer or missing from cloud
        for (const [path, local] of localMap) {
          const cloudDate = cloudMap.get(path)
          if (!cloudDate || local.lastModified > cloudDate) {
            try {
              await uploadToCloud(config, prefix + path, local.content)
              uploaded++
            }
            catch {
              // skip failed
            }
          }
        }

        // Download cloud files that are newer or missing locally
        for (const [path, cloudDate] of cloudMap) {
          const local = localMap.get(path)
          if (!local || cloudDate > local.lastModified) {
            try {
              const content = await downloadFromCloud(config, prefix + path)
              await writeFileToDir(project.dirHandle, path, content)
              downloaded++
            }
            catch {
              // skip failed
            }
          }
        }
      }

      syncStatus.value = 'success'
      lastSyncTime.value = new Date()
      return { uploaded, downloaded }
    }
    catch {
      syncStatus.value = 'failed'
      return { uploaded: 0, downloaded: 0 }
    }
    finally {
      isSyncing.value = false
    }
  }

  /**
   * Collect all files from a local directory handle recursively.
   */
  async function collectLocalFiles(
    dirHandle: FileSystemDirectoryHandle,
    basePath = '',
  ): Promise<{ path: string, content: string, lastModified: Date }[]> {
    const files: { path: string, content: string, lastModified: Date }[] = []

    try {
      for await (const entry of dirHandle.values()) {
        const entryPath = basePath ? `${basePath}/${entry.name}` : entry.name

        if (entry.kind === 'file') {
          try {
            const fileHandle = await dirHandle.getFileHandle(entry.name)
            const file = await fileHandle.getFile()
            // Only sync text files (skip binaries)
            if (isTextFile(entry.name)) {
              const content = await file.text()
              files.push({
                path: entryPath,
                content,
                lastModified: new Date(file.lastModified),
              })
            }
          }
          catch {
            // skip unreadable files
          }
        }
        else if (entry.kind === 'directory') {
          // Skip hidden directories and node_modules
          if (entry.name.startsWith('.') || entry.name === 'node_modules')
            continue

          try {
            const subDir = await dirHandle.getDirectoryHandle(entry.name)
            const subFiles = await collectLocalFiles(subDir, entryPath)
            files.push(...subFiles)
          }
          catch {
            // skip inaccessible directories
          }
        }
      }
    }
    catch {
      // iteration error
    }

    return files
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

    // Utils
    isCosConfigured,
    collectLocalFiles,
  }
}

/**
 * Check if a filename is likely a text file.
 */
function isTextFile(name: string): boolean {
  const textExtensions = [
    '.md',
    '.adv.md',
    '.txt',
    '.json',
    '.yaml',
    '.yml',
    '.ts',
    '.js',
    '.vue',
    '.css',
    '.html',
    '.xml',
    '.toml',
    '.ini',
    '.cfg',
    '.conf',
  ]
  return textExtensions.some(ext => name.endsWith(ext))
}

/**
 * Collect all files from a local directory handle (exported for use in ProjectsPage).
 */
export async function collectAllLocalFiles(
  dirHandle: FileSystemDirectoryHandle,
  basePath = '',
): Promise<{ path: string, content: string }[]> {
  const files: { path: string, content: string }[] = []

  try {
    for await (const entry of dirHandle.values()) {
      const entryPath = basePath ? `${basePath}/${entry.name}` : entry.name

      if (entry.kind === 'file') {
        if (isTextFile(entry.name)) {
          try {
            const fileHandle = await dirHandle.getFileHandle(entry.name)
            const file = await fileHandle.getFile()
            const content = await file.text()
            files.push({ path: entryPath, content })
          }
          catch {
            // skip
          }
        }
      }
      else if (entry.kind === 'directory') {
        if (entry.name.startsWith('.') || entry.name === 'node_modules')
          continue

        try {
          const subDir = await dirHandle.getDirectoryHandle(entry.name)
          const subFiles = await collectAllLocalFiles(subDir, entryPath)
          files.push(...subFiles)
        }
        catch {
          // skip
        }
      }
    }
  }
  catch {
    // iteration error
  }

  return files
}
