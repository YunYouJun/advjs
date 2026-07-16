<script setup lang="ts">
import type { DbPlaySaveSlot } from '../utils/db'
import {
  IonButton,
  IonContent,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonPopover,
  toastController,
} from '@ionic/vue'
import {
  arrowUndoOutline,
  bookOutline,
  expandOutline,
  folderOpenOutline,
  gitNetworkOutline,
  imageOutline,
  refreshOutline,
  saveOutline,
  settingsOutline,
  shareOutline,
  statsChartOutline,
} from 'ionicons/icons'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import BranchGraphModal from '../components/BranchGraphModal.vue'
import CgGalleryModal from '../components/CgGalleryModal.vue'
import LayoutPage from '../components/common/LayoutPage.vue'
import GamePlayer from '../components/GamePlayer.vue'
import LoadSlotModal from '../components/LoadSlotModal.vue'
import NodeSelector from '../components/NodeSelector.vue'
import SaveSlotModal from '../components/SaveSlotModal.vue'
import StoryStatsModal from '../components/StoryStatsModal.vue'
import { useProjectContent } from '../composables/useProjectContent'
import { useSettingsStore } from '../stores/useSettingsStore'
import { useStudioStore } from '../stores/useStudioStore'
import { listCloudFiles } from '../utils/cloudSync'

const { t } = useI18n()
const studioStore = useStudioStore()
const settingsStore = useSettingsStore()
const route = useRoute()
const router = useRouter()

// State
const gameChapterName = ref('')
const gamePlayerRef = ref<InstanceType<typeof GamePlayer>>()
const chapters = ref<string[]>([])
const currentChapterFile = ref('')
const settingsPopover = ref(false)
const settingsPopoverEvent = ref<Event>()
const showChapterPanel = ref(false)
const saveModalOpen = ref(false)
const loadModalOpen = ref(false)
const cgModalOpen = ref(false)
const statsModalOpen = ref(false)
const branchModalOpen = ref(false)

watch(() => studioStore.currentProject, () => {
  loadChapters()
}, { immediate: true })

// Auto-restore last project on page reload (in case user lands directly on PlayPage)
onMounted(async () => {
  if (!studioStore.currentProject)
    await studioStore.autoRestoreLastProject()

  const fileParam = route.query.file as string
  if (fileParam)
    loadChapterForPlay(fileParam)
})

/** Header title: show chapter name or project name or fallback */
const headerTitle = computed(() => {
  if (gameChapterName.value)
    return gameChapterName.value
  if (studioStore.currentProject?.name)
    return studioStore.currentProject.name
  return t('preview.title')
})

/** Renderable nodes from GamePlayer for NodeSelector */
const playerNodes = computed(() => {
  return gamePlayerRef.value?.renderableNodes ?? []
})

const playerCurrentIndex = computed(() => {
  return gamePlayerRef.value?.currentIndex ?? 0
})

const playerTotalNodes = computed(() => gamePlayerRef.value?.totalNodes ?? 0)
const playerVisitedOrders = computed<number[]>(() => gamePlayerRef.value?.visitedOrders ?? [])
const playerHistoryStack = computed<number[]>(() => gamePlayerRef.value?.historyStack ?? [])
const playerUnlockedCGs = computed<string[]>(() => gamePlayerRef.value?.unlockedCGs ?? [])
const playerChapterAst = computed(() => gamePlayerRef.value?.currentChapterAst)
const canRollback = computed(() => playerHistoryStack.value.length > 0)

function getCurrentSnapshot() {
  const snapshot = gamePlayerRef.value?.getCurrentSnapshot()
  if (!snapshot)
    throw new Error('Runtime is not ready')
  return snapshot
}

async function handleLoadSlot(row: DbPlaySaveSlot) {
  if (!row.snapshot)
    throw new Error('This save uses the legacy Studio format')
  gamePlayerRef.value?.restore(row.snapshot)
  handleRuntimeChapterChange(row.chapterFile)
  gamePlayerRef.value?.hydrateProgress(row.chapterFile, {
    visitedOrders: row.visitedOrders,
    history: row.history,
    unlockedCGs: row.unlockedCGs,
  })
  const toast = await toastController.create({
    message: t('preview.loadSuccess', { slot: row.slot }),
    duration: 1500,
    position: 'top',
    color: 'success',
  })
  await toast.present()
}

