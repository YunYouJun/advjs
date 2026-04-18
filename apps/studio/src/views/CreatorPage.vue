<script setup lang="ts">
import type { MarketplaceRecord } from '../composables/useMarketplace'
import {
  IonBackButton,
  IonButtons,
  IonHeader,
  IonIcon,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/vue'
import {
  bookOutline,
  downloadOutline,
  peopleOutline,
  starOutline,
} from 'ionicons/icons'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import LayoutPage from '../components/common/LayoutPage.vue'
import { useCloudbase } from '../composables/useCloudbase'
import { useMarketplace } from '../composables/useMarketplace'

const { t } = useI18n()
const route = useRoute()
const { fetchCreatorProjects } = useMarketplace()

let cloudApp: ReturnType<typeof useCloudbase>['app'] | null = null
try {
  cloudApp = useCloudbase().app
}
catch {
  // CloudBase not configured
}

const creatorId = computed(() => route.params.uid as string)
const projects = ref<MarketplaceRecord[]>([])
const isLoading = ref(false)

const creatorName = computed(() => {
  return projects.value[0]?.authorName || t('marketplace.unknownCreator')
})

const totalStats = computed(() => {
  let downloads = 0
  let characters = 0
  let ratingSum = 0
  let ratingCount = 0
  for (const p of projects.value) {
    downloads += p.downloads
    characters += p.stats.characters
    ratingSum += p.ratingSum
    ratingCount += p.ratingCount
  }
  return {
    works: projects.value.length,
    downloads,
    characters,
    avgRating: ratingCount ? (ratingSum / ratingCount).toFixed(1) : '—',
  }
})

onMounted(async () => {
  if (!cloudApp || !creatorId.value)
    return
  isLoading.value = true
  try {
    projects.value = await fetchCreatorProjects(cloudApp, creatorId.value)
  }
  finally {
    isLoading.value = false
  }
})

function formatDownloads(n: number): string {
  if (n >= 1000)
    return `${(n / 1000).toFixed(1)}k`
  return String(n)
}
</script>

<template>
  <LayoutPage :title="creatorName">
    <IonHeader collapse="condense">
      <IonToolbar>
        <IonButtons slot="start">
          <IonBackButton default-href="/tabs/workspace/marketplace" />
        </IonButtons>
        <IonTitle size="large">
          {{ creatorName }}
        </IonTitle>
      </IonToolbar>
    </IonHeader>

    <div class="page-container">
      <!-- Stats -->
      <div class="creator-stats">
        <div class="creator-stat">
          <IonIcon :icon="bookOutline" />
          <strong>{{ totalStats.works }}</strong>
          <span>{{ t('marketplace.creatorWorks') }}</span>
        </div>
        <div class="creator-stat">
          <IonIcon :icon="downloadOutline" />
          <strong>{{ formatDownloads(totalStats.downloads) }}</strong>
          <span>{{ t('marketplace.downloads') }}</span>
        </div>
        <div class="creator-stat">
          <IonIcon :icon="peopleOutline" />
          <strong>{{ totalStats.characters }}</strong>
          <span>{{ t('portfolio.totalCharacters') }}</span>
        </div>
        <div class="creator-stat">
          <IonIcon :icon="starOutline" />
          <strong>{{ totalStats.avgRating }}</strong>
          <span>{{ t('marketplace.rating') }}</span>
        </div>
      </div>

      <div v-if="isLoading" class="loading-state">
        <IonSpinner name="crescent" />
      </div>

      <!-- Works list -->
      <div v-else-if="projects.length > 0" class="works-list">
        <div v-for="p in projects" :key="p._id" class="work-card">
          <div class="work-card__cover">
            <img v-if="p.cover" :src="p.cover" alt="">
            <span v-else>{{ p.name.charAt(0) }}</span>
          </div>
          <div class="work-card__info">
            <span class="work-card__name">{{ p.name }}</span>
            <span class="work-card__desc">{{ p.description || t('portfolio.noDescription') }}</span>
            <span class="work-card__meta">
              👥 {{ p.stats.characters }} · 📖 {{ p.stats.chapters }} · ⬇️ {{ formatDownloads(p.downloads) }}
            </span>
          </div>
        </div>
      </div>

      <div v-else class="empty-state">
        <p>{{ t('marketplace.noCreatorWorks') }}</p>
      </div>
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

.creator-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--adv-space-xs);
}

.creator-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: var(--adv-space-sm);
  border-radius: var(--adv-radius-md);
  background: var(--adv-surface-card);
  border: 1px solid var(--adv-border-subtle);
}

.creator-stat ion-icon {
  font-size: 18px;
  color: var(--adv-text-tertiary);
}
.creator-stat strong {
  font-size: var(--adv-font-body);
  font-weight: 700;
}
.creator-stat span {
  font-size: 10px;
  color: var(--adv-text-tertiary);
  text-align: center;
}

.works-list {
  display: flex;
  flex-direction: column;
  gap: var(--adv-space-sm);
}

.work-card {
  display: flex;
  align-items: center;
  gap: var(--adv-space-md);
  padding: var(--adv-space-md);
  border-radius: var(--adv-radius-md);
  background: var(--adv-surface-card);
  border: 1px solid var(--adv-border-subtle);
}

.work-card__cover {
  width: 56px;
  height: 56px;
  border-radius: var(--adv-radius-sm);
  overflow: hidden;
  flex-shrink: 0;
  background: var(--adv-surface-elevated);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  font-weight: 700;
  color: var(--adv-text-tertiary);
  opacity: 0.3;
}

.work-card__cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.work-card__info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.work-card__name {
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.work-card__desc {
  font-size: var(--adv-font-body-sm);
  color: var(--adv-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.work-card__meta {
  font-size: 11px;
  color: var(--adv-text-tertiary);
}

.loading-state {
  display: flex;
  justify-content: center;
  padding: var(--adv-space-xl);
}
.empty-state {
  text-align: center;
  color: var(--adv-text-tertiary);
  padding: var(--adv-space-xl);
}
</style>
