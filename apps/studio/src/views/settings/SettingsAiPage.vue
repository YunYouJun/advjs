<script setup lang="ts">
import { IonIcon, IonSpinner } from '@ionic/vue'
import { checkmarkCircleOutline, cloudOfflineOutline, informationCircleOutline, lockClosedOutline, refreshOutline, serverOutline, walletOutline } from 'ionicons/icons'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import LayoutPage from '../../components/common/LayoutPage.vue'
import SButton from '../../components/ui/SButton.vue'
import { useAuthStore } from '../../stores/useAuthStore'
import { useManagedAgentStore } from '../../stores/useManagedAgentStore'

const { t, locale } = useI18n()
const authStore = useAuthStore()
const managedStore = useManagedAgentStore()
const { points, status, hasActiveTask, isConfigured, isRefreshing, error } = storeToRefs(managedStore)

const serviceTone = computed(() => {
  if (!authStore.isLoggedIn || !isConfigured.value)
    return 'offline'
  return error.value ? 'warning' : 'online'
})

function formatPoints(microPoints: number): string {
  return new Intl.NumberFormat(locale.value, { maximumFractionDigits: 3 }).format(microPoints / 1_000)
}
</script>

<template>
  <LayoutPage :title="t('managedAiSettings.title')" show-back-button default-href="/tabs/me/settings">
    <main class="managed-settings">
      <section class="managed-settings__hero">
        <p>{{ t('managedAiSettings.eyebrow') }}</p>
        <h1>{{ t('managedAiSettings.heading') }}</h1>
        <span>{{ t('managedAiSettings.intro') }}</span>
      </section>

      <section class="managed-settings__status" :data-tone="serviceTone">
        <IonIcon :icon="serviceTone === 'online' ? checkmarkCircleOutline : cloudOfflineOutline" aria-hidden="true" />
        <div>
          <strong>{{ t(`managedAiSettings.status.${serviceTone}`) }}</strong>
          <span>{{ status ? t(`managedAi.status.${status}`) : t('managedAiSettings.statusDetail') }}</span>
        </div>
        <SButton size="sm" variant="outline" :loading="isRefreshing" :disabled="!isConfigured" @click="managedStore.refreshPoints()">
          <IonIcon :icon="refreshOutline" aria-hidden="true" />
          {{ t('managedAiSettings.refresh') }}
        </SButton>
      </section>

      <section class="managed-settings__grid" :aria-label="t('managedAiSettings.pointsTitle')">
        <article>
          <IonIcon :icon="walletOutline" aria-hidden="true" />
          <span>{{ t('managedAi.available') }}</span>
          <strong>{{ formatPoints(points?.availableMicroPoints ?? 0) }}</strong>
        </article>
        <article>
          <IonIcon :icon="serverOutline" aria-hidden="true" />
          <span>{{ t('managedAi.reserved') }}</span>
          <strong>{{ formatPoints(points?.reservedMicroPoints ?? 0) }}</strong>
        </article>
      </section>

      <section class="managed-settings__card">
        <div class="managed-settings__card-heading">
          <IonIcon :icon="informationCircleOutline" aria-hidden="true" />
          <div>
            <h2>{{ t('managedAiSettings.quotaTitle') }}</h2>
            <p>{{ t('managedAiSettings.quotaBody') }}</p>
          </div>
        </div>
        <dl>
          <div><dt>{{ t('managedAiSettings.concurrency') }}</dt><dd>{{ t('managedAiSettings.oneTask') }}</dd></div>
          <div><dt>{{ t('managedAiSettings.currentTask') }}</dt><dd>{{ hasActiveTask ? t('managedAiSettings.active') : t('managedAiSettings.none') }}</dd></div>
          <div><dt>{{ t('managedAiSettings.billing') }}</dt><dd>{{ t('managedAiSettings.actualUsage') }}</dd></div>
        </dl>
      </section>

      <section class="managed-settings__card">
        <div class="managed-settings__card-heading">
          <IonIcon :icon="lockClosedOutline" aria-hidden="true" />
          <div>
            <h2>{{ t('managedAiSettings.privacyTitle') }}</h2>
            <p>{{ t('managedAiSettings.privacyBody') }}</p>
          </div>
        </div>
        <ul>
          <li>{{ t('managedAiSettings.privacyContext') }}</li>
          <li>{{ t('managedAiSettings.privacyKeys') }}</li>
          <li>{{ t('managedAiSettings.privacyApply') }}</li>
        </ul>
      </section>

      <div v-if="isRefreshing" class="managed-settings__live" role="status">
        <IonSpinner name="crescent" />{{ t('managedAi.recovering') }}
      </div>
    </main>
  </LayoutPage>
