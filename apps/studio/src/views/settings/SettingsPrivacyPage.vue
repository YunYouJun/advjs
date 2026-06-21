<script setup lang="ts">
import {
  alertController,
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToggle,
  IonToolbar,
  toastController,
} from '@ionic/vue'
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { flush as flushTelemetry, getOptIn, setOptIn } from '../../utils/telemetry'

const { t } = useI18n()

/**
 * Privacy preferences page.
 *
 * Replaces the legacy first-launch opt-in alert (`TelemetryOptInPrompt.vue`).
 * Defaults to OFF; users can enable anonymous telemetry here at any time and
 * the choice is persisted in `localStorage` (`advjs-studio:telemetry-opt-in`).
 */

const telemetryEnabled = ref(false)

onMounted(() => {
  telemetryEnabled.value = getOptIn() === 'allow'
})

function onTelemetryChange(event: CustomEvent) {
  const checked = (event.detail as { checked: boolean }).checked
  telemetryEnabled.value = checked
  setOptIn(checked ? 'allow' : 'deny')
  // Best-effort flush so a user who just enabled telemetry doesn't accumulate
  // events forever on a stale queue.
  if (checked)
    void flushTelemetry()
}

async function clearTelemetryQueue() {
  const alert = await alertController.create({
    header: t('settings.privacy.clearQueueTitle'),
    message: t('settings.privacy.clearQueueMessage'),
    buttons: [
      { text: t('common.cancel'), role: 'cancel' },
      {
        text: t('common.clear'),
        role: 'destructive',
        handler: async () => {
          try {
            localStorage.removeItem('advjs-studio:telemetry-queue')
          }
          catch { /* private mode */ }
          const toast = await toastController.create({
            message: t('settings.privacy.clearQueueDone'),
            duration: 1500,
            position: 'top',
          })
          await toast.present()
        },
      },
    ],
  })
  await alert.present()
}
</script>

<template>
  <IonPage>
    <IonHeader>
      <IonToolbar>
        <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
        <IonButtons slot="start">
          <IonBackButton :text="t('common.back')" default-href="/tabs/me/settings" />
        </IonButtons>
        <IonTitle>{{ t('settings.privacy.title') }}</IonTitle>
      </IonToolbar>
    </IonHeader>
    <IonContent :fullscreen="true">
      <IonHeader collapse="condense">
        <IonToolbar>
          <IonTitle size="large">
            {{ t('settings.privacy.title') }}
          </IonTitle>
        </IonToolbar>
      </IonHeader>

      <div class="page-container">
        <!-- Anonymous telemetry toggle -->
        <section class="card">
          <header class="card__header">
            <h3 class="card__title">
              {{ t('settings.privacy.telemetryTitle') }}
            </h3>
            <p class="card__desc">
              {{ t('settings.privacy.telemetryDesc') }}
            </p>
          </header>
          <div class="card__row">
            <span class="card__row-label">{{ t('settings.privacy.telemetryEnable') }}</span>
            <IonToggle
              :checked="telemetryEnabled"
              @ion-change="onTelemetryChange"
            />
          </div>
        </section>

        <!-- What's collected -->
        <section class="card">
          <header class="card__header">
            <h3 class="card__title">
              {{ t('settings.privacy.collectedTitle') }}
            </h3>
            <p class="card__desc">
              {{ t('settings.privacy.collectedDesc') }}
            </p>
          </header>
          <ul class="bullets">
            <li>{{ t('settings.privacy.collected1') }}</li>
            <li>{{ t('settings.privacy.collected2') }}</li>
            <li>{{ t('settings.privacy.collected3') }}</li>
          </ul>
          <ul class="bullets bullets--negative">
            <li>{{ t('settings.privacy.notCollected1') }}</li>
            <li>{{ t('settings.privacy.notCollected2') }}</li>
            <li>{{ t('settings.privacy.notCollected3') }}</li>
          </ul>
        </section>

        <!-- Local storage explainer -->
        <section class="card">
          <header class="card__header">
            <h3 class="card__title">
              {{ t('settings.privacy.localStorageTitle') }}
            </h3>
            <p class="card__desc">
              {{ t('settings.privacy.localStorageDesc') }}
            </p>
          </header>
        </section>

        <!-- Danger zone: clear telemetry queue -->
        <section class="card card--danger">
          <header class="card__header">
            <h3 class="card__title">
              {{ t('settings.privacy.clearQueueTitle') }}
            </h3>
            <p class="card__desc">
              {{ t('settings.privacy.clearQueueDesc') }}
            </p>
          </header>
          <div class="card__row">
            <button class="danger-btn" type="button" @click="clearTelemetryQueue">
              {{ t('common.clear') }}
            </button>
          </div>
        </section>

        <!-- External links -->
        <p class="footer-text">
          <a
            href="https://advjs.org/privacy"
            target="_blank"
            rel="noopener noreferrer"
          >
            {{ t('settings.privacy.policyLink') }}
          </a>
        </p>
      </div>
    </IonContent>
  </IonPage>
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

.card {
  border-radius: var(--adv-radius-lg);
  background: var(--adv-surface-card);
  border: 1px solid var(--adv-border-subtle);
  box-shadow: var(--adv-shadow-subtle);
  padding: var(--adv-space-lg);
  display: flex;
  flex-direction: column;
  gap: var(--adv-space-sm);
}

.card--danger {
  border-color: rgba(239, 68, 68, 0.25);
}

.card__header {
  display: flex;
  flex-direction: column;
  gap: var(--adv-space-xs);
}

.card__title {
  font-size: var(--adv-font-body);
  font-weight: 700;
  color: var(--adv-text-primary);
  margin: 0;
}

.card__desc {
  font-size: var(--adv-font-body-sm);
  color: var(--adv-text-tertiary);
  line-height: 1.5;
  margin: 0;
}

.card__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--adv-space-md);
  min-height: 32px;
}

.card__row-label {
  font-size: var(--adv-font-body);
  color: var(--adv-text-primary);
  font-weight: 500;
}

.bullets {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.bullets li {
  position: relative;
  padding-left: 18px;
  font-size: var(--adv-font-body-sm);
  color: var(--adv-text-secondary);
  line-height: 1.5;
}

.bullets li::before {
  content: '✓';
  position: absolute;
  left: 0;
  top: 0;
  color: var(--adv-success);
  font-weight: 700;
}

.bullets--negative li::before {
  content: '✕';
  color: var(--ion-color-danger);
}

.danger-btn {
  border: 1.5px solid rgba(239, 68, 68, 0.25);
  background: transparent;
  color: var(--ion-color-danger);
  font-size: var(--adv-font-body-sm);
  font-weight: 600;
  padding: 8px 16px;
  border-radius: var(--adv-radius-md);
  cursor: pointer;
  transition: background var(--adv-duration-fast) var(--adv-ease-default);
  -webkit-tap-highlight-color: transparent;
}

.danger-btn:hover {
  background: rgba(239, 68, 68, 0.06);
}

.footer-text {
  text-align: center;
  font-size: var(--adv-font-caption);
  color: var(--adv-text-tertiary);
  margin: 0;
  padding: var(--adv-space-sm) 0;
}

.footer-text a {
  color: var(--ion-color-primary);
  text-decoration: none;
}

.footer-text a:hover {
  text-decoration: underline;
}
</style>
