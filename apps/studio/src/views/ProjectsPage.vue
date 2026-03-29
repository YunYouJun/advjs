<script setup lang="ts">
import type { FSDirItem, FSFileItem } from '@advjs/gui'
import { AGUIAssetsExplorer, getDirItemFromHandle, getFileTypeFromPath, getIconFromFileType } from '@advjs/gui'
import {
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
  IonNote,
  IonPage,
  IonSegment,
  IonSegmentButton,
  IonTitle,
  IonToolbar,
  toastController,
} from '@ionic/vue'
import { addOutline, cloudDownloadOutline, cloudUploadOutline, folderOpenOutline, linkOutline, saveOutline, trashOutline } from 'ionicons/icons'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import CreateProjectModal from '../components/CreateProjectModal.vue'
import FilePreview from '../components/FilePreview.vue'
import MobileFileTree from '../components/MobileFileTree.vue'
import ProjectOverview from '../components/ProjectOverview.vue'
import ProjectSwitcher from '../components/ProjectSwitcher.vue'
import { collectAllLocalFiles } from '../composables/useCloudSync'
import { useFileChanges } from '../composables/useFileChanges'
import { useSettingsStore } from '../stores/useSettingsStore'
import { useStudioStore } from '../stores/useStudioStore'
import { listCloudFiles, uploadProjectToCloud } from '../utils/cloudSync'
import { restoreAndVerifyHandle } from '../utils/dirHandleStore'
import { detectAdvProject, openProjectDirectory } from '../utils/fileAccess'
import { createProjectFromTemplate } from '../utils/projectTemplate'

const { t } = useI18n()
const studioStore = useStudioStore()
const settingsStore = useSettingsStore()
const { hasChange, getChange } = useFileChanges()
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

// Responsive detection
const isMobile = ref(window.innerWidth < 768)

// Edit state
const isDirty = ref(false)
const editedContent = ref('')

// Auto-restore last project on mount
onMounted(() => {
  window.addEventListener('resize', () => {
    isMobile.value = window.innerWidth < 768
  })
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
    await autoLoadReadme(project.dirHandle)
  }
  else {
    rootDir.value = undefined
    curDir.value = undefined
  }
}, { immediate: true })

/** Try to load README.md (or world.md) as default preview content */
async function autoLoadReadme(dirHandle: FileSystemDirectoryHandle) {
  const candidates = ['README.md', 'readme.md', 'adv/world.md']
  for (const name of candidates) {
    try {
      const parts = name.split('/')
      let dir = dirHandle
      for (let i = 0; i < parts.length - 1; i++)
        dir = await dir.getDirectoryHandle(parts[i])

      const fileHandle = await dir.getFileHandle(parts.at(-1)!)
      const file = await fileHandle.getFile()
      fileContent.value = await file.text()
      selectedFile.value = { name, kind: 'file', handle: fileHandle } as FSFileItem
      return
    }
    catch {
      // file not found, try next
    }
  }
}
const hasProject = computed(() => !!studioStore.currentProject)

const featuredProjects = computed(() => studioStore.projects.slice(0, 3))
const remainingProjects = computed(() => studioStore.projects.slice(3))

function normalizeCosPrefix(projectRoot: string, projectName: string): string {
  const root = projectRoot.replace(TRAILING_SLASH_RE, '')
  return `${root}/${projectName}/`
}

function isCosConfigured(): boolean {
  const { bucket, region, secretId, secretKey } = settingsStore.cos
  return !!(bucket && region && secretId && secretKey)
}

