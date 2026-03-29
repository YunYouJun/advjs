<script setup lang="ts">
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonPage,
  IonPopover,
  IonTitle,
  IonToolbar,
  toastController,
} from '@ionic/vue'
import { expandOutline, folderOpenOutline, refreshOutline, settingsOutline, shareOutline } from 'ionicons/icons'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import GamePlayer from '../components/GamePlayer.vue'
import NodeSelector from '../components/NodeSelector.vue'
import { useSettingsStore } from '../stores/useSettingsStore'
import { useStudioStore } from '../stores/useStudioStore'
import { downloadFromCloud, listCloudFiles } from '../utils/cloudSync'
import { listFilesInDir, readFileFromDir } from '../utils/fileAccess'

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
  else if (project.dirHandle) {
    const files: string[] = []
    try {
      const chapterFiles = await listFilesInDir(project.dirHandle, 'adv/chapters', '.adv.md')
      files.push(...chapterFiles)
    }
    catch { /* no chapters dir */ }
    try {
      const rootFiles = await listFilesInDir(project.dirHandle, 'adv', '.adv.md')
      for (const f of rootFiles) {
        if (!files.includes(f))
          files.push(f)
      }
    }
    catch { /* no root .adv.md */ }
    chapters.value = files.sort()
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
    else if (project.dirHandle) {
      gameContent.value = await readFileFromDir(project.dirHandle, file)
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
  <IonPage>
    <IonHeader>
      <IonToolbar>
        <IonTitle>{{ headerTitle }}</IonTitle>
        <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
        <IonButtons v-if="studioStore.currentProject" slot="start">
          <NodeSelector
            :chapters="chapters"
            :current-chapter="currentChapterFile"
            :nodes="playerNodes"
            :current-node-index="playerCurrentIndex"
            @select="handleSelectChapter"
            @select-node="handleSelectNode"
          />
        </IonButtons>
        <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
        <IonButtons v-if="studioStore.currentProject" slot="end">
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
        </IonButtons>
      </IonToolbar>
    </IonHeader>

    <IonContent :scroll-y="false">
      <template v-if="studioStore.currentProject">
        <!-- Game player (fills all content space) -->
        <div class="play-game-container">
          <GamePlayer
            ref="gamePlayerRef"
            :content="gameContent"
            :chapter-name="gameChapterName"
          />
        </div>
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
    </IonContent>

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
  </IonPage>
</template>

<style scoped>
.play-game-container {
  height: 100%;
  background: #000;
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
