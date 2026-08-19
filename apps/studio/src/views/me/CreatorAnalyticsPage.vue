<!--
  Creator Analytics dashboard page.

  Route: `/tabs/me/analytics`

  Displays per-creator marketplace statistics:
  - Summary cards (total projects, downloads, reviews, avg rating)
  - Per-project table with download count, rating, last updated
-->
<script setup lang="ts">
import {
  IonIcon,
  IonSpinner,
} from '@ionic/vue'
import {
  analyticsOutline,
  cloudDownloadOutline,
  starOutline,
  storefrontOutline,
} from 'ionicons/icons'
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import LayoutPage from '../../components/common/LayoutPage.vue'
import { useCreatorAnalytics } from '../../composables/useCreatorAnalytics'
import { useAuthStore } from '../../stores/useAuthStore'

const { t } = useI18n()
const authStore = useAuthStore()
const { stats, isLoading, loadStats } = useCreatorAnalytics()

let cloudApp: any = null
try {
  const { useCloudbase } = await import('../../composables/useCloudbase')
  cloudApp = useCloudbase().app
}
catch {
  // CloudBase not configured
}

onMounted(async () => {
  const uid = authStore.userId
  if (cloudApp && uid)
    await loadStats(cloudApp, uid)
})

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString()
}

function formatRating(ratingSum: number, ratingCount: number): string {
  if (!ratingCount)
    return '—'
  return (ratingSum / ratingCount).toFixed(1)
}
</script>

<template>
  <LayoutPage :title="t('analytics.title')" show-back-button default-href="/tabs/me">
    <!-- Loading -->
    <div v-if="isLoading" class="analytics-loading">
      <IonSpinner name="crescent" />
    </div>

    <!-- No data -->
    <div v-else-if="!stats || stats.totalProjects === 0" class="analytics-empty">
      <IonIcon :icon="storefrontOutline" class="analytics-empty__icon" />
      <p>{{ t('analytics.noData') }}</p>
    </div>

    <!-- Dashboard -->
    <div v-else class="analytics-dashboard">
      <!-- Summary cards -->
      <div class="analytics-summary">
        <div class="analytics-card">
          <IonIcon :icon="storefrontOutline" class="analytics-card__icon" />
          <div class="analytics-card__value">
            {{ stats.totalProjects }}
          </div>
          <div class="analytics-card__label">
            Projects
          </div>
        </div>
        <div class="analytics-card">
          <IonIcon :icon="cloudDownloadOutline" class="analytics-card__icon" />
          <div class="analytics-card__value">
            {{ stats.totalDownloads.toLocaleString() }}
          </div>
          <div class="analytics-card__label">
            {{ t('analytics.totalDownloads') }}
          </div>
        </div>
        <div class="analytics-card">
          <IonIcon :icon="analyticsOutline" class="analytics-card__icon" />
          <div class="analytics-card__value">
            {{ stats.totalReviews }}
          </div>
          <div class="analytics-card__label">
            {{ t('analytics.totalReviews') }}
          </div>
        </div>
        <div class="analytics-card">
          <IonIcon :icon="starOutline" class="analytics-card__icon" />
          <div class="analytics-card__value">
            {{ stats.averageRating > 0 ? stats.averageRating.toFixed(1) : '—' }}
          </div>
          <div class="analytics-card__label">
            {{ t('analytics.averageRating') }}
          </div>
        </div>
      </div>

      <!-- Per-project table -->
      <div class="analytics-table-wrapper">
        <table class="analytics-table">
          <thead>
            <tr>
              <th>{{ t('analytics.projectName') }}</th>
              <th>{{ t('analytics.downloads') }}</th>
              <th>{{ t('analytics.rating') }}</th>
              <th>{{ t('analytics.lastUpdated') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="project in stats.projects" :key="project._id">
              <td class="analytics-table__name">
                {{ project.name }}
              </td>
              <td>{{ project.downloads.toLocaleString() }}</td>
              <td>⭐ {{ formatRating(project.ratingSum, project.ratingCount) }}</td>
              <td>{{ formatDate(project.updatedAt) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </LayoutPage>
</template>

<style scoped>
.analytics-loading {
  display: flex;
  justify-content: center;
  padding: 48px;
}

.analytics-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 48px 24px;
  gap: 12px;
  color: var(--adv-text-tertiary, #94a3b8);
}

.analytics-empty__icon {
  font-size: var(--adv-font-display-xl);
  opacity: 0.3;
}

.analytics-dashboard {
  padding: var(--adv-space-md, 16px);
  display: flex;
  flex-direction: column;
  gap: var(--adv-space-lg, 24px);
  max-width: 800px;
  margin: 0 auto;
}

.analytics-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: var(--adv-space-md, 12px);
}

.analytics-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: var(--adv-space-md, 16px);
  border-radius: var(--adv-radius-lg, 12px);
  background: var(--adv-surface-card, var(--ion-background-color));
  border: 1px solid var(--adv-border-subtle, rgba(120, 120, 120, 0.1));
}

.analytics-card__icon {
  font-size: var(--adv-font-lg);
  color: var(--ion-color-primary);
  opacity: 0.7;
}

.analytics-card__value {
  font-size: var(--adv-font-display);
  font-weight: 800;
  color: var(--adv-text-primary, #1a1a2e);
}

.analytics-card__label {
  font-size: var(--adv-font-body-sm);
  color: var(--adv-text-tertiary, #94a3b8);
  text-align: center;
}

.analytics-table-wrapper {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.analytics-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--adv-font-body-sm);
}

.analytics-table th {
  text-align: left;
  padding: 10px 12px;
  border-bottom: 2px solid var(--adv-border-subtle, rgba(120, 120, 120, 0.15));
  color: var(--adv-text-tertiary, #94a3b8);
  font-size: var(--adv-font-body-sm);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.analytics-table td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--adv-border-subtle, rgba(120, 120, 120, 0.08));
  color: var(--adv-text-primary, #1a1a2e);
}

.analytics-table__name {
  font-weight: 600;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.analytics-table tbody tr:hover {
  background: color-mix(in srgb, var(--ion-color-primary) 5%, transparent);
}
</style>
