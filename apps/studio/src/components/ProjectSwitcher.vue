<script setup lang="ts">
import type { StudioProject } from '../stores/useStudioStore'
import {
  IonButton,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonNote,
  IonPopover,
} from '@ionic/vue'
import {
  checkmarkOutline,
  cloudOutline,
  documentOutline,
  folderOpenOutline,
  globeOutline,
  homeOutline,
  swapHorizontalOutline,
  timeOutline,
} from 'ionicons/icons'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useStudioStore } from '../stores/useStudioStore'
import { detectAdvProject, openProjectDirectory } from '../utils/fileAccess'

const { t } = useI18n()
const studioStore = useStudioStore()
const popoverOpen = ref(false)
const popoverEvent = ref<Event>()

const currentProject = computed(() => studioStore.currentProject)
const currentName = computed(() => currentProject.value?.name)

/** Other projects (exclude active one) shown in popover */
const otherProjects = computed(() =>
  studioStore.projects
    .filter(p => p.name !== currentName.value)
    .slice(0, 5),
)

const hasOtherProjects = computed(() => otherProjects.value.length > 0)

/** Relative time string for "last opened" */
function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 7)
    return new Date(timestamp).toLocaleDateString()
  if (days > 0)
    return `${days}d`
  if (hours > 0)
    return `${hours}h`
  if (minutes > 0)
    return `${minutes}m`
  return t('projects.justNow', 'Just now')
}

/** Icon per source type */
function sourceIcon(source?: StudioProject['source']) {
  switch (source) {
    case 'local': return folderOpenOutline
    case 'cos': return cloudOutline
    case 'url': return globeOutline
    default: return documentOutline
  }
}

function openPopover(e: Event) {
  popoverEvent.value = e
  popoverOpen.value = true
}

function selectProject(project: StudioProject) {
  studioStore.setCurrentProject(project)
  popoverOpen.value = false
}

function backToHome() {
  studioStore.setCurrentProject(null)
  popoverOpen.value = false
}

async function handleOpenLocal() {
  popoverOpen.value = false
  try {
    const dirHandle = await openProjectDirectory()
    const detection = await detectAdvProject(dirHandle)
    studioStore.setCurrentProject({
      name: detection.isValid ? detection.name : dirHandle.name,
      dirHandle,
      source: 'local',
      lastOpened: Date.now(),
    })
  }
  catch {
    // User cancelled
  }
}
</script>

<template>
  <div class="project-switcher">
    <IonButton
      fill="clear"
      size="small"
      class="project-switcher__trigger"
      :title="t('workspace.switchProject')"
      :aria-label="t('workspace.switchProject')"
      @click="openPopover"
    >
      <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
      <IonIcon slot="start" :icon="swapHorizontalOutline" />
      <span v-if="currentName" class="project-switcher__name">{{ currentName }}</span>
    </IonButton>

    <IonPopover
      :is-open="popoverOpen"
      :event="popoverEvent"
      class="project-switcher__popover"
      @did-dismiss="popoverOpen = false"
    >
      <IonList lines="none" class="project-switcher__list">
        <IonListHeader>
          <IonLabel class="project-switcher__header">
            {{ t('workspace.switchProject') }}
          </IonLabel>
        </IonListHeader>

        <!-- Current active project -->
        <IonItem v-if="currentName" :detail="false" class="project-switcher__active">
          <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
          <IonIcon slot="start" :icon="checkmarkOutline" color="primary" />
          <IonLabel color="primary">
            <strong>{{ currentName }}</strong>
            <p v-if="currentProject?.source" class="project-switcher__meta">
              <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
              <IonIcon :icon="sourceIcon(currentProject.source)" class="project-switcher__meta-icon" />
              {{ currentProject.source }}
            </p>
          </IonLabel>
          <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
          <IonNote slot="end" class="project-switcher__badge">
            {{ t('projects.active') }}
          </IonNote>
        </IonItem>

        <!-- Divider between active and other projects -->
        <div v-if="currentName && hasOtherProjects" class="project-switcher__divider" />

        <!-- Other projects -->
        <IonItem
          v-for="project in otherProjects"
          :key="project.name + project.lastOpened"
          button
          :detail="false"
          class="project-switcher__item"
          @click="selectProject(project)"
        >
          <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
          <IonIcon slot="start" :icon="sourceIcon(project.source)" class="project-switcher__item-icon" />
          <IonLabel>
            {{ project.name }}
            <p v-if="project.lastOpened" class="project-switcher__time">
              <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
              <IonIcon :icon="timeOutline" class="project-switcher__meta-icon" />
              {{ formatRelativeTime(project.lastOpened) }}
            </p>
          </IonLabel>
        </IonItem>

        <!-- Empty state: no other projects -->
        <IonItem v-if="!hasOtherProjects && currentName" :detail="false" class="project-switcher__empty">
          <IonLabel color="medium" class="ion-text-center">
            <p>{{ t('projects.noOtherProjects', 'No other projects') }}</p>
          </IonLabel>
        </IonItem>

        <!-- Actions divider -->
        <div class="project-switcher__divider" />

        <!-- Open local project -->
        <IonItem button :detail="false" class="project-switcher__action" @click="handleOpenLocal">
          <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
          <IonIcon slot="start" :icon="folderOpenOutline" color="primary" />
          <IonLabel color="primary">
            {{ t('projects.openLocal') }}
          </IonLabel>
        </IonItem>

        <!-- Back to home -->
        <IonItem button :detail="false" lines="none" class="project-switcher__action" @click="backToHome">
          <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
          <IonIcon slot="start" :icon="homeOutline" />
          <IonLabel color="medium">
            {{ t('workspace.backToHome') }}
          </IonLabel>
        </IonItem>
      </IonList>
    </IonPopover>
  </div>
