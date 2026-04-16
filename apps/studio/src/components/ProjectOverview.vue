<script setup lang="ts">
import type {
  ValidationIssue,
  ValidationResult,
} from '../utils/projectValidation'
import { IonIcon, IonSpinner, toastController } from '@ionic/vue'
import {
  addOutline,
  bookOutline,
  brushOutline,
  bulbOutline,
  checkmarkCircleOutline,
  chevronForwardOutline,
  closeOutline,
  cloudDoneOutline,
  cloudDownloadOutline,
  cloudOfflineOutline,
  cloudOutline,
  cubeOutline,
  documentTextOutline,
  globeOutline,
  gridOutline,
  imageOutline,
  libraryOutline,
  listOutline,
  locationOutline,
  musicalNotesOutline,
  peopleOutline,
  settingsOutline,
  shareOutline,
  shieldCheckmarkOutline,
  timeOutline,
  warningOutline,
} from 'ionicons/icons'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useCloudSync } from '../composables/useCloudSync'
import { useProjectContent } from '../composables/useProjectContent'
import { useProjectDescription } from '../composables/useProjectDescription'
import { downloadBlob, exportProject } from '../composables/useProjectExport'
import { useStudioStore } from '../stores/useStudioStore'
import { useWorldEventStore } from '../stores/useWorldEventStore'
import { autoFixIssues, validateProject } from '../utils/projectValidation'
import ProjectHealthPanel from './ProjectHealthPanel.vue'
import ProjectSettingsModal from './ProjectSettingsModal.vue'
import RecentActivity from './RecentActivity.vue'

const SAFE_NAME_RE = /[^a-z0-9\u4E00-\u9FFF]+/g

const { t } = useI18n()
const router = useRouter()
const studioStore = useStudioStore()
const showSettings = ref(false)

const {
  chapters,
  characters,
  scenes,
  locations,
  audios,
  stats,
  isLoading,
  knowledgeBase,
  getFs,
} = useProjectContent()

const {
  worldMd,
  outlineMd,
  glossaryMd,
  propsMd,
  writingStyleMd,
  extractTitle,
  extractPreview,
  extractSections,
} = useProjectDescription()

const worldEventStore = useWorldEventStore()
const { syncStatus, isSyncing, lastSyncTime, isCosConfigured, performSync }
  = useCloudSync()

const syncIcon = computed(() => {
  if (isSyncing.value)
    return cloudOutline
  if (syncStatus.value === 'success')
    return cloudDoneOutline
  if (syncStatus.value === 'failed')
    return cloudOfflineOutline
  return cloudOutline
})

async function handleSync() {
  if (!isCosConfigured()) {
    const toast = await toastController.create({
      message: t('project.noSyncConfig'),
      duration: 2000,
      position: 'top',
    })
    await toast.present()
    return
  }
  const { uploaded, downloaded } = await performSync()
  const toast = await toastController.create({
    message:
      syncStatus.value === 'success'
        ? `${t('sync.syncComplete')} ↑${uploaded} ↓${downloaded}`
        : t('sync.syncFailed'),
    duration: 2000,
    position: 'top',
    color: syncStatus.value === 'success' ? 'success' : 'danger',
  })
  await toast.present()
}

// --- Project Validation ---
const validationResult = ref<ValidationResult | null>(null)
const isValidating = ref(false)

const validationIcon = computed(() => {
  if (!validationResult.value)
    return shieldCheckmarkOutline
  return validationResult.value.passed
    ? checkmarkCircleOutline
    : warningOutline
})

async function handleValidation() {
  isValidating.value = true
  try {
    validationResult.value = await validateProject(
      chapters.value,
      characters.value,
      scenes.value,
      audios.value,
      locations.value,
    )
    const r = validationResult.value
    const errors = r.issues.filter(i => i.type === 'error').length
    const warnings = r.issues.filter(i => i.type === 'warning').length
    const toast = await toastController.create({
      message: r.passed
        ? t('validation.passed')
        : `${t('validation.failed')} — ${errors} error${errors !== 1 ? 's' : ''}, ${warnings} warning${warnings !== 1 ? 's' : ''}`,
      duration: 2500,
      position: 'top',
      color: r.passed ? 'success' : 'warning',
      buttons: [{ role: 'cancel', icon: closeOutline }],
    })
    await toast.present()
  }
  catch {
    const toast = await toastController.create({
      message: t('validation.failed'),
      duration: 2000,
      position: 'top',
      color: 'danger',
      buttons: [{ role: 'cancel', icon: closeOutline }],
    })
    await toast.present()
  }
  finally {
    isValidating.value = false
  }
}

