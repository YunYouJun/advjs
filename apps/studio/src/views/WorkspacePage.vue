<script setup lang="ts">
import type { FSDirItem, FSFileItem } from '@advjs/gui'
import type { IFileSystem } from '../utils/fs'
import { AGUIAssetsExplorer, getDirItemFromHandle, getFileTypeFromPath, getIconFromFileType } from '@advjs/gui'
import {
  actionSheetController,
  alertController,
  IonButton,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonItemOption,
  IonItemOptions,
  IonItemSliding,
  IonLabel,
  IonList,
  IonModal,
  IonSegment,
  IonSegmentButton,
  IonTitle,
  IonToolbar,
  toastController,
} from '@ionic/vue'
import { addOutline, cloudDownloadOutline, cloudUploadOutline, downloadOutline, folderOpenOutline, libraryOutline, linkOutline, rocketOutline, saveOutline, sparklesOutline, storefrontOutline, trashOutline } from 'ionicons/icons'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import LayoutPage from '../components/common/LayoutPage.vue'
import CreateProjectModal from '../components/CreateProjectModal.vue'
import FilePreview from '../components/FilePreview.vue'
import MobileFileTree from '../components/MobileFileTree.vue'
import ProjectOverview from '../components/ProjectOverview.vue'
import ProjectSwitcher from '../components/ProjectSwitcher.vue'
import WorkspaceReconnect from '../components/WorkspaceReconnect.vue'
import { useContestDemos } from '../composables/useContestDemos'
import { useFileChanges } from '../composables/useFileChanges'
import { importProject } from '../composables/useProjectExport'
import { useResponsive } from '../composables/useResponsive'
import { useSettingsStore } from '../stores/useSettingsStore'
import { useStudioStore } from '../stores/useStudioStore'
import { listCloudFiles, uploadProjectToCloud } from '../utils/cloudSync'
import { restoreAndVerifyHandle } from '../utils/dirHandleStore'
import { createFileSystem, detectAdvProject, openProjectDirectory, supportsFileSystemAccess } from '../utils/fs'
import { BrowserFsAdapter } from '../utils/fs/BrowserFsAdapter'
import { createProjectFromTemplate, quickStartTemplate } from '../utils/projectTemplate'
import { toSlug } from '../utils/slug'

const ZIP_EXT_RE = /\.advpkg\.zip$|\.zip$/i

const { t } = useI18n()
const router = useRouter()
const studioStore = useStudioStore()
const settingsStore = useSettingsStore()
const { hasChange, getChange } = useFileChanges()
const { isDesktop } = useResponsive()
const TRAILING_SLASH_RE = /\/$/

const showCreateModal = ref(false)

// Workspace view segment: 'files' | 'overview'
const workspaceSegment = ref<'files' | 'overview'>('overview')

// Workspace state
const selectedFile = ref<FSFileItem | null>(null)
const fileContent = ref('')
const fileOriginalContent = ref<string | undefined>(undefined)
const isMobilePreviewOpen = ref(false)

// AGUI Explorer state
const rootDir = ref<FSDirItem>()
const curDir = ref<FSDirItem>()

// Responsive — use composable instead of manual resize listener
const isMobile = computed(() => !isDesktop.value)

// Edit state
const isDirty = ref(false)
const editedContent = ref('')

// QuickStart inline state
const isQuickStarting = ref(false)

// Contest demo loader
const { demos: contestDemos, installDemo } = useContestDemos()
const isLoadingDemo = ref(false)

async function handleLoadContestDemo() {
  if (isLoadingDemo.value)
    return
  // Present an action sheet so the presenter / user can pick which demo —
  // 3 contest demos + cancel. Native action sheet looks identical on iOS,
  // Android, and desktop, so we don't need a custom modal.
  const sheet = await actionSheetController.create({
    header: t('contestDemo.pickerTitle'),
    buttons: [
      ...contestDemos.map(meta => ({
        text: t(meta.nameKey ?? '', meta.name),
        data: { slug: meta.slug },
      })),
      { text: t('common.cancel'), role: 'cancel' },
    ],
  })
  await sheet.present()
  const { data, role } = await sheet.onDidDismiss<{ slug: string }>()
  if (role === 'cancel' || !data?.slug)
    return

  const meta = contestDemos.find(d => d.slug === data.slug)
  if (!meta)
    return

  isLoadingDemo.value = true
  try {
    const result = await installDemo(meta)
    const toast = await toastController.create({
      message: result.installed
        ? t('contestDemo.installed', { name: meta.name, count: result.fileCount })
        : t('contestDemo.activated', { name: meta.name }),
      duration: 1800,
      color: 'success',
      position: 'top',
    })
    await toast.present()
  }
  catch (err) {
    const toast = await toastController.create({
      message: t('contestDemo.failed', { message: (err as Error).message }),
      duration: 2500,
      color: 'danger',
      position: 'top',
    })
    await toast.present()
  }
  finally {
    isLoadingDemo.value = false
  }
}