async function handleRollback() {
  const newOrder = gamePlayerRef.value?.rollback(1) ?? null
  if (newOrder === null) {
    const toast = await toastController.create({
      message: t('preview.rollbackUnavailable'),
      duration: 1200,
      position: 'top',
    })
    await toast.present()
  }
}

/** List available chapters from project */
async function loadChapters() {
  const project = studioStore.currentProject
  if (!project)
    return

  if (project.source === 'cos' && project.cosPrefix) {
    try {
      const allFiles = await listCloudFiles(settingsStore.cos, project.cosPrefix)
      chapters.value = allFiles.filter(f => f.endsWith('.adv.md')).sort()
    }
    catch {
      chapters.value = []
    }
  }
  else {
    const { getFs } = useProjectContent()
    const fs = getFs()
    if (fs) {
      const files: string[] = []
      try {
        const chapterFiles = await fs.listFiles('adv/chapters', '.adv.md')
        files.push(...chapterFiles)
      }
      catch { /* no chapters dir */ }
      try {
        const rootFiles = await fs.listFiles('adv', '.adv.md')
        for (const f of rootFiles) {
          if (!files.includes(f))
            files.push(f)
        }
      }
      catch { /* no root .adv.md */ }
      chapters.value = files.sort()
    }
  }

  // Auto-load first chapter if no URL param
  if (!currentChapterFile.value && chapters.value.length > 0)
    await loadChapterForPlay(chapters.value[0])
}

/** Load a chapter file for playing */
async function loadChapterForPlay(file: string) {
  const project = studioStore.currentProject
  if (!project)
    return

  currentChapterFile.value = file
  gameChapterName.value = file.split('/').pop()?.replace('.adv.md', '') || file
}

function handleSelectChapter(file: string) {
  loadChapterForPlay(file)
}

function handleRuntimeChapterChange(chapterId: string) {
  if (!chapters.value.includes(chapterId))
    return
  currentChapterFile.value = chapterId
  gameChapterName.value = chapterId.split('/').pop()?.replace('.adv.md', '') || chapterId
}

function handleSelectNode(index: number) {
  gamePlayerRef.value?.goToNode(index)
}

function toggleFullscreen() {
  const el = document.querySelector('.play-game-container')
  if (!el)
    return

  if (!document.fullscreenElement)
    el.requestFullscreen?.()
  else
    document.exitFullscreen?.()
}

function openSettings(ev: Event) {
  settingsPopoverEvent.value = ev
  settingsPopover.value = true
}

function handleMenuRestart() {
  settingsPopover.value = false
  gamePlayerRef.value?.restart()
}

function handleMenuGoSettings() {
  settingsPopover.value = false
  router.push('/tabs/me')
}

async function handleShare() {
  const shareData = {
    title: studioStore.currentProject?.name || 'ADV.JS',
    text: t('preview.shareTitle'),
    url: window.location.href,
  }

  if (navigator.share) {
    try {
      await navigator.share(shareData)
    }
    catch {
      // User cancelled or share failed — ignore
    }
  }
  else {
    try {
      await navigator.clipboard.writeText(window.location.href)
      const toast = await toastController.create({
        message: t('preview.shareCopied'),
        duration: 1500,
        position: 'top',
      })
      await toast.present()
    }
    catch {
      // Clipboard not available
    }
  }
}
</script>