async function handleCreateProject(payload: { displayName: string, slug: string, templateId: string }) {
  showCreateModal.value = false
  const { displayName, slug } = payload

  try {
    const parentDir = await openProjectDirectory()
    const projectDir = await createProjectFromTemplate(parentDir, slug)

    const cosPrefix = normalizeCosPrefix(settingsStore.cos.projectRoot, slug)
    studioStore.setCurrentProject({
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
        const files = await collectAllLocalFiles(projectDir)
        const config = {
          bucket: settingsStore.cos.bucket,
          region: settingsStore.cos.region,
          secretId: settingsStore.cos.secretId,
          secretKey: settingsStore.cos.secretKey,
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
              studioStore.setCurrentProject({
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

    studioStore.setCurrentProject({
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
            studioStore.setCurrentProject({
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
  if (!cos.bucket || !cos.region || !cos.secretId || !cos.secretKey) {
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
            studioStore.setCurrentProject({
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
    studioStore.setCurrentProject(project)
    return
  }

  // Try to restore from IndexedDB + verify/request permission in one shot
  const handle = await restoreAndVerifyHandle(project.name)
  if (handle) {
    project.dirHandle = handle
    studioStore.setCurrentProject(project)
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
            project.dirHandle = dirHandle
            studioStore.setCurrentProject(project)
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
    project.dirHandle = handle
    studioStore.setCurrentProject(project)
    return
  }

  // Fallback: open directory picker
  try {
    const dirHandle = await openProjectDirectory()
    project.dirHandle = dirHandle
    studioStore.setCurrentProject(project)
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
    // @ts-expect-error createWritable is not in all TS libs yet
    const writable = await handle.createWritable()
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

function getGradientForIndex(index: number): string {
  const gradients = [
    'linear-gradient(135deg, #6366f1, #8b5cf6)',
    'linear-gradient(135deg, #ec4899, #f43f5e)',
    'linear-gradient(135deg, #14b8a6, #06b6d4)',
  ]
  return gradients[index % gradients.length]
}
</script>

<template>
  <IonPage>
    <IonHeader>
      <IonToolbar>
        <IonTitle>{{ hasProject ? studioStore.currentProject?.name : t('workspace.title') }}</IonTitle>
        <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
        <ProjectSwitcher v-if="hasProject" slot="end" />
      </IonToolbar>
    </IonHeader>
    <IonContent :fullscreen="true">
      <!-- ==================== View A: Welcome Page ==================== -->
      <template v-if="!hasProject">
        <!-- Action cards -->
        <div class="action-cards">
          <button class="action-card" @click="showCreateModal = true">
            <span class="action-card__icon">
              <IonIcon :icon="addOutline" />
            </span>
            <span class="action-card__text">
              <strong>{{ t('projects.createProject') }}</strong>
              <span>{{ t('projects.createProjectDesc') }}</span>
            </span>
          </button>
          <button class="action-card" @click="handleOpenLocal">
            <span class="action-card__icon">
              <IonIcon :icon="folderOpenOutline" />
            </span>
            <span class="action-card__text">
              <strong>{{ t('projects.openLocal') }}</strong>
              <span>{{ t('projects.openLocalDesc') }}</span>
            </span>
          </button>
          <button class="action-card" @click="handleLoadUrl">
            <span class="action-card__icon">
              <IonIcon :icon="linkOutline" />
            </span>
            <span class="action-card__text">
              <strong>{{ t('projects.loadUrl') }}</strong>
              <span>{{ t('projects.loadUrlDesc') }}</span>
            </span>
          </button>
          <button class="action-card" @click="handleLoadCloud">
            <span class="action-card__icon">
              <IonIcon :icon="cloudDownloadOutline" />
            </span>
            <span class="action-card__text">
              <strong>{{ t('projects.loadCloud') }}</strong>
              <span>{{ t('projects.loadCloudDesc') }}</span>
            </span>
          </button>
        </div>

        <!-- Featured projects (large cards) -->
        <div v-if="featuredProjects.length > 0" class="featured-section">
          <h3 class="section-title">
            {{ t('workspace.featuredProjects') }}
          </h3>
          <div class="featured-cards">
            <button
              v-for="(project, index) in featuredProjects"
              :key="project.name + project.lastOpened"
              class="featured-card"
              :style="{ background: getGradientForIndex(index) }"
              @click="handleSelectProject(project)"
            >
              <div class="featured-card__content">
                <h3 class="featured-card__name">
                  {{ project.name }}
                </h3>
                <div class="featured-card__meta">
                  <span class="featured-card__source">{{ getSourceLabel(project) }}</span>
                  <span class="featured-card__time">{{ formatTime(project.lastOpened) }}</span>
                </div>
              </div>
              <div class="featured-card__decoration" />
            </button>
          </div>
        </div>

        <!-- Remaining project list -->
        <IonList v-if="remainingProjects.length > 0">
          <IonItemSliding v-for="(project, index) in remainingProjects" :key="project.name + project.lastOpened">
            <IonItem button @click="handleSelectProject(project)">
              <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
              <IonIcon slot="start" :icon="getProjectIcon(project)" />
              <IonLabel>
                <h2>{{ project.name }}</h2>
                <p v-if="project.url">
                  {{ project.url }}
                </p>
                <p v-if="project.source === 'cos' && project.cosPrefix">
                  COS: {{ project.cosPrefix }}
                </p>
              </IonLabel>
              <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
              <IonNote slot="end">
                {{ formatTime(project.lastOpened) }}
              </IonNote>
            </IonItem>
            <IonItemOptions side="end">
              <IonItemOption color="danger" @click="handleDeleteProject(index + 3)">
                <template #icon-only>
                  <IonIcon :icon="trashOutline" />
                </template>
              </IonItemOption>
            </IonItemOptions>
          </IonItemSliding>
        </IonList>

        <!-- Empty state -->
        <div v-if="studioStore.projects.length === 0" class="empty-state">
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
            <div v-else class="workspace-reconnect">
              <div class="workspace-reconnect__icon">
                <IonIcon :icon="folderOpenOutline" />
              </div>
              <p class="workspace-reconnect__text">
                {{ t('workspace.reSelectDir') }}
              </p>
              <IonButton size="default" @click="handleReconnectDir">
                <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
                <IonIcon slot="start" :icon="folderOpenOutline" />
                {{ t('workspace.reconnect') }}
              </IonButton>
            </div>
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
              <div v-else class="workspace-reconnect">
                <div class="workspace-reconnect__icon">
                  <IonIcon :icon="folderOpenOutline" />
                </div>
                <p class="workspace-reconnect__text">
                  {{ t('workspace.reSelectDir') }}
                </p>
                <IonButton size="default" @click="handleReconnectDir">
                  <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
                  <IonIcon slot="start" :icon="folderOpenOutline" />
                  {{ t('workspace.reconnect') }}
                </IonButton>
              </div>
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
      />
    </IonContent>
  </IonPage>
</template>

<style scoped>
/* Action cards */
.action-cards {
  display: flex;
  flex-direction: column;
  gap: var(--adv-space-sm);
  padding: var(--adv-space-md);
}

.action-card {
  display: flex;
  align-items: center;
  gap: var(--adv-space-md);
  padding: var(--adv-space-md);
  min-height: 44px;
  border-radius: var(--adv-radius-lg);
  border: 1px solid var(--adv-border-subtle);
  background: var(--adv-surface-card);
  box-shadow: var(--adv-shadow-subtle);
  cursor: pointer;
  text-align: left;
  transition:
    transform var(--adv-duration-fast) var(--adv-ease-default),
    box-shadow var(--adv-duration-fast) var(--adv-ease-default);
  -webkit-tap-highlight-color: transparent;
}

.action-card:active {
  transform: scale(0.98);
}

.action-card__icon {
  width: 44px;
  height: 44px;
  border-radius: var(--adv-radius-md);
  background: rgba(99, 102, 241, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: var(--ion-color-primary);
  font-size: 22px;
}

.action-card__text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.action-card__text strong {
  font-size: var(--adv-font-body);
  font-weight: 600;
  color: var(--adv-text-primary);
}

.action-card__text span {
  font-size: var(--adv-font-body-sm);
  color: var(--adv-text-secondary);
}

/* Section title */
.section-title {
  font-size: var(--adv-font-body);
  font-weight: 600;
  color: var(--adv-text-secondary);
  padding: var(--adv-space-sm) var(--adv-space-md) 0;
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* Featured projects */
.featured-section {
  margin-bottom: var(--adv-space-sm);
}

.featured-cards {
  display: flex;
  flex-direction: column;
  gap: var(--adv-space-sm);
  padding: var(--adv-space-sm) var(--adv-space-md);
}

.featured-card {
  position: relative;
  overflow: hidden;
  padding: var(--adv-space-lg);
  border-radius: var(--adv-radius-lg);
  color: white;
  cursor: pointer;
  border: none;
  text-align: left;
  box-shadow: var(--adv-shadow-glow);
  transition: transform var(--adv-duration-fast) var(--adv-ease-default);
  -webkit-tap-highlight-color: transparent;
}

.featured-card:active {
  transform: scale(0.98);
}

.featured-card__content {
  position: relative;
  z-index: 1;
}

.featured-card__name {
  font-size: var(--adv-font-title);
  font-weight: 700;
  margin: 0 0 var(--adv-space-sm);
}

.featured-card__meta {
  display: flex;
  align-items: center;
  gap: var(--adv-space-sm);
}

.featured-card__source {
  display: inline-block;
  font-size: var(--adv-font-caption);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  background: rgba(255, 255, 255, 0.2);
  padding: 2px 8px;
  border-radius: var(--adv-radius-full);
}

.featured-card__time {
  font-size: var(--adv-font-caption);
  opacity: 0.8;
}

.featured-card__decoration {
  position: absolute;
  right: -10%;
  top: -30%;
  width: 140px;
  height: 140px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  pointer-events: none;
}

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

.workspace-reconnect {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: var(--adv-space-md);
  padding: var(--adv-space-lg);
  text-align: center;
}

.workspace-reconnect__icon {
  font-size: 48px;
  color: var(--adv-text-tertiary);
  opacity: 0.5;
}

.workspace-reconnect__text {
  font-size: var(--adv-font-body);
  color: var(--adv-text-secondary);
  max-width: 280px;
  margin: 0;
  line-height: 1.5;
}

/* No mobile CSS hacks needed — isMobile ref controls which component renders */

.modal-title-with-icon {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.modal-file-icon {
  font-size: 18px;
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}
</style>