async function handleQuickStart() {
  if (isQuickStarting.value)
    return
  isQuickStarting.value = true
  try {
    const projectId = `quickstart-${Date.now()}`
    const projectName = t('projects.quickStart')
    const { MemoryFsAdapter } = await import('../utils/fs/MemoryFsAdapter')
    const memFs = new MemoryFsAdapter(projectId)
    await memFs.init()
    const files = quickStartTemplate.files(projectName)
    memFs.bulkLoad(files)
    await memFs.persist()
    await studioStore.switchProject({
      projectId,
      name: projectName,
      source: 'local',
      description: t('projects.quickStartDesc'),
      lastOpened: Date.now(),
    })
    const toast = await toastController.create({
      message: t('projects.quickStartReady'),
      duration: 2000,
      position: 'top',
      color: 'success',
    })
    await toast.present()
    router.push('/tabs/world')
  }
  catch {
    const toast = await toastController.create({
      message: t('projects.quickStartFailed'),
      duration: 2500,
      position: 'top',
      color: 'danger',
    })
    await toast.present()
  }
  finally {
    isQuickStarting.value = false
  }
}

// Auto-restore last project on mount
onMounted(async () => {
  // Handle deep-link import: /?import=<projectId>
  try {
    const params = new URLSearchParams(window.location.search)
    const importId = params.get('import')
    if (importId) {
      const existing = studioStore.projects.find(p => p.projectId === importId)
      if (existing) {
        studioStore.switchProject(existing).catch(() => {})
      }
      else {
        const toast = await toastController.create({
          message: t('sharePreview.notFoundTitle') || 'Project not found on this device',
          duration: 4000,
          position: 'top',
          color: 'warning',
        })
        await toast.present()
      }
      const url = new URL(window.location.href)
      url.searchParams.delete('import')
      window.history.replaceState({}, '', url.toString())
    }
  }
  catch {
    // ignore invalid URL params
  }
})

// Initialize rootDir from current project's dirHandle
watch(() => studioStore.currentProject, async (project) => {
  // Reset file preview when project changes
  selectedFile.value = null
  fileContent.value = ''
  fileOriginalContent.value = undefined

  if (project?.dirHandle) {
    rootDir.value = getDirItemFromHandle(project.dirHandle)

    // Auto-load README.md as default preview
    const fs = await createFileSystem({ dirHandle: project.dirHandle })
    await autoLoadReadme(fs)
  }
  else {
    rootDir.value = undefined
    curDir.value = undefined
  }
}, { immediate: true })

/** Try to load README.md (or world.md) as default preview content */
async function autoLoadReadme(fs: import('../utils/fs').IFileSystem) {
  const candidates = ['README.md', 'readme.md', 'adv/world.md']
  for (const name of candidates) {
    try {
      fileContent.value = await fs.readFile(name)
      selectedFile.value = { name, kind: 'file' } as FSFileItem
      return
    }
    catch {
      // file not found, try next
    }
  }
}
const hasProject = computed(() => !!studioStore.currentProject || studioStore.isRestoring)

function normalizeCosPrefix(projectRoot: string, projectName: string): string {
  const root = projectRoot.replace(TRAILING_SLASH_RE, '')
  return `${root}/${projectName}/`
}

async function collectProjectAssets(fs: IFileSystem, basePath = ''): Promise<Array<{ content: Blob, path: string }>> {
  const files: Array<{ content: Blob, path: string }> = []
  for (const entry of await fs.readdir(basePath)) {
    if (entry.type === 'directory') {
      if (!entry.name.startsWith('.') && entry.name !== 'node_modules')
        files.push(...await collectProjectAssets(fs, entry.path))
      continue
    }
    files.push({ content: await fs.readBlob(entry.path), path: entry.path })
  }
  return files
}

function isCosConfigured(): boolean {
  const { bucket, region } = settingsStore.cos
  return !!(bucket && region)
}

function handleCreateFromSource() {
  showCreateModal.value = false
  router.push('/tabs/workspace/import-source')
}