<template>
  <LayoutPage :title="headerTitle" :fullscreen="false" :scroll-y="false">
    <template v-if="studioStore.currentProject" #start>
      <NodeSelector
        :chapters="chapters"
        :current-chapter="currentChapterFile"
        :nodes="playerNodes"
        :current-node-index="playerCurrentIndex"
        @select="handleSelectChapter"
        @select-node="handleSelectNode"
      />
    </template>
    <template v-if="studioStore.currentProject" #end>
      <IonButton fill="clear" :aria-label="t('preview.save')" @click="saveModalOpen = true">
        <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
        <IonIcon slot="icon-only" :icon="saveOutline" />
      </IonButton>
      <IonButton fill="clear" :aria-label="t('preview.load')" @click="loadModalOpen = true">
        <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
        <IonIcon slot="icon-only" :icon="folderOpenOutline" />
      </IonButton>
      <IonButton fill="clear" :aria-label="t('preview.cgGallery')" @click="cgModalOpen = true">
        <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
        <IonIcon slot="icon-only" :icon="imageOutline" />
      </IonButton>
      <IonButton fill="clear" :aria-label="t('preview.stats')" @click="statsModalOpen = true">
        <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
        <IonIcon slot="icon-only" :icon="statsChartOutline" />
      </IonButton>
      <IonButton fill="clear" :aria-label="t('preview.branchGraph')" @click="branchModalOpen = true">
        <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
        <IonIcon slot="icon-only" :icon="gitNetworkOutline" />
      </IonButton>
      <IonButton fill="clear" :aria-label="t('preview.settings')" @click="openSettings">
        <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
        <IonIcon slot="icon-only" :icon="settingsOutline" />
      </IonButton>
      <IonButton fill="clear" :aria-label="t('preview.share')" @click="handleShare">
        <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
        <IonIcon slot="icon-only" :icon="shareOutline" />
      </IonButton>
      <IonButton fill="clear" aria-label="Fullscreen" @click="toggleFullscreen">
        <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
        <IonIcon slot="icon-only" :icon="expandOutline" />
      </IonButton>
    </template>

    <template v-if="studioStore.currentProject">
      <!-- Game player (fills all content space) -->
      <div class="play-game-container">
        <GamePlayer
          ref="gamePlayerRef"
          :chapter-name="gameChapterName"
          :chapter-file="currentChapterFile"
          @chapter-change="handleRuntimeChapterChange"
        />

        <!-- Floating chapter list button (mobile) -->
        <button
          v-if="chapters.length > 1"
          class="play-chapter-fab"
          :aria-label="t('preview.chapters')"
          @click="showChapterPanel = true"
        >
          <IonIcon :icon="bookOutline" /> {{ chapters.length }}
        </button>

        <!-- Rollback FAB (only when history is non-empty) -->
        <button
          v-if="canRollback"
          class="play-rollback-fab"
          :aria-label="t('preview.rollback')"
          :title="t('preview.rollback')"
          @click="handleRollback"
        >
          <IonIcon :icon="arrowUndoOutline" />
          {{ t('preview.rollbackButton') }}
        </button>
      </div>

      <!-- Bottom sheet chapter panel -->
      <IonModal
        :is-open="showChapterPanel"
        :initial-breakpoint="0.5"
        :breakpoints="[0, 0.5, 0.75]"
        class="play-chapter-modal"
        @did-dismiss="showChapterPanel = false"
      >
        <IonContent>
          <div class="play-chapter-panel">
            <h3 class="play-chapter-panel__title">
              {{ t('preview.chapters') }}
            </h3>
            <div class="play-chapter-panel__list">
              <button
                v-for="file in chapters"
                :key="file"
                class="play-chapter-panel__item"
                :class="{ 'play-chapter-panel__item--active': file === currentChapterFile }"
                @click="handleSelectChapter(file); showChapterPanel = false"
              >
                <span class="play-chapter-panel__name">
                  {{ file.split('/').pop()?.replace('.adv.md', '') || file }}
                </span>
                <span v-if="file === currentChapterFile" class="play-chapter-panel__badge">
                  ▶
                </span>
              </button>
            </div>
          </div>
        </IonContent>
      </IonModal>
    </template>

    <!-- Empty state: no project -->
    <div v-else class="empty-state">
      <div class="empty-state__illustration">
        <IonIcon :icon="folderOpenOutline" />
      </div>
      <h3 class="empty-state__title">
        {{ t('preview.emptyTitle') }}
      </h3>
      <p class="empty-state__description">
        {{ t('preview.emptyDescription') }}
      </p>
    </div>

    <!-- Settings popover menu -->
    <IonPopover
      :is-open="settingsPopover"
      :event="settingsPopoverEvent"
      :translucent="true"
      :dismiss-on-select="true"
      class="adv-settings-popover"
      @did-dismiss="settingsPopover = false"
    >
      <IonList lines="none" class="adv-popover-menu">
        <IonItem button :detail="false" @click="handleMenuRestart">
          <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
          <IonIcon slot="start" :icon="refreshOutline" />
          <IonLabel>{{ t('preview.restart') }}</IonLabel>
        </IonItem>
        <IonItem button :detail="false" @click="handleMenuGoSettings">
          <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
          <IonIcon slot="start" :icon="settingsOutline" />
          <IonLabel>{{ t('preview.goSettings') }}</IonLabel>
        </IonItem>
      </IonList>
    </IonPopover>

    <!-- Save / Load / CG / Stats modals (Phase 17a) -->
    <SaveSlotModal
      v-if="studioStore.currentProject"
      v-model:open="saveModalOpen"
      :get-snapshot="getCurrentSnapshot"
      :visited-orders="playerVisitedOrders"
      :history="playerHistoryStack"
      :unlocked-cgs="playerUnlockedCGs"
    />
    <LoadSlotModal
      v-if="studioStore.currentProject"
      v-model:open="loadModalOpen"
      @select="handleLoadSlot"
    />
    <CgGalleryModal
      v-if="studioStore.currentProject"
      v-model:open="cgModalOpen"
      :unlocked-cgs="playerUnlockedCGs"
    />
    <StoryStatsModal
      v-if="studioStore.currentProject"
      v-model:open="statsModalOpen"
      :chapter-title="gameChapterName"
      :total-nodes="playerTotalNodes"
      :visited-orders="playerVisitedOrders"
      :unlocked-cgs="playerUnlockedCGs"
      :chapter-ast="playerChapterAst"
    />
    <BranchGraphModal
      v-if="studioStore.currentProject"
      v-model:open="branchModalOpen"
      :ast="playerChapterAst"
      :current-order="playerCurrentIndex"
      :visited-orders="playerVisitedOrders"
    />
  </LayoutPage>
