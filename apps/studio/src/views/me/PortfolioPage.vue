<script setup lang="ts">
import type { CloudProjectRecord } from '../../composables/useCloudBinding'
import {
  IonBackButton,
  IonButtons,
  IonHeader,
  IonIcon,
  IonSpinner,
  IonTitle,
  IonToolbar,
  toastController,
} from '@ionic/vue'
import {
  bookOutline,
  cloudUploadOutline,
  eyeOffOutline,
  eyeOutline,
  peopleOutline,
  ribbonOutline,
} from 'ionicons/icons'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import LayoutPage from '../../components/common/LayoutPage.vue'
import { useCloudbase } from '../../composables/useCloudbase'
import { useCloudBinding } from '../../composables/useCloudBinding'
import { useProjectContent } from '../../composables/useProjectContent'
import { useAuthStore } from '../../stores/useAuthStore'
import { useStudioStore } from '../../stores/useStudioStore'

const { t } = useI18n()
const authStore = useAuthStore()
const studioStore = useStudioStore()
const { stats: projectStats } = useProjectContent()
const { isBusy, error, fetchMyProjects, bindProject, togglePublished } = useCloudBinding()

let cloudApp: ReturnType<typeof useCloudbase>['app'] | null = null
try {
  cloudApp = useCloudbase().app
}
catch {
  // CloudBase not configured
}

const cloudProjects = ref<CloudProjectRecord[]>([])
const isLoading = ref(false)

const totalStats = computed(() => {
  let chapters = 0
  let characters = 0
  let scenes = 0
  for (const p of cloudProjects.value) {
    chapters += p.stats?.chapters || 0
    characters += p.stats?.characters || 0
    scenes += p.stats?.scenes || 0
  }
  return { chapters, characters, scenes, projects: cloudProjects.value.length }
})

onMounted(async () => {
  if (!cloudApp || !authStore.isLoggedIn)
    return
  await loadProjects()
})

watch(() => authStore.isLoggedIn, async (loggedIn) => {
  if (loggedIn && cloudApp && cloudProjects.value.length === 0)
    await loadProjects()
})

async function loadProjects() {
  if (!cloudApp)
    return
  isLoading.value = true
  try {
    cloudProjects.value = await fetchMyProjects(cloudApp)
  }
  finally {
    isLoading.value = false
  }
}

async function handleBindCurrent() {
  if (!cloudApp || !authStore.isLoggedIn)
    return

  const project = studioStore.currentProject
  if (!project) {
    const toast = await toastController.create({
      message: t('portfolio.noProject'),
      duration: 2000,
      position: 'top',
    })
    await toast.present()
    return
  }

  const cloudId = await bindProject(cloudApp, project, {
    published: true,
    stats: {
      chapters: projectStats.value.chapters,
      characters: projectStats.value.characters,
      scenes: projectStats.value.scenes,
      locations: projectStats.value.locations,
    },
  })

  if (cloudId) {
    const toast = await toastController.create({
      message: t('portfolio.bindSuccess'),
      duration: 1500,
      position: 'top',
    })
    await toast.present()
    await loadProjects()
  }
  else if (error.value) {
    const toast = await toastController.create({
      message: `${t('portfolio.bindFailed')}: ${error.value}`,
      duration: 2000,
      position: 'top',
    })
    await toast.present()
  }
}

async function handleTogglePublished(record: CloudProjectRecord) {
  if (!cloudApp)
    return
  const newState = !record.published
  const ok = await togglePublished(cloudApp, record.projectId, newState)
  if (ok) {
    record.published = newState
  }
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString()
}
</script>