// --- Auto validation: run once when loading finishes, re-run on content changes ---
let autoValidateTimer: ReturnType<typeof setTimeout> | undefined
onMounted(() => {
  // Run initial validation once loading is done
  const unwatch = watch(
    () => isLoading.value,
    (loading) => {
      if (!loading && chapters.value.length > 0) {
        handleValidationSilent()
        unwatch()
      }
    },
    { immediate: true },
  )
})

// Watch content stats for changes (debounced re-validation)
watch(
  () => [stats.value.chapters, stats.value.characters, stats.value.scenes],
  () => {
    if (isValidating.value || isLoading.value)
      return
    clearTimeout(autoValidateTimer)
    autoValidateTimer = setTimeout(() => {
      handleValidationSilent()
    }, 3000)
  },
)

/** Silent validation: no toast, just update validationResult */
async function handleValidationSilent() {
  if (isValidating.value)
    return
  isValidating.value = true
  try {
    validationResult.value = await validateProject(
      chapters.value,
      characters.value,
      scenes.value,
      audios.value,
      locations.value,
    )
  }
  catch {
    // silent
  }
  finally {
    isValidating.value = false
  }
}

/** Auto-fix issues by modifying source files, then re-validate */
async function handleAutoFix(issues: ValidationIssue[]) {
  const fs = getFs()
  if (!fs)
    return
  try {
    const fixed = await autoFixIssues(issues, fs)
    if (fixed.length > 0) {
      const toast = await toastController.create({
        message: t('projectHealth.fixedCount', { count: fixed.length }),
        duration: 2000,
        position: 'top',
        color: 'success',
      })
      await toast.present()
      // Re-validate after fix
      await handleValidationSilent()
    }
  }
  catch {
    const toast = await toastController.create({
      message: t('projectHealth.fixFailed'),
      duration: 2000,
      position: 'top',
      color: 'danger',
    })
    await toast.present()
  }
}

// --- Derived data for dashboard cards ---
const projectName = computed(() => studioStore.currentProject?.name || '')

const worldTitle = computed(
  () => extractTitle(worldMd.value) || t('dashboard.worldSetting'),
)
const worldPreview = computed(() => extractPreview(worldMd.value))
const worldSections = computed(() => extractSections(worldMd.value))
const hasWorld = computed(() => worldMd.value.trim().length > 0)

const outlineTitle = computed(
  () => extractTitle(outlineMd.value) || t('dashboard.storyOutline'),
)
const outlinePreview = computed(() => extractPreview(outlineMd.value))
const outlineSections = computed(() => extractSections(outlineMd.value))
const hasOutline = computed(() => outlineMd.value.trim().length > 0)

const glossarySections = computed(() => extractSections(glossaryMd.value))

const propsSections = computed(() => extractSections(propsMd.value))

const styleTitle = computed(
  () => extractTitle(writingStyleMd.value) || t('dashboard.writingStyle'),
)
const styleSections = computed(() => extractSections(writingStyleMd.value))
const hasStyle = computed(() => writingStyleMd.value.trim().length > 0)

// View mode toggle: 'grid' | 'list'
const viewMode = ref<'grid' | 'list'>('grid')

const timelineEvents = computed(() =>
  worldEventStore.events.slice(-3).reverse(),
)
const hasTimeline = computed(() => worldEventStore.events.length > 0)
const knowledgeDomains = computed(() => knowledgeBase.domains.value)

// --- Unified resource items ---
interface ResourceItem {
  key: string
  icon: string
  accent: string
  label: string
  value: number | string
  chips: string[]
  preview?: string
  empty: boolean
  emptyHint: string
  action: () => void
}

