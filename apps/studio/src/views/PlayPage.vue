<script setup lang="ts">
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
import { expandOutline, folderOpenOutline, refreshOutline, settingsOutline, shareOutline } from 'ionicons/icons'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import LayoutPage from '../components/common/LayoutPage.vue'
import GamePlayer from '../components/GamePlayer.vue'
import NodeSelector from '../components/NodeSelector.vue'
import { useProjectContent } from '../composables/useProjectContent'
import { useSettingsStore } from '../stores/useSettingsStore'
import { useStudioStore } from '../stores/useStudioStore'
import { downloadFromCloud, listCloudFiles } from '../utils/cloudSync'

const { t } = useI18n()
const studioStore = useStudioStore()
const settingsStore = useSettingsStore()
const route = useRoute()
const router = useRouter()

// State
const gameContent = ref('')
const gameChapterName = ref('')
const gamePlayerRef = ref<InstanceType<typeof GamePlayer>>()
const chapters = ref<string[]>([])
const currentChapterFile = ref('')
const settingsPopover = ref(false)
const settingsPopoverEvent = ref<Event>()
const showChapterPanel = ref(false)

watch(() => studioStore.currentProject, () => {
  loadChapters()
}, { immediate: true })

// Handle URL query params: ?file=xxx
onMounted(() => {
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
  if (!gameContent.value && chapters.value.length > 0)
    await loadChapterForPlay(chapters.value[0])
}

/** Load a chapter file for playing */
async function loadChapterForPlay(file: string) {
  const project = studioStore.currentProject
  if (!project)
    return

  currentChapterFile.value = file
  gameChapterName.value = file.split('/').pop()?.replace('.adv.md', '') || file

  try {
    if (project.source === 'cos') {
      gameContent.value = await downloadFromCloud(settingsStore.cos, file)
    }
    else {
      const { getFs } = useProjectContent()
      const fs = getFs()
      if (fs)
        gameContent.value = await fs.readFile(file)
    }
  }
  catch {
    gameContent.value = ''
    const toast = await toastController.create({
      message: t('preview.readError'),
      duration: 2000,
      position: 'top',
      color: 'danger',
    })
    await toast.present()
  }
}

function handleSelectChapter(file: string) {
  loadChapterForPlay(file)
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
      <IonButton size="small" fill="clear" :aria-label="t('preview.settings')" @click="openSettings">
        <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
        <IonIcon slot="icon-only" :icon="settingsOutline" />
      </IonButton>
      <IonButton size="small" fill="clear" :aria-label="t('preview.share')" @click="handleShare">
        <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
        <IonIcon slot="icon-only" :icon="shareOutline" />
      </IonButton>
      <IonButton size="small" fill="clear" aria-label="Fullscreen" @click="toggleFullscreen">
        <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
        <IonIcon slot="icon-only" :icon="expandOutline" />
      </IonButton>
    </template>

    <template v-if="studioStore.currentProject">
      <!-- Game player (fills all content space) -->
      <div class="play-game-container">
        <GamePlayer
          ref="gamePlayerRef"
          :content="gameContent"
          :chapter-name="gameChapterName"
        />

        <!-- Floating chapter list button (mobile) -->
        <button
          v-if="chapters.length > 1"
          class="play-chapter-fab"
          :aria-label="t('preview.chapters')"
          @click="showChapterPanel = true"
        >
          📖 {{ chapters.length }}
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
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border-radius: 20px;
  border: none;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(8px);
  color: rgba(255, 255, 255, 0.8);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: background 0.15s ease;
}

.play-chapter-fab:active {
  background: rgba(0, 0, 0, 0.8);
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
  border-radius: 10px;
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
  font-size: 12px;
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
  font-size: 18px;
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