</template>

<style scoped>
.project-switcher {
  display: flex;
  align-items: center;
  padding-inline-end: var(--adv-space-xs, 4px);
}

/* --- Trigger button --- */
.project-switcher__trigger {
  --padding-start: var(--adv-space-sm, 8px);
  --padding-end: var(--adv-space-sm, 8px);
  font-size: 18px;
  min-height: 44px; /* UX: touch target minimum */
  transition: opacity var(--adv-duration-fast, 150ms) var(--adv-ease-default, ease);
}

.project-switcher__trigger:hover {
  opacity: 0.8;
}

.project-switcher__name {
  font-size: var(--adv-font-body-sm, 13px);
  font-weight: 500;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-inline-start: var(--adv-space-xs, 4px);
}

/* --- Popover --- */
.project-switcher__popover {
  --width: 280px;
}

.project-switcher__list {
  padding-top: var(--adv-space-xs, 4px);
  padding-bottom: var(--adv-space-xs, 4px);
}

.project-switcher__header {
  font-size: var(--adv-font-body-sm, 13px);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--adv-text-tertiary, #9ca3af);
}

/* --- Active project highlight --- */
.project-switcher__active {
  --background: var(--adv-gradient-surface, rgba(99, 102, 241, 0.06));
}

.project-switcher__badge {
  font-size: var(--adv-font-caption, 11px);
  font-weight: 600;
  color: var(--ion-color-primary);
  background: rgba(var(--ion-color-primary-rgb, 99, 102, 241), 0.1);
  border-radius: var(--adv-radius-full, 9999px);
  padding: 2px 8px;
  line-height: 1.4;
}

/* --- Project items --- */
.project-switcher__item {
  --transition: background-color var(--adv-duration-fast, 150ms) var(--adv-ease-default, ease);
}

.project-switcher__item-icon {
  font-size: 18px;
  color: var(--adv-text-tertiary, #9ca3af);
}

/* --- Meta info (source type, time) --- */
.project-switcher__meta,
.project-switcher__time {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: var(--adv-font-caption, 11px);
  color: var(--adv-text-tertiary, #9ca3af);
  margin-top: 2px;
}

.project-switcher__meta-icon {
  font-size: 12px;
}

/* --- Empty state --- */
.project-switcher__empty {
  --min-height: 48px;
}

.project-switcher__empty p {
  font-size: var(--adv-font-body-sm, 13px);
  font-style: italic;
}

/* --- Divider --- */
.project-switcher__divider {
  height: 1px;
  background: var(--adv-border-subtle, rgba(0, 0, 0, 0.06));
  margin: var(--adv-space-xs, 4px) var(--adv-space-md, 16px);
}

/* --- Action items (open local, back home) --- */
.project-switcher__action {
  --transition: background-color var(--adv-duration-fast, 150ms) var(--adv-ease-default, ease);
  font-size: var(--adv-font-body-sm, 13px);
}

/* UX: ensure sufficient contrast in dark mode */
:root.dark .project-switcher__badge {
  background: rgba(var(--ion-color-primary-rgb, 99, 102, 241), 0.2);
}
</style>