<template>
  <LayoutPage :title="t('portfolio.title')">
    <IonHeader collapse="condense">
      <IonToolbar>
        <IonButtons slot="start">
          <IonBackButton default-href="/tabs/me" />
        </IonButtons>
        <IonTitle size="large">
          {{ t('portfolio.title') }}
        </IonTitle>
      </IonToolbar>
    </IonHeader>

    <div class="page-container">
      <!-- Not logged in -->
      <div v-if="!authStore.isLoggedIn" class="empty-state">
        <IonIcon :icon="ribbonOutline" class="empty-state__icon" />
        <h3>{{ t('portfolio.loginRequired') }}</h3>
        <p>{{ t('portfolio.loginRequiredDesc') }}</p>
      </div>

      <template v-else>
        <!-- Stats Summary -->
        <div class="stats-grid">
          <div class="stat-card">
            <span class="stat-card__value">{{ totalStats.projects }}</span>
            <span class="stat-card__label">{{ t('portfolio.totalProjects') }}</span>
          </div>
          <div class="stat-card">
            <span class="stat-card__value">{{ totalStats.characters }}</span>
            <span class="stat-card__label">{{ t('portfolio.totalCharacters') }}</span>
          </div>
          <div class="stat-card">
            <span class="stat-card__value">{{ totalStats.chapters }}</span>
            <span class="stat-card__label">{{ t('portfolio.totalChapters') }}</span>
          </div>
          <div class="stat-card">
            <span class="stat-card__value">{{ totalStats.scenes }}</span>
            <span class="stat-card__label">{{ t('portfolio.totalScenes') }}</span>
          </div>
        </div>

        <!-- Bind Current Project -->
        <button
          class="bind-btn"
          :disabled="isBusy || !studioStore.currentProject"
          @click="handleBindCurrent"
        >
          <IonIcon :icon="cloudUploadOutline" />
          <span>{{ t('portfolio.bindCurrent') }}</span>
          <IonSpinner v-if="isBusy" name="dots" />
        </button>

        <!-- Loading -->
        <div v-if="isLoading" class="loading-state">
          <IonSpinner name="crescent" />
        </div>

        <!-- Project List -->
        <div v-else-if="cloudProjects.length > 0" class="project-list">
          <div
            v-for="record in cloudProjects"
            :key="record._id"
            class="project-item"
          >
            <div class="project-item__cover">
              <img v-if="record.cover" :src="record.cover" alt="">
              <IonIcon v-else :icon="bookOutline" />
            </div>
            <div class="project-item__info">
              <span class="project-item__name">{{ record.name }}</span>
              <span class="project-item__desc">{{ record.description || t('portfolio.noDescription') }}</span>
              <span class="project-item__meta">
                <template v-if="record.stats">
                  <IonIcon :icon="peopleOutline" />
                  {{ record.stats.characters }}
                  <IonIcon :icon="bookOutline" />
                  {{ record.stats.chapters }}
                </template>
                · {{ formatDate(record.updatedAt) }}
              </span>
            </div>
            <button
              class="project-item__visibility"
              :title="record.published ? t('portfolio.unpublish') : t('portfolio.publish')"
              @click="handleTogglePublished(record)"
            >
              <IonIcon :icon="record.published ? eyeOutline : eyeOffOutline" />
            </button>
          </div>
        </div>

        <!-- Empty -->
        <div v-else class="empty-state">
          <IonIcon :icon="ribbonOutline" class="empty-state__icon" />
          <h3>{{ t('portfolio.empty') }}</h3>
          <p>{{ t('portfolio.emptyDesc') }}</p>
        </div>
      </template>
    </div>
  </LayoutPage>
</template>

<style scoped>
.page-container {
  padding: var(--adv-space-md);
  display: flex;
  flex-direction: column;
  gap: var(--adv-space-md);
  max-width: 560px;
  margin: 0 auto;
}

/* ── Stats Grid ── */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--adv-space-sm);
}

.stat-card {
  padding: var(--adv-space-md);
  border-radius: var(--adv-radius-md);
  background: var(--adv-surface-card);
  border: 1px solid var(--adv-border-subtle);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.stat-card__value {
  font-size: var(--adv-font-title);
  font-weight: 700;
  color: var(--adv-text-primary);
}

.stat-card__label {
  font-size: var(--adv-font-body-sm);
  color: var(--adv-text-tertiary);
}

/* ── Bind Button ── */
.bind-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--adv-space-xs);
  width: 100%;
  height: 44px;
  border-radius: var(--adv-radius-md);
  border: 1.5px dashed var(--ion-color-primary);
  background: transparent;
  color: var(--ion-color-primary);
  font-size: var(--adv-font-body-sm);
  font-weight: 600;
  cursor: pointer;
  transition: background var(--adv-duration-fast) var(--adv-ease-default);
}

.bind-btn:hover:not(:disabled) {
  background: rgba(var(--ion-color-primary-rgb), 0.06);
}

.bind-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ── Project List ── */
.project-list {
  display: flex;
  flex-direction: column;
  gap: var(--adv-space-sm);
}

.project-item {
  display: flex;
  align-items: center;
  gap: var(--adv-space-md);
  padding: var(--adv-space-md);
  border-radius: var(--adv-radius-md);
  background: var(--adv-surface-card);
  border: 1px solid var(--adv-border-subtle);
}

.project-item__cover {
  width: 48px;
  height: 48px;
  border-radius: var(--adv-radius-sm);
  background: var(--adv-surface-elevated);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
  font-size: 20px;
  color: var(--adv-text-tertiary);
}

.project-item__cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.project-item__info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.project-item__name {
  font-size: var(--adv-font-body);
  font-weight: 600;
  color: var(--adv-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.project-item__desc {
  font-size: var(--adv-font-body-sm);
  color: var(--adv-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.project-item__meta {
  font-size: 11px;
  color: var(--adv-text-tertiary);
  display: flex;
  align-items: center;
  gap: 4px;
}

.project-item__meta ion-icon {
  font-size: 12px;
}

.project-item__visibility {
  width: 36px;
  height: 36px;
  border: none;
  background: transparent;
  color: var(--adv-text-tertiary);
  font-size: 18px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  flex-shrink: 0;
  transition: background var(--adv-duration-fast);
}

.project-item__visibility:hover {
  background: var(--adv-surface-elevated);
}

/* ── Empty / Loading ── */
.empty-state {
  text-align: center;
  padding: var(--adv-space-xl) var(--adv-space-md);
  color: var(--adv-text-secondary);
}

.empty-state__icon {
  font-size: 48px;
  color: var(--adv-text-tertiary);
  margin-bottom: var(--adv-space-md);
}

.empty-state h3 {
  font-size: var(--adv-font-subtitle);
  color: var(--adv-text-primary);
  margin: 0 0 var(--adv-space-xs);
}

.empty-state p {
  font-size: var(--adv-font-body-sm);
  margin: 0;
}

.loading-state {
  display: flex;
  justify-content: center;
  padding: var(--adv-space-xl);
}
</style>