const resourceItems = computed<ResourceItem[]>(() => [
  {
    key: 'chapters',
    icon: bookOutline,
    accent: 'indigo',
    label: t('preview.chaptersCount'),
    value: stats.value.chapters,
    chips: [],
    empty: stats.value.chapters === 0,
    emptyHint: t('dashboard.clickToManage'),
    action: () => navigateTo('/tabs/workspace/chapters'),
  },
  {
    key: 'characters',
    icon: peopleOutline,
    accent: 'violet',
    label: t('preview.charactersCount'),
    value: stats.value.characters,
    chips: [],
    empty: stats.value.characters === 0,
    emptyHint: t('dashboard.clickToManage'),
    action: () => navigateTo('/tabs/workspace/characters'),
  },
  {
    key: 'scenes',
    icon: imageOutline,
    accent: 'teal',
    label: t('workspace.scenes'),
    value: stats.value.scenes,
    chips: [],
    empty: stats.value.scenes === 0,
    emptyHint: t('dashboard.clickToManage'),
    action: () => navigateTo('/tabs/workspace/scenes'),
  },
  {
    key: 'world',
    icon: globeOutline,
    accent: 'blue',
    label: worldTitle.value,
    value: worldSections.value.length,
    chips: worldSections.value.slice(0, 4),
    empty: !hasWorld.value,
    emptyHint: t('dashboard.clickToEdit'),
    action: () => openFileInEditor('adv/world.md'),
  },
  {
    key: 'outline',
    icon: documentTextOutline,
    accent: 'amber',
    label: outlineTitle.value,
    value: outlineSections.value.length,
    chips: outlineSections.value.slice(0, 4),
    preview: outlinePreview.value,
    empty: !hasOutline.value,
    emptyHint: t('dashboard.clickToEdit'),
    action: () => openFileInEditor('adv/outline.md'),
  },
  {
    key: 'locations',
    icon: locationOutline,
    accent: 'emerald',
    label: t('dashboard.locations'),
    value: stats.value.locations,
    chips: locations.value.slice(0, 4).map(l => l.name),
    empty: stats.value.locations === 0,
    emptyHint: t('dashboard.clickToManage'),
    action: () => navigateTo('/tabs/workspace/locations'),
  },
  {
    key: 'knowledge',
    icon: libraryOutline,
    accent: 'emerald',
    label: t('dashboard.knowledgeBase'),
    value: stats.value.knowledge,
    chips: knowledgeDomains.value.slice(0, 4),
    empty: stats.value.knowledge === 0,
    emptyHint: t('dashboard.noKnowledge'),
    action: () => navigateTo('/tabs/workspace/knowledge'),
  },
  {
    key: 'props',
    icon: cubeOutline,
    accent: 'orange',
    label: t('dashboard.props'),
    value: propsSections.value.length,
    chips: propsSections.value.slice(0, 4),
    empty: propsSections.value.length === 0,
    emptyHint: t('dashboard.clickToEdit'),
    action: () => openFileInEditor('adv/props.md'),
  },
  {
    key: 'glossary',
    icon: bulbOutline,
    accent: 'rose',
    label: t('dashboard.glossary'),
    value: glossarySections.value.length,
    chips: glossarySections.value.slice(0, 4),
    empty: glossarySections.value.length === 0,
    emptyHint: t('dashboard.clickToEdit'),
    action: () => openFileInEditor('adv/glossary.md'),
  },
  {
    key: 'style',
    icon: brushOutline,
    accent: 'pink',
    label: styleTitle.value,
    value: styleSections.value.length,
    chips: styleSections.value.slice(0, 4),
    empty: !hasStyle.value,
    emptyHint: t('dashboard.clickToEdit'),
    action: () => openFileInEditor('adv/writing-style.md'),
  },
  {
    key: 'audio',
    icon: musicalNotesOutline,
    accent: 'amber',
    label: t('dashboard.audioAssets'),
    value: stats.value.audios,
    chips: [],
    empty: stats.value.audios === 0,
    emptyHint: t('dashboard.clickToManage'),
    action: () => navigateTo('/tabs/workspace/audio'),
  },
  {
    key: 'timeline',
    icon: timeOutline,
    accent: 'cyan',
    label: t('dashboard.timeline'),
    value: worldEventStore.events.length,
    chips: timelineEvents.value.map(e => e.summary),
    empty: !hasTimeline.value,
    emptyHint: t('dashboard.noTimeline'),
    action: () => navigateTo('/tabs/world'),
  },
])

function navigateTo(path: string) {
  router.push(path)
}

function openFileInEditor(file: string) {
  router.push(`/editor?file=${encodeURIComponent(file)}`)
}