async function handleCreateProject(payload: { displayName: string, slug: string, templateId: string }) {
  showCreateModal.value = false
  const { displayName, slug, templateId } = payload

  try {
    const cosPrefix = normalizeCosPrefix(settingsStore.cos.projectRoot, slug)

    // Only ask for a local directory when the File System Access API is
    // available (desktop Chromium). On Safari / Firefox / iOS / Android the
    // picker doesn't exist, so fall back to the platform adapter
    // (MemoryFs / Capacitor) — same path QuickStart already uses — instead of
    // throwing and leaving the user with no project.
    let projectDir: FileSystemDirectoryHandle | undefined
    let fs: import('../utils/fs').IFileSystem
    if (supportsFileSystemAccess()) {
      const parentDir = await openProjectDirectory()
      projectDir = await parentDir.getDirectoryHandle(slug, { create: true })
      fs = new BrowserFsAdapter(projectDir)
    }
    else {
      fs = await createFileSystem({ projectId: slug })
    }

    await createProjectFromTemplate(fs, slug, templateId)
    // Memory-backed adapters need an explicit persist to survive a reload.
    if (!projectDir && 'persist' in fs && typeof (fs as any).persist === 'function')
      await (fs as any).persist()

    await studioStore.switchProject({
      projectId: slug,
      name: displayName,
      dirHandle: projectDir,
      source: 'local',
      cosPrefix,
      lastOpened: Date.now(),
    })

    const toast = await toastController.create({
      message: t('projects.projectCreated'),
      duration: 2000,
      position: 'top',
      color: 'success',
    })
    await toast.present()

    // Auto-sync to COS if configured (non-blocking)
    if (isCosConfigured()) {
      try {
        const files = await collectProjectAssets(fs)
        const config = {
          bucket: settingsStore.cos.bucket,
          region: settingsStore.cos.region,
        }
        await uploadProjectToCloud(config, cosPrefix, files)

        const syncToast = await toastController.create({
          message: t('projects.projectSynced'),
          duration: 2000,
          position: 'top',
          color: 'success',
        })
        await syncToast.present()
      }
      catch {
        const syncToast = await toastController.create({
          message: t('projects.projectSyncFailed'),
          duration: 2000,
          position: 'top',
          color: 'warning',
        })
        await syncToast.present()
      }
    }
  }
  catch {
    const toast = await toastController.create({
      message: t('projects.createFailed'),
      duration: 2000,
      position: 'top',
      color: 'danger',
    })
    await toast.present()
  }
}

async function handleOpenLocal() {
  try {
    const dirHandle = await openProjectDirectory()
    const detection = await detectAdvProject(dirHandle)

    if (!detection.isValid) {
      const alert = await alertController.create({
        header: t('projects.notAdvProject'),
        message: t('projects.notAdvProjectMessage'),
        buttons: [
          { text: t('common.cancel'), role: 'cancel' },
          {
            text: t('projects.openAnyway'),
            handler: () => {
              studioStore.switchProject({
                projectId: toSlug(dirHandle.name) || dirHandle.name,
                name: dirHandle.name,
                dirHandle,
                source: 'local',
                lastOpened: Date.now(),
              })
            },
          },
        ],
      })
      await alert.present()
      return
    }

    await studioStore.switchProject({
      projectId: toSlug(detection.name) || detection.name,
      name: detection.name,
      dirHandle,
      source: 'local',
      lastOpened: Date.now(),
    })
  }
  catch {
    // User cancelled or API not supported
  }
}

async function handleLoadUrl() {
  const alert = await alertController.create({
    header: t('projects.loadFromUrl'),
    inputs: [
      {
        name: 'url',
        type: 'url',
        placeholder: 'https://example.com/project',
      },
    ],
    buttons: [
      { text: t('common.cancel'), role: 'cancel' },
      {
        text: t('common.load'),
        handler: (data: { url: string }) => {
          if (data.url) {
            const name = data.url.split('/').pop() || 'Online Project'
            studioStore.switchProject({
              projectId: toSlug(name) || name,
              name,
              url: data.url,
              source: 'url',
              lastOpened: Date.now(),
            })
          }
        },
      },
    ],
  })
  await alert.present()
}

async function handleLoadCloud() {
  const { cos } = settingsStore
  if (!cos.bucket || !cos.region) {
    const toast = await toastController.create({
      message: t('projects.cosNotConfigured'),
      duration: 2500,
      position: 'top',
      color: 'warning',
    })
    await toast.present()
    return
  }

  const alert = await alertController.create({
    header: t('projects.cosLoadTitle'),
    message: t('projects.cosLoadMessage'),
    inputs: [
      {
        name: 'prefix',
        type: 'text',
        placeholder: 'my-project/',
      },
    ],
    buttons: [
      { text: t('common.cancel'), role: 'cancel' },
      {
        text: t('common.load'),
        handler: async (data: { prefix: string }) => {
          const prefix = data.prefix || ''
          try {
            const files = await listCloudFiles(cos, prefix)
            if (files.length === 0) {
              const toast = await toastController.create({
                message: t('projects.cosNoFiles'),
                duration: 2000,
                position: 'top',
                color: 'warning',
              })
              await toast.present()
              return
            }

            const projectName = prefix.replace(TRAILING_SLASH_RE, '').split('/').pop() || 'Cloud Project'
            await studioStore.switchProject({
              projectId: toSlug(projectName) || projectName,
              name: projectName,
              source: 'cos',
              cosPrefix: prefix,
              lastOpened: Date.now(),
            })

            const toast = await toastController.create({
              message: t('projects.cosLoadSuccess', { count: files.length }),
              duration: 1500,
              position: 'top',
              color: 'success',
            })
            await toast.present()
          }
          catch {
            const toast = await toastController.create({
              message: t('projects.cosLoadError'),
              duration: 2000,
              position: 'top',
              color: 'danger',
            })
            await toast.present()
          }
        },
      },
    ],
  })
  await alert.present()
}