</template>

<style scoped>
.managed-settings {
  --managed-ink: #17131f;
  --managed-purple: #7c3aed;
  --managed-gold: #d4a853;
  display: grid;
  gap: 14px;
  width: min(720px, 100%);
  margin: 0 auto;
  padding: 18px 16px 40px;
}

.managed-settings__hero {
  padding: 22px;
  color: #f7f5fb;
  border-radius: 12px;
  background: var(--managed-ink);
}

.managed-settings__hero p {
  margin: 0 0 6px;
  color: var(--managed-gold);
  font-family: var(--adv-font-mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.14em;
}

.managed-settings__hero h1 {
  margin: 0 0 8px;
  font-size: clamp(24px, 4vw, 34px);
}

.managed-settings__hero span {
  color: rgba(247, 245, 251, 0.72);
  line-height: 1.6;
}

.managed-settings__status {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 12px;
  align-items: center;
  min-height: 72px;
  padding: 14px 16px;
  border: 1px solid var(--adv-border-subtle);
  border-left: 4px solid var(--managed-purple);
  border-radius: 8px;
  background: var(--adv-surface-card);
}

.managed-settings__status[data-tone='offline'] {
  border-left-color: var(--adv-text-tertiary);
}
.managed-settings__status[data-tone='warning'] {
  border-left-color: #df5b63;
}
.managed-settings__status > ion-icon {
  font-size: 24px;
}
.managed-settings__status div,
.managed-settings__card-heading div {
  display: grid;
  gap: 3px;
}
.managed-settings__status span,
.managed-settings__card p {
  margin: 0;
  color: var(--adv-text-secondary);
  font-size: var(--adv-font-body-sm);
  line-height: 1.6;
}

.managed-settings__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.managed-settings__grid article {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 5px 9px;
  padding: 18px;
  border: 1px solid var(--adv-border-subtle);
  border-radius: 8px;
  background: var(--adv-surface-card);
}
.managed-settings__grid ion-icon {
  grid-row: span 2;
  color: var(--managed-purple);
  font-size: 22px;
}
.managed-settings__grid span {
  color: var(--adv-text-secondary);
  font-size: var(--adv-font-caption);
}
.managed-settings__grid strong {
  font-family: var(--adv-font-mono);
  font-size: 24px;
}

.managed-settings__card {
  padding: 18px;
  border: 1px solid var(--adv-border-subtle);
  border-radius: 8px;
  background: var(--adv-surface-card);
}
.managed-settings__card-heading {
  display: flex;
  gap: 11px;
  align-items: flex-start;
}
.managed-settings__card-heading > ion-icon {
  flex: 0 0 auto;
  color: var(--managed-purple);
  font-size: 23px;
}
.managed-settings__card h2 {
  margin: 0;
  font-size: 17px;
}
.managed-settings__card dl {
  display: grid;
  gap: 9px;
  margin: 16px 0 0;
}
.managed-settings__card dl div {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding-top: 9px;
  border-top: 1px solid var(--adv-border-subtle);
}
.managed-settings__card dt {
  color: var(--adv-text-secondary);
}
.managed-settings__card dd {
  margin: 0;
  font-weight: 650;
  text-align: right;
}
.managed-settings__card ul {
  display: grid;
  gap: 8px;
  margin: 16px 0 0;
  padding-left: 22px;
  color: var(--adv-text-secondary);
  line-height: 1.5;
}
.managed-settings__live {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: center;
  color: var(--adv-text-secondary);
}
.managed-settings__live ion-spinner {
  width: 18px;
  height: 18px;
}

@media (max-width: 560px) {
  .managed-settings__grid {
    grid-template-columns: 1fr;
  }
  .managed-settings__status {
    grid-template-columns: auto 1fr;
  }
  .managed-settings__status > :last-child {
    grid-column: 1 / -1;
  }
}
</style>