// --- Project Share ---
async function handleShare() {
  const project = studioStore.currentProject
  if (!project)
    return

  const shareData = {
    title: project.name || 'ADV.JS',
    text: worldPreview.value || t('dashboard.shareText'),
    url: window.location.href,
  }

  if (navigator.share) {
    try {
      await navigator.share(shareData)
    }
    catch {
      // cancelled
    }
  }
  else {
    try {
      await navigator.clipboard.writeText(window.location.href)
      const toast = await toastController.create({
        message: t('dashboard.shareCopied'),
        duration: 1500,
        position: 'top',
      })
      await toast.present()
    }
    catch {
      // clipboard not available
    }
  }
}

const isExporting = ref(false)

async function handleExport() {
  const project = studioStore.currentProject
  const fs = getFs()
  if (!project || !fs)
    return

  isExporting.value = true
  try {
    const blob = await exportProject(fs, project.name || 'project')
    const safeName = (project.name || 'project')
      .toLowerCase()
      .replace(SAFE_NAME_RE, '-')
    downloadBlob(blob, `${safeName}.advpkg.zip`)
    const toast = await toastController.create({
      message: t('project.exportSuccess'),
      duration: 2000,
      position: 'top',
      color: 'success',
    })
    await toast.present()
  }
  catch {
    const toast = await toastController.create({
      message: t('project.exportFailed'),
      duration: 2500,
      position: 'top',
      color: 'danger',
    })
    await toast.present()
  }
  finally {
    isExporting.value = false
  }
}
</script>