const importFileInput = ref<HTMLInputElement | null>(null)

function handleImportProject() {
  importFileInput.value?.click()
}

async function handleImportFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = '' // reset for re-selection
  if (!file)
    return

  try {
    // Ask user to select a target directory
    const dirHandle = await (window as any).showDirectoryPicker({ mode: 'readwrite' })
    const fs = await createFileSystem({ dirHandle })
    const manifest = await importProject(file, fs)
    const projectName = manifest.name || file.name.replace(ZIP_EXT_RE, '')

    await studioStore.switchProject({
      projectId: toSlug(projectName) || projectName,
      name: projectName,
      source: 'local',
      dirHandle,
      lastOpened: Date.now(),
    })

    const toast = await toastController.create({
      message: t('project.importSuccess', { name: projectName }),
      duration: 2000,
      position: 'top',
      color: 'success',
    })
    await toast.present()
  }
  catch (err) {
    const message = err instanceof Error ? err.message : t('project.importFailed')
    const toast = await toastController.create({
      message,
      duration: 2500,
      position: 'top',
      color: 'danger',
    })
    await toast.present()
  }
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)

  if (diffMins < 1)
    return t('time.justNow')
  if (diffMins < 60)
    return t('time.minutesAgo', { n: diffMins })
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24)
    return t('time.hoursAgo', { n: diffHours })
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7)
    return t('time.daysAgo', { n: diffDays })
  return date.toLocaleDateString()
}

function getProjectIcon(project: typeof studioStore.projects[0]) {
  if (project.source === 'cos')
    return cloudDownloadOutline
  if (project.source === 'url' || project.url)
    return cloudUploadOutline
  return folderOpenOutline
}

function getSourceLabel(project: typeof studioStore.projects[0]) {
  if (project.source === 'cos')
    return t('projects.sourceCos')
  if (project.source === 'url')
    return t('projects.sourceUrl')
  return t('projects.sourceLocal')
}

/**
 * Select a project from the list.
 *
 * For local projects restored from localStorage (no dirHandle):
 *   1. Try restoreAndVerifyHandle (IDB + silent permission check + interactive prompt)
 *   2. If that fails, ask user to re-select directory
 *
 * Chrome 122+ "Allow on every visit": step 1 succeeds silently — zero friction.
 */
async function handleSelectProject(project: typeof studioStore.projects[0]) {
  // Non-local projects don't need dirHandle
  if (project.source !== 'local' || project.dirHandle) {
    await studioStore.switchProject(project)
    return
  }

  // Try to restore from IndexedDB + verify/request permission in one shot
  const handle = await restoreAndVerifyHandle(project.name)
  if (handle) {
    await studioStore.switchProject({ ...project, dirHandle: handle })
    return
  }

  // Last resort: ask user to re-select the directory
  const alert = await alertController.create({
    header: project.name,
    message: t('workspace.reSelectDir'),
    buttons: [
      { text: t('common.cancel'), role: 'cancel' },
      {
        text: t('projects.openLocal'),
        handler: async () => {
          try {
            const dirHandle = await openProjectDirectory()
            await studioStore.switchProject({ ...project, dirHandle })
          }
          catch {
            // User cancelled
          }
        },
      },
    ],
  })
  await alert.present()
}

function handleDeleteProject(index: number) {
  studioStore.removeProject(index)
}

/** Reconnect a local project that lost its dirHandle */
async function handleReconnectDir() {
  const project = studioStore.currentProject
  if (!project)
    return

  // Try IDB restore first (needs user gesture for requestPermission)
  const handle = await restoreAndVerifyHandle(project.name)
  if (handle) {
    // Create a new object so Vue's shallow watch on currentProject triggers
    await studioStore.switchProject({ ...project, dirHandle: handle })
    return
  }

  // Fallback: open directory picker
  try {
    const dirHandle = await openProjectDirectory()
    await studioStore.switchProject({ ...project, dirHandle })
  }
  catch {
    // User cancelled
  }
}

// Workspace file handling
async function handleFileDblClick(item: FSFileItem) {
  selectedFile.value = item
  fileOriginalContent.value = undefined
  isDirty.value = false
  editedContent.value = ''

  const project = studioStore.currentProject
  if (!project?.dirHandle || !item.handle)
    return

  try {
    const file = await item.handle.getFile()
    const content = await file.text()
    fileContent.value = content
    editedContent.value = content

    // Check for changes (from AI chat modifications)
    const filePath = item.name
    if (hasChange(filePath)) {
      const change = getChange(filePath)
      if (change)
        fileOriginalContent.value = change.originalContent
    }

    // On mobile, open modal
    if (window.innerWidth < 768)
      isMobilePreviewOpen.value = true
  }
  catch {
    fileContent.value = ''
    const toast = await toastController.create({
      message: t('preview.readError'),
      duration: 2000,
      position: 'top',
      color: 'danger',
    })
    await toast.present()
  }
}