</template>

<style scoped>
.play-game-container {
  height: 100%;
  background: #000;
  position: relative;
}

/* Floating chapter button */
.play-chapter-fab {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 10;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border-radius: var(--adv-radius-xl);
  border: none;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(8px);
  color: rgba(255, 255, 255, 0.8);
  font-size: var(--adv-font-body-sm);
  font-weight: 600;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: background 0.15s ease;
}

.play-chapter-fab ion-icon {
  font-size: var(--adv-font-body-sm);
}

.play-chapter-fab:active {
  background: rgba(0, 0, 0, 0.8);
}

/* Rollback FAB (bottom-right, mirrors chapter FAB visual) */
.play-rollback-fab {
  position: absolute;
  bottom: 16px;
  right: 16px;
  z-index: 10;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 8px 14px;
  border-radius: var(--adv-radius-xl);
  border: none;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(8px);
  color: rgba(255, 255, 255, 0.85);
  font-size: var(--adv-font-body-sm);
  font-weight: 600;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition:
    background 0.15s ease,
    transform 0.1s ease;
}

.play-rollback-fab ion-icon {
  font-size: var(--adv-font-body);
}

.play-rollback-fab:hover {
  background: rgba(0, 0, 0, 0.75);
}

.play-rollback-fab:active {
  transform: scale(0.96);
}

/* Chapter panel */
.play-chapter-panel {
  padding: var(--adv-space-md);
}

.play-chapter-panel__title {
  font-size: var(--adv-font-subtitle);
  font-weight: 700;
  margin: 0 0 var(--adv-space-md);
  color: var(--adv-text-primary);
}

.play-chapter-panel__list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.play-chapter-panel__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-radius: var(--adv-radius-md);
  border: 1px solid transparent;
  background: transparent;
  color: var(--adv-text-primary);
  font-size: var(--adv-font-body);
  cursor: pointer;
  text-align: left;
  -webkit-tap-highlight-color: transparent;
  transition: background 0.15s ease;
}

.play-chapter-panel__item:hover {
  background: var(--adv-surface-elevated);
}

.play-chapter-panel__item:active {
  transform: scale(0.98);
}

.play-chapter-panel__item--active {
  background: rgba(99, 102, 241, 0.08);
  border-color: rgba(99, 102, 241, 0.2);
  font-weight: 600;
}

.play-chapter-panel__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.play-chapter-panel__badge {
  color: var(--ion-color-primary);
  font-size: var(--adv-font-body-sm);
  flex-shrink: 0;
}

.adv-popover-menu {
  padding: var(--adv-space-xs) 0;
}

.adv-popover-menu ion-item {
  --min-height: 40px;
  --padding-start: var(--adv-space-md);
  --padding-end: var(--adv-space-md);
  --inner-padding-end: 0;
  font-size: var(--adv-font-body);
  cursor: pointer;
}

.adv-popover-menu ion-item ion-icon {
  font-size: var(--adv-font-subtitle);
  color: var(--adv-text-secondary);
  margin-inline-end: var(--adv-space-sm);
}

.adv-popover-menu ion-item ion-label {
  font-weight: 500;
}
</style>

<style>
/* Popover container override (unscoped to target ion-popover shadow parts) */
.adv-settings-popover {
  --width: 200px;
  --border-radius: var(--adv-radius-md);
  --box-shadow: var(--adv-shadow-elevated);
}
</style>