<template>
  <div class="overview">
    <!-- Loading -->
    <div v-if="isLoading" class="overview__loading">
      {{ t("preview.loadingGame") }}
    </div>

    <!-- Project Toolbar: info + quick actions -->
    <header
      v-if="projectName"
      class="overview__header"
      :class="{ 'overview__header--card': !!worldPreview }"
    >
      <p v-if="worldPreview" class="overview__desc">
        {{ worldPreview }}
      </p>
      <span v-else class="overview__sync-hint">
        <IonIcon :icon="cloudOutline" class="overview__sync-icon" />
        {{
          lastSyncTime
            ? t("settings.lastSync", {
              time: lastSyncTime.toLocaleTimeString(),
            })
            : t("sync.notSynced")
        }}
      </span>
      <div class="overview__actions">
        <button
          class="overview__icon-btn"
          :title="t('dashboard.share')"
          @click="handleShare"
        >
          <IonIcon :icon="shareOutline" />
        </button>
        <button
          class="overview__icon-btn"
          :class="{
            'overview__icon-btn--syncing': isSyncing,
            'overview__icon-btn--success': syncStatus === 'success',
            'overview__icon-btn--fail': syncStatus === 'failed',
          }"
          :title="
            lastSyncTime
              ? t('settings.lastSync', {
                time: lastSyncTime.toLocaleTimeString(),
              })
              : t('me.cloudSync')
          "
          :disabled="isSyncing"
          @click="handleSync"
        >
          <IonSpinner
            v-if="isSyncing"
            name="crescent"
            style="width: 18px; height: 18px"
          />
          <IonIcon v-else :icon="syncIcon" />
        </button>
        <button
          class="overview__icon-btn"
          :class="{
            'overview__icon-btn--success': validationResult?.passed,
            'overview__icon-btn--fail':
              validationResult && !validationResult.passed,
          }"
          :title="t('validation.clickToCheck')"
          :disabled="isValidating"
          @click="handleValidation"
        >
          <IonSpinner
            v-if="isValidating"
            name="crescent"
            style="width: 18px; height: 18px"
          />
          <IonIcon v-else :icon="validationIcon" />
        </button>
        <button
          class="overview__icon-btn"
          :title="t('project.export')"
          :disabled="isExporting"
          @click="handleExport"
        >
          <IonSpinner
            v-if="isExporting"
            name="crescent"
            style="width: 18px; height: 18px"
          />
          <IonIcon v-else :icon="cloudDownloadOutline" />
        </button>
        <button
          class="overview__icon-btn"
          :title="t('projectSettings.title')"
          @click="showSettings = true"
        >
          <IonIcon :icon="settingsOutline" />
        </button>
      </div>
    </header>

    <!-- ═══════════ Recent Activity ═══════════ -->
    <RecentActivity />

    <!-- ═══════════ Project Health Panel ═══════════ -->
    <section
      v-if="validationResult && !validationResult.passed"
      class="health-section"
    >
      <div class="health-section__header">
        <span class="health-section__title">{{
          t("dashboard.projectHealth")
        }}</span>
        <button
          class="overview__icon-btn"
          :title="t('validation.recheck')"
          :disabled="isValidating"
          @click="handleValidation"
        >
          <IonSpinner
            v-if="isValidating"
            name="crescent"
            style="width: 16px; height: 16px"
          />
          <span v-else style="font-size: 12px">{{
            t("validation.recheck")
          }}</span>
        </button>
      </div>
      <ProjectHealthPanel
        :result="validationResult"
        @auto-fix="handleAutoFix"
      />
    </section>

    <!-- ═══════════ Unified Resource Panel ═══════════ -->
    <div class="resources-header">
      <span class="resources-header__title">{{
        t("dashboard.content") || "Content"
      }}</span>
      <div class="resources-header__toggle">
        <button
          class="resources-header__btn"
          :class="{ 'resources-header__btn--active': viewMode === 'grid' }"
          :title="t('dashboard.gridView') || 'Grid'"
          @click="viewMode = 'grid'"
        >
          <IonIcon :icon="gridOutline" />
        </button>
        <button
          class="resources-header__btn"
          :class="{ 'resources-header__btn--active': viewMode === 'list' }"
          :title="t('dashboard.listView') || 'List'"
          @click="viewMode = 'list'"
        >
          <IonIcon :icon="listOutline" />
        </button>
      </div>
    </div>

    <!-- Grid View -->
    <section v-if="viewMode === 'grid'" class="res-grid">
      <button
        v-for="item in resourceItems"
        :key="item.key"
        class="res-card"
        :class="{ 'res-card--empty': item.empty }"
        :data-accent="item.accent"
        @click="item.action()"
      >
        <div class="res-card__head">
          <span class="res-card__icon"><IonIcon :icon="item.icon" /></span>
          <span class="res-card__title">{{ item.label }}</span>
          <span v-if="Number(item.value) > 0" class="res-card__badge">{{
            item.value
          }}</span>
        </div>
        <p v-if="item.preview" class="res-card__preview">
          {{ item.preview }}
        </p>
        <div v-if="item.chips.length > 0" class="res-card__chips">
          <span v-for="c in item.chips" :key="c" class="chip">{{ c }}</span>
          <span
            v-if="item.key === 'world' && worldSections.length > 4"
            class="chip chip--more"
          >+{{ worldSections.length - 4 }}</span>
          <span
            v-if="item.key === 'outline' && outlineSections.length > 4"
            class="chip chip--more"
          >+{{ outlineSections.length - 4 }}</span>
          <span
            v-if="item.key === 'locations' && locations.length > 4"
            class="chip chip--more"
          >+{{ locations.length - 4 }}</span>
          <span
            v-if="item.key === 'style' && styleSections.length > 4"
            class="chip chip--more"
          >+{{ styleSections.length - 4 }}</span>
        </div>
        <span v-else-if="item.empty" class="res-card__empty-hint">
          <IonIcon :icon="addOutline" class="res-card__empty-icon" />
          {{ item.emptyHint }}
        </span>
      </button>
    </section>

    <!-- List View -->
    <section v-else class="res-list">
      <button
        v-for="item in resourceItems"
        :key="item.key"
        class="res-row"
        :data-accent="item.accent"
        @click="item.action()"
      >
        <span class="res-row__icon"><IonIcon :icon="item.icon" /></span>
        <div class="res-row__body">
          <span class="res-row__title">{{ item.label }}</span>
          <span v-if="item.preview" class="res-row__meta">{{
            item.preview
          }}</span>
          <span v-else-if="item.chips.length > 0" class="res-row__meta">{{ item.chips.slice(0, 3).join(" · ")
          }}<template v-if="item.chips.length > 3">
            · +{{ item.chips.length - 3 }}</template></span>
          <span
            v-else-if="item.empty"
            class="res-row__meta res-row__meta--empty"
          >{{ item.emptyHint }}</span>
        </div>
        <span v-if="Number(item.value) > 0" class="res-row__badge">{{
          item.value
        }}</span>
        <IonIcon :icon="chevronForwardOutline" class="res-row__arrow" />
      </button>
    </section>

    <!-- Project Settings Modal -->
    <ProjectSettingsModal :open="showSettings" @close="showSettings = false" />
  </div>