/** Handle file selection from MobileFileTree (single click opens file) */
async function handleMobileFileSelect(item: FSFileItem) {
  selectedFile.value = item
  fileOriginalContent.value = undefined
  isDirty.value = false
  editedContent.value = ''

  if (!item.handle)
    return

  try {
    const file = await item.handle.getFile()
    const content = await file.text()
    fileContent.value = content
    editedContent.value = content
    isMobilePreviewOpen.value = true
  }
  catch {
    fileContent.value = ''
    const toast = await toastController.create({
      message: t('preview.readError'),
      duration: 2000,
      position: 'top',
      color: 'danger',
    })
    await toast.present()
  }
}

/** Track content changes from editor */
function handleContentUpdate(value: string) {
  editedContent.value = value
  isDirty.value = value !== fileContent.value
}

/** Save edited file content back to disk via File System Access API */
async function handleSaveFile() {
  if (!selectedFile.value?.handle || !isDirty.value)
    return

  try {
    const handle = selectedFile.value.handle as FileSystemFileHandle
    const writable = await (handle as any).createWritable()
    await writable.write(editedContent.value)
    await writable.close()

    // Update baseline content
    fileContent.value = editedContent.value
    isDirty.value = false

    const toast = await toastController.create({
      message: t('workspace.saved'),
      duration: 1500,
      position: 'top',
      color: 'success',
    })
    await toast.present()
  }
  catch {
    const toast = await toastController.create({
      message: t('workspace.saveFailed'),
      duration: 2000,
      position: 'top',
      color: 'danger',
    })
    await toast.present()
  }
}

/** Get UnoCSS vscode-icons class for a filename */
function getFileIconClass(name: string): string {
  return getIconFromFileType(getFileTypeFromPath(name))
}
</script>

<template>
  <LayoutPage :title="hasProject ? studioStore.currentProject?.name : t('workspace.title')" :subtitle="hasProject ? studioStore.currentProject?.projectId : undefined">
    <template v-if="hasProject && !studioStore.isRestoring" #end>
      <ProjectSwitcher />
    </template>

    <!-- ==================== View: Restoring skeleton ==================== -->
    <template v-if="studioStore.isRestoring">
      <div class="restore-skeleton">
        <div class="restore-skeleton__segment">
          <div class="skeleton-bone skeleton-bone--tab" />
          <div class="skeleton-bone skeleton-bone--tab" />
        </div>
        <div class="restore-skeleton__cards">
          <div class="skeleton-bone skeleton-bone--card" />
          <div class="skeleton-bone skeleton-bone--card skeleton-bone--card-sm" />
          <div class="skeleton-bone skeleton-bone--card skeleton-bone--card-sm" />
        </div>
      </div>
    </template>

    <!-- ==================== View A: Welcome Page ==================== -->
    <template v-else-if="!hasProject">
      <!-- Hero: Primary Actions Grid -->
      <h3 class="section-title">
        {{ t('workspace.startCreating') }}
      </h3>
      <div class="hero-actions">
        <!-- QuickStart (inline) -->
        <button type="button" class="hero-card hero-card--primary" :disabled="isQuickStarting" @click="handleQuickStart">
          <span class="hero-card__icon hero-card__icon--filled">
            <IonIcon :icon="rocketOutline" />
            <span v-if="isQuickStarting" class="hero-card__spinner" />
          </span>
          <strong class="hero-card__title">{{ isQuickStarting ? t('projects.quickStartCreating') : t('projects.quickStart') }}</strong>
          <span class="hero-card__desc">{{ t('projects.quickStartDesc') }}</span>
        </button>

        <!-- Create Project -->
        <button type="button" class="hero-card" @click="showCreateModal = true">
          <span class="hero-card__icon">
            <IonIcon :icon="addOutline" />
          </span>
          <strong class="hero-card__title">{{ t('projects.createProject') }}</strong>
          <span class="hero-card__desc">{{ t('projects.createProjectDesc') }}</span>
        </button>

        <!-- AI Import -->
        <button type="button" class="hero-card hero-card--accent" @click="$router.push('/tabs/workspace/import-source')">
          <span class="hero-card__icon">
            <IonIcon :icon="sparklesOutline" />
          </span>
          <strong class="hero-card__title">{{ t('importSource.entryCard') }}</strong>
          <span class="hero-card__desc">{{ t('importSource.entryCardDesc') }}</span>
        </button>
      </div>

      <!-- Secondary Actions: compact icon buttons -->
      <h3 class="section-title">
        {{ t('workspace.moreWays') }}
      </h3>
      <div class="secondary-actions">
        <button type="button" class="sec-btn" @click="handleOpenLocal">
          <span class="sec-btn__icon"><IonIcon :icon="folderOpenOutline" /></span>
          <span class="sec-btn__label">{{ t('projects.openLocal') }}</span>
        </button>
        <button type="button" class="sec-btn" @click="handleLoadUrl">
          <span class="sec-btn__icon"><IonIcon :icon="linkOutline" /></span>
          <span class="sec-btn__label">{{ t('projects.loadUrl') }}</span>
        </button>
        <button type="button" class="sec-btn" @click="handleLoadCloud">
          <span class="sec-btn__icon"><IonIcon :icon="cloudDownloadOutline" /></span>
          <span class="sec-btn__label">{{ t('projects.loadCloud') }}</span>
        </button>
        <button type="button" class="sec-btn" @click="handleImportProject">
          <span class="sec-btn__icon"><IonIcon :icon="downloadOutline" /></span>
          <span class="sec-btn__label">{{ t('projects.importProject') }}</span>
        </button>
        <button type="button" class="sec-btn" :disabled="isLoadingDemo" @click="handleLoadContestDemo">
          <span class="sec-btn__icon"><IonIcon :icon="libraryOutline" /></span>
          <span class="sec-btn__label">{{ isLoadingDemo ? t('contestDemo.loading') : t('contestDemo.entryLabel') }}</span>
        </button>
        <button type="button" class="sec-btn sec-btn--badge" @click="$router.push('/tabs/workspace/marketplace')">
          <span class="sec-btn__icon"><IonIcon :icon="storefrontOutline" /></span>
          <span class="sec-btn__label">{{ t('marketplace.browse') }}</span>
          <span class="sec-btn__badge">{{ t('marketplace.newBadge') }}</span>
        </button>
      </div>
      <input
        ref="importFileInput"
        type="file"
        accept=".zip,.advpkg"
        style="display: none"
        @change="handleImportFileSelected"
      >

      <!-- Unified Project List -->
      <template v-if="studioStore.projects.length > 0">
        <h3 class="section-title">
          {{ t('workspace.recentProjects') }}
        </h3>
        <IonList class="project-list">
          <IonItemSliding v-for="(project, index) in studioStore.projects" :key="project.projectId + project.lastOpened">
            <IonItem button @click="handleSelectProject(project)">
              <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
              <IonIcon slot="start" :icon="getProjectIcon(project)" />
              <IonLabel>
                <h2>{{ project.name }}</h2>
                <p>{{ getSourceLabel(project) }} · {{ formatTime(project.lastOpened) }}</p>
              </IonLabel>
            </IonItem>
            <IonItemOptions side="end">
              <IonItemOption color="danger" @click="handleDeleteProject(index)">
                <template #icon-only>
                  <IonIcon :icon="trashOutline" />
                </template>
              </IonItemOption>
            </IonItemOptions>
          </IonItemSliding>
        </IonList>
      </template>

      <!-- Empty state -->
      <div v-else class="empty-state">
        <div class="empty-state__illustration">
          <IonIcon :icon="folderOpenOutline" />
        </div>
        <h3 class="empty-state__title">
          {{ t('projects.emptyTitle') }}
        </h3>
        <p class="empty-state__description">
          {{ t('projects.emptyDescription') }}
        </p>
      </div>
    </template>

    <!-- ==================== View B: Workspace ==================== -->
    <template v-else>
      <!-- Segment toggle: Overview / Files -->
      <div class="workspace-segment">
        <IonSegment v-model="workspaceSegment">
          <IonSegmentButton value="overview">
            <IonLabel>{{ t('workspace.overview') }}</IonLabel>
          </IonSegmentButton>
          <IonSegmentButton value="files">
            <IonLabel>{{ t('workspace.files') }}</IonLabel>
          </IonSegmentButton>
        </IonSegment>
      </div>

      <!-- Overview view -->
      <ProjectOverview v-if="workspaceSegment === 'overview'" />

      <!-- Files view -->
      <div v-else class="workspace-layout">
        <!-- Mobile: MobileFileTree -->
        <template v-if="isMobile">
          <template v-if="studioStore.currentProject?.dirHandle && rootDir">
            <MobileFileTree
              :dir="rootDir"
              :selected-file="selectedFile?.name"
              @file-select="handleMobileFileSelect"
            />
          </template>
          <WorkspaceReconnect v-else @reconnect="handleReconnectDir" />
        </template>

        <!-- Desktop: AGUIAssetsExplorer splitpanes -->
        <div v-else class="workspace-split">
          <div class="workspace-explorer">
            <AGUIAssetsExplorer
              v-if="studioStore.currentProject?.dirHandle"
              v-model:root-dir="rootDir"
              v-model:cur-dir="curDir"
              :on-file-dbl-click="handleFileDblClick"
            />
            <!-- No dirHandle: URL/COS project or handle lost -->
            <WorkspaceReconnect v-else @reconnect="handleReconnectDir" />
          </div>
          <div class="workspace-preview">
            <div v-if="isDirty" class="workspace-preview__toolbar">
              <span class="workspace-preview__dirty">{{ t('workspace.modified') }}</span>
              <IonButton size="small" fill="clear" @click="handleSaveFile">
                <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
                <IonIcon slot="start" :icon="saveOutline" />
                {{ t('workspace.save') }}
              </IonButton>
            </div>
            <FilePreview
              :content="fileContent"
              :original-content="fileOriginalContent"
              :filename="selectedFile?.name || ''"
              :readonly="false"
              @update:content="handleContentUpdate"
              @save="handleSaveFile"
            />
          </div>
        </div>

        <!-- Mobile: modal for file preview -->
        <IonModal
          :is-open="isMobilePreviewOpen"
          @did-dismiss="isMobilePreviewOpen = false"
        >
          <IonHeader>
            <IonToolbar>
              <IonTitle>
                <span v-if="selectedFile" class="modal-title-with-icon">
                  <span class="modal-file-icon" :class="getFileIconClass(selectedFile.name)" />
                  {{ selectedFile.name }}
                </span>
              </IonTitle>
              <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
              <div slot="end" class="modal-toolbar-actions">
                <IonButton v-if="isDirty" fill="clear" size="small" @click="handleSaveFile">
                  <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
                  <IonIcon slot="icon-only" :icon="saveOutline" />
                </IonButton>
                <IonButton fill="clear" @click="isMobilePreviewOpen = false">
                  {{ t('common.ok') }}
                </IonButton>
              </div>
            </IonToolbar>
          </IonHeader>
          <IonContent>
            <FilePreview
              :content="fileContent"
              :original-content="fileOriginalContent"
              :filename="selectedFile?.name || ''"
              :readonly="false"
              @update:content="handleContentUpdate"
              @save="handleSaveFile"
            />
          </IonContent>
        </IonModal>
      </div>
    </template>

    <!-- Create Project Modal -->
    <CreateProjectModal
      :open="showCreateModal"
      @close="showCreateModal = false"
      @create="handleCreateProject"
      @from-source="handleCreateFromSource"
    />
  </LayoutPage>