</template>

<style scoped>
/* ─── Accent Palette (data-accent tokens) ─── */
.overview {
  --accent-indigo: 99, 102, 241;
  --accent-violet: 139, 92, 246;
  --accent-teal: 20, 184, 166;
  --accent-blue: 59, 130, 246;
  --accent-amber: 245, 158, 11;
  --accent-rose: 244, 63, 94;
  --accent-emerald: 16, 185, 129;
  --accent-orange: 249, 115, 22;
  --accent-pink: 236, 72, 153;
  --accent-cyan: 6, 182, 212;

  padding-bottom: var(--adv-space-lg);
}

[data-accent='indigo'] {
  --_a: var(--accent-indigo);
}
[data-accent='violet'] {
  --_a: var(--accent-violet);
}
[data-accent='teal'] {
  --_a: var(--accent-teal);
}
[data-accent='blue'] {
  --_a: var(--accent-blue);
}
[data-accent='amber'] {
  --_a: var(--accent-amber);
}
[data-accent='rose'] {
  --_a: var(--accent-rose);
}
[data-accent='emerald'] {
  --_a: var(--accent-emerald);
}
[data-accent='orange'] {
  --_a: var(--accent-orange);
}
[data-accent='pink'] {
  --_a: var(--accent-pink);
}
[data-accent='cyan'] {
  --_a: var(--accent-cyan);
}

/* ─── Loading ─── */
.overview__loading {
  text-align: center;
  padding: var(--adv-space-lg);
  color: var(--adv-text-tertiary);
}

/* ─── Health Section ─── */
.health-section {
  padding: 0 var(--adv-space-md);
  margin-bottom: var(--adv-space-sm);
}

.health-section__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--adv-space-xs);
}

.health-section__title {
  font-size: 13px;
  font-weight: 700;
  color: var(--adv-text-primary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

/* ─── Header ─── */
.overview__header {
  display: flex;
  align-items: center;
  gap: var(--adv-space-sm);
  padding: 4px var(--adv-space-md);
  justify-content: flex-end;
}

.overview__header--card {
  margin: var(--adv-space-sm) var(--adv-space-md) 0;
  padding: 8px 12px;
  border-radius: 12px;
  background: var(--adv-surface-card);
  border: 1px solid var(--adv-border-subtle);
  justify-content: stretch;
}

.overview__desc {
  flex: 1;
  min-width: 0;
  font-size: var(--adv-font-body-sm);
  color: var(--adv-text-secondary);
  margin: 0;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.overview__sync-hint {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: var(--adv-text-tertiary);
  white-space: nowrap;
}

.overview__sync-icon {
  font-size: 14px;
  flex-shrink: 0;
}

.overview__actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  margin-left: auto;
}

.overview__icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--adv-text-tertiary);
  cursor: pointer;
  flex-shrink: 0;
  font-size: 16px;
  transition:
    color 0.15s ease,
    border-color 0.15s ease,
    background-color 0.15s ease;
  -webkit-tap-highlight-color: transparent;
}

.overview__icon-btn:hover {
  color: var(--adv-text-primary);
  background: rgba(var(--accent-indigo), 0.08);
}

.overview__icon-btn:active {
  transform: scale(0.92);
}

.overview__icon-btn--syncing {
  color: var(--ion-color-primary);
  border-color: rgba(var(--accent-blue), 0.3);
  cursor: wait;
}

.overview__icon-btn--success {
  color: #10b981;
  border-color: rgba(16, 185, 129, 0.3);
}

.overview__icon-btn--fail {
  color: #ef4444;
  border-color: rgba(239, 68, 68, 0.3);
}

/* ─── Resources Header (view toggle) ─── */
.resources-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--adv-space-md) var(--adv-space-md) 0;
}

.resources-header__title {
  font-size: 13px;
  font-weight: 700;
  color: var(--adv-text-primary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.resources-header__toggle {
  display: flex;
  gap: 2px;
  padding: 2px;
  border-radius: 8px;
  background: var(--adv-surface-elevated);
}

.resources-header__btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--adv-text-tertiary);
  font-size: 16px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition:
    color 0.15s ease,
    background 0.15s ease;
}