</template>

<style scoped>
/* ===== Section Title ===== */
.section-title {
  font-size: var(--adv-font-body-sm, 13px);
  font-weight: 600;
  color: var(--adv-text-secondary);
  padding: var(--adv-space-lg, 20px) var(--adv-space-md) var(--adv-space-sm, 8px);
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.section-title:first-child {
  padding-top: var(--adv-space-md, 16px);
}

/* ===== Hero Actions Grid ===== */
.hero-actions {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: var(--adv-space-sm, 8px);
  padding: 0 var(--adv-space-md) var(--adv-space-sm);
}

.hero-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--adv-space-sm, 8px);
  padding: var(--adv-space-md);
  min-height: 110px;
  border-radius: var(--adv-radius-lg);
  border: 1px solid var(--adv-border-subtle);
  background: var(--adv-surface-card);
  box-shadow: var(--adv-shadow-subtle);
  cursor: pointer;
  text-align: left;
  transition:
    transform var(--adv-duration-fast) var(--adv-ease-default),
    box-shadow var(--adv-duration-fast) var(--adv-ease-default),
    border-color var(--adv-duration-fast) var(--adv-ease-default);
  -webkit-tap-highlight-color: transparent;
}

.hero-card:not(:disabled):active {
  transform: scale(0.97);
}

.hero-card:not(:disabled):hover {
  box-shadow: 0 4px 16px rgba(99, 102, 241, 0.12);
  border-color: color-mix(in srgb, var(--ion-color-primary) 40%, transparent);
}

.hero-card:disabled {
  opacity: 0.7;
  cursor: wait;
}

/* Primary hero card — gradient background */
.hero-card--primary {
  background: var(--adv-gradient-primary);
  border-color: transparent;
  color: #fff;
}

.hero-card--primary:not(:disabled):hover {
  box-shadow: 0 6px 24px rgba(99, 102, 241, 0.35);
  border-color: transparent;
}

.hero-card--primary .hero-card__title,
.hero-card--primary .hero-card__desc {
  color: #fff;
}

.hero-card--primary .hero-card__desc {
  opacity: 0.85;
}

/* Accent hero card — subtle highlight */
.hero-card--accent {
  border-color: color-mix(in srgb, var(--ion-color-primary) 35%, transparent);
}

.hero-card--accent .hero-card__icon {
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--ion-color-primary) 18%, transparent),
    color-mix(in srgb, var(--ion-color-tertiary, var(--ion-color-primary)) 22%, transparent)
  );
}