.resources-header__btn:hover {
  color: var(--adv-text-secondary);
}

.resources-header__btn--active {
  background: var(--adv-surface-card);
  color: var(--adv-text-primary);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

/* ─── Resource Grid ─── */
.res-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  padding: var(--adv-space-sm) var(--adv-space-md) var(--adv-space-md);
}

.res-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px;
  border-radius: 14px;
  background: var(--adv-surface-card);
  border: 1px solid var(--adv-border-subtle);
  text-align: left;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition:
    transform 0.18s cubic-bezier(0.22, 1, 0.36, 1),
    border-color 0.2s ease,
    box-shadow 0.2s ease;
  min-height: 72px;
  overflow: hidden;
}

.res-card:hover {
  border-color: rgba(var(--_a), 0.3);
  box-shadow: 0 4px 16px rgba(var(--_a), 0.08);
}

.res-card:active {
  transform: scale(0.97);
}

.res-card:focus-visible {
  outline: 2px solid rgb(var(--_a));
  outline-offset: 2px;
}

.res-card--empty {
  border-style: dashed;
  border-color: rgba(var(--_a), 0.2);
}

.res-card--empty:hover {
  border-color: rgba(var(--_a), 0.45);
  background: rgba(var(--_a), 0.02);
}

.res-card__head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.res-card__icon {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  flex-shrink: 0;
  background: rgba(var(--_a), 0.1);
  color: rgb(var(--_a));
}

.res-card__title {
  font-size: 12px;
  font-weight: 700;
  color: var(--adv-text-primary);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.res-card__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 10px;
  background: rgba(var(--_a), 0.1);
  color: rgb(var(--_a));
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
}

.res-card__preview {
  font-size: 11px;
  color: var(--adv-text-secondary);
  line-height: 1.5;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.res-card__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
}

.res-card__empty-hint {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: rgba(var(--_a), 0.6);
  font-weight: 500;
}

.res-card__empty-icon {
  font-size: 13px;
}

/* ─── Resource List ─── */
.res-list {
  display: flex;
  flex-direction: column;
  padding: var(--adv-space-sm) var(--adv-space-md) var(--adv-space-md);
  gap: 6px;
}

.res-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid var(--adv-border-subtle);
  background: var(--adv-surface-card);
  text-align: left;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition:
    transform 0.15s ease,
    border-color 0.2s ease,
    background 0.2s ease;
}

.res-row:hover {
  border-color: rgba(var(--_a), 0.3);
  background: rgba(var(--_a), 0.02);
}

.res-row:active {
  transform: scale(0.98);
}

.res-row__icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  flex-shrink: 0;
  background: rgba(var(--_a), 0.1);
  color: rgb(var(--_a));
}

.res-row__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.res-row__title {
  font-size: 13px;
  font-weight: 600;
  color: var(--adv-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.res-row__meta {
  font-size: 11px;
  color: var(--adv-text-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.4;
}

.res-row__meta--empty {
  color: rgba(var(--_a), 0.5);
  font-style: italic;
}

.res-row__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  padding: 0 7px;
  border-radius: 11px;
  background: rgba(var(--_a), 0.1);
  color: rgb(var(--_a));
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
}

.res-row__arrow {
  font-size: 14px;
  color: var(--adv-text-tertiary);
  flex-shrink: 0;
  opacity: 0.4;
  transition: opacity 0.15s ease;
}

.res-row:hover .res-row__arrow {
  opacity: 0.8;
}

/* Shared Chips */
.chip {
  display: inline-block;
  font-size: 10px;
  font-weight: 500;
  line-height: 1;
  padding: 4px 8px;
  border-radius: 6px;
  background: rgba(var(--_a), 0.08);
  color: rgb(var(--_a));
  white-space: nowrap;
}

.chip--more {
  background: transparent;
  color: var(--adv-text-tertiary);
  font-weight: 700;
  padding-left: 4px;
  padding-right: 4px;
}

/* ─── Responsive ─── */
@media (max-width: 767px) {
  .res-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }

  .res-card {
    min-height: 64px;
  }
}

@media (min-width: 768px) {
  .res-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

/* ─── Reduced motion ─── */
@media (prefers-reduced-motion: reduce) {
  .res-card,
  .res-row {
    transition: none;
  }
}
</style>