.hero-card__icon {
  position: relative;
  width: 40px;
  height: 40px;
  border-radius: var(--adv-radius-md);
  background: rgba(99, 102, 241, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: var(--ion-color-primary);
  font-size: var(--adv-font-lg);
}

.hero-card__icon--filled {
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
}

.hero-card__spinner {
  position: absolute;
  inset: -3px;
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-top-color: #fff;
  border-radius: 50%;
  animation: hero-spin 0.8s linear infinite;
}

@keyframes hero-spin {
  to {
    transform: rotate(360deg);
  }
}

.hero-card__title {
  font-size: var(--adv-font-body, 15px);
  font-weight: 700;
  color: var(--adv-text-primary);
  line-height: 1.2;
}

.hero-card__desc {
  font-size: var(--adv-font-caption, 12px);
  color: var(--adv-text-secondary);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* ===== Secondary Actions Row ===== */
.secondary-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--adv-space-sm, 8px);
  padding: 0 var(--adv-space-md) var(--adv-space-md);
}

.sec-btn {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  min-width: 72px;
  max-width: 88px;
  flex: 0 0 auto;
  padding: var(--adv-space-sm, 8px) 6px;
  border: 1px solid var(--adv-border-subtle);
  border-radius: var(--adv-radius-lg);
  background: var(--adv-surface-card);
  cursor: pointer;
  transition:
    background var(--adv-duration-fast) var(--adv-ease-default),
    box-shadow var(--adv-duration-fast) var(--adv-ease-default);
  -webkit-tap-highlight-color: transparent;
}

.sec-btn:active {
  transform: scale(0.95);
}

.sec-btn:hover {
  background: color-mix(in srgb, var(--ion-color-primary) 6%, var(--adv-surface-card));
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.08);
}

.sec-btn__icon {
  width: 36px;
  height: 36px;
  border-radius: var(--adv-radius-md, 8px);
  background: rgba(99, 102, 241, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--ion-color-primary);
  font-size: var(--adv-font-subtitle);
}

.sec-btn__label {
  font-size: var(--adv-font-caption);
  font-weight: 500;
  color: var(--adv-text-secondary);
  text-align: center;
  line-height: 1.3;
  word-break: keep-all;
  overflow-wrap: break-word;
  max-width: 100%;
}

.sec-btn__badge {
  position: absolute;
  top: 2px;
  right: 2px;
  font-size: 8px;
  font-weight: 700;
  padding: 1px 4px;
  border-radius: var(--adv-radius-xs);
  background: linear-gradient(135deg, #fbbf24, #f59e0b);
  color: #78350f;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  line-height: 1.3;
}

/* ===== Unified Project List ===== */
.project-list {
  padding-bottom: var(--adv-space-md);
}

/* ===== Empty State — uses shared.css .empty-state ===== */

/* Workspace segment */
.workspace-segment {
  padding: var(--adv-space-sm) var(--adv-space-md);
}

/* Workspace layout */
.workspace-layout {
  height: calc(100% - 56px);
}

.workspace-split {
  display: flex;
  height: 100%;
}

.workspace-explorer {
  flex: 1;
  min-width: 0;
  overflow: auto;
}

.workspace-preview {
  flex: 1;
  min-width: 0;
  border-left: 1px solid var(--adv-border-subtle);
  display: flex;
  flex-direction: column;
}

.workspace-preview__toolbar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--adv-space-sm);
  padding: 4px var(--adv-space-sm);
  border-bottom: 1px solid var(--adv-border-subtle);
}

.workspace-preview__dirty {
  font-size: var(--adv-font-caption);
  color: var(--ion-color-warning);
  font-weight: 500;
}

.modal-toolbar-actions {
  display: flex;
  align-items: center;
}

/* No mobile CSS hacks needed — isMobile ref controls which component renders */

.modal-title-with-icon {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.modal-file-icon {
  font-size: var(--adv-font-subtitle);
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

/* Restore skeleton */
.restore-skeleton {
  padding: var(--adv-space-md);
  display: flex;
  flex-direction: column;
  gap: var(--adv-space-md);
}

.restore-skeleton__segment {
  display: flex;
  gap: var(--adv-space-sm);
}

.restore-skeleton__cards {
  display: flex;
  flex-direction: column;
  gap: var(--adv-space-sm);
}

.skeleton-bone {
  border-radius: var(--adv-radius-md, 8px);
  background: linear-gradient(
    90deg,
    var(--adv-border-subtle, rgba(0, 0, 0, 0.06)) 25%,
    rgba(0, 0, 0, 0.03) 50%,
    var(--adv-border-subtle, rgba(0, 0, 0, 0.06)) 75%
  );
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.5s ease-in-out infinite;
}

:root.dark .skeleton-bone {
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0.06) 25%,
    rgba(255, 255, 255, 0.1) 50%,
    rgba(255, 255, 255, 0.06) 75%
  );
  background-size: 200% 100%;
}

.skeleton-bone--tab {
  flex: 1;
  height: 36px;
  border-radius: var(--adv-radius-full, 9999px);
}

.skeleton-bone--card {
  height: 80px;
}

.skeleton-bone--card-sm {
  height: 56px;
}

@keyframes skeleton-shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}
</style>
