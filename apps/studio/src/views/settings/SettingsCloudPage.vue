<script setup lang="ts">
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonPage,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/vue'
import {
  checkmarkCircleOutline,
  closeCircleOutline,
  cloudOutline,
  lockClosedOutline,
  serverOutline,
  shieldCheckmarkOutline,
} from 'ionicons/icons'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCloudbaseApp } from '../../composables/useCloudbase'
import { useAuthStore } from '../../stores/useAuthStore'

const { t } = useI18n()
const cloudApp = useCloudbaseApp()
const authStore = useAuthStore()
const isTesting = ref(false)
const testResult = ref<'idle' | 'success' | 'failed'>('idle')
const testError = ref('')
const isLoggedIn = computed(() => authStore.isLoggedIn)

async function handleTestConnection() {
  if (!isLoggedIn.value)
    return
  isTesting.value = true
  testResult.value = 'idle'
  testError.value = ''
  try {
    const response = await cloudApp.callFunction({
      name: 'advjsAssets',
      data: { action: 'health' },
    })
    const result = response.result as { ok?: boolean, error?: string } | undefined
    if (!result?.ok)
      throw new Error(result?.error || 'Managed storage is unavailable')
    testResult.value = 'success'
  }
  catch (error) {
    testResult.value = 'failed'
    testError.value = error instanceof Error ? error.message : String(error)
  }
  finally {
    isTesting.value = false
  }
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
        <IonTitle>{{ t('settings.cloudSync') }}</IonTitle>
      </IonToolbar>
    </IonHeader>

    <IonContent :fullscreen="true">
      <IonHeader collapse="condense">
        <IonToolbar>
          <IonTitle size="large">
            {{ t('settings.cloudSync') }}
          </IonTitle>
        </IonToolbar>
      </IonHeader>

      <div class="page-container">
        <div class="hero-banner">
          <div class="hero-banner__icon">
            <IonIcon :icon="cloudOutline" />
          </div>
          <div>
            <h2>{{ t('settings.managedAssetsTitle') }}</h2>
            <p>{{ t('settings.managedAssetsDesc') }}</p>
          </div>
        </div>

        <section class="section-card">
          <div class="section-card__header">
            <div class="section-card__icon">
              <IonIcon :icon="serverOutline" />
            </div>
            <div>
              <h3>{{ t('settings.managedCosTitle') }}</h3>
              <p>{{ t('settings.managedCosRegion') }}</p>
            </div>
          </div>

          <ul class="security-list">
            <li>
              <IonIcon :icon="lockClosedOutline" />
              <span>{{ t('settings.managedCosPrivate') }}</span>
            </li>
            <li>
              <IonIcon :icon="shieldCheckmarkOutline" />
              <span>{{ t('settings.managedCosSigned') }}</span>
            </li>
            <li>
              <IonIcon :icon="checkmarkCircleOutline" />
              <span>{{ t('settings.managedCosVerified') }}</span>
            </li>
          </ul>

          <p v-if="!isLoggedIn" class="notice">
            {{ t('settings.managedCosLogin') }}
          </p>

          <button
            type="button"
            class="test-btn"
            :class="{
              'test-btn--success': testResult === 'success',
              'test-btn--failed': testResult === 'failed',
            }"
            :disabled="isTesting || !isLoggedIn"
            @click="handleTestConnection"
          >
            <IonSpinner v-if="isTesting" name="crescent" />
            <IonIcon v-else-if="testResult === 'success'" :icon="checkmarkCircleOutline" />
            <IonIcon v-else-if="testResult === 'failed'" :icon="closeCircleOutline" />
            <IonIcon v-else :icon="shieldCheckmarkOutline" />
            <span>{{ isTesting ? t('settings.testing') : t('settings.testManagedStorage') }}</span>
          </button>

          <p v-if="testResult === 'success'" class="result result--success">
            {{ t('settings.managedCosReady') }}
          </p>
          <p v-else-if="testResult === 'failed'" class="result result--failed">
            {{ testError }}
          </p>
        </section>

        <section class="section-card section-card--quiet">
          <h3>{{ t('settings.localFirstTitle') }}</h3>
          <p>{{ t('settings.localFirstDesc') }}</p>
          <p>{{ t('settings.noPermanentKey') }}</p>
        </section>
      </div>
    </IonContent>
  </IonPage>
</template>

<style scoped>
.page-container {
  display: grid;
  gap: var(--adv-space-md);
  max-width: 620px;
  margin: 0 auto;
  padding: var(--adv-space-md);
}

.hero-banner,
.section-card {
  border: 1px solid var(--adv-border-subtle);
  border-radius: var(--adv-radius-lg);
  background: var(--adv-surface-card);
  box-shadow: var(--adv-shadow-subtle);
}

.hero-banner {
  display: flex;
  gap: var(--adv-space-md);
  align-items: center;
  padding: var(--adv-space-lg);
  background: var(--adv-gradient-surface);
}

.hero-banner__icon,
.section-card__icon {
  display: grid;
  flex: 0 0 auto;
  place-items: center;
  color: white;
  background: var(--adv-gradient-primary);
}

.hero-banner__icon {
  width: 48px;
  height: 48px;
  border-radius: var(--adv-radius-md);
  font-size: 24px;
}

.hero-banner h2,
.section-card h3 {
  margin: 0;
  color: var(--adv-text-primary);
  font-size: var(--adv-font-body);
}

.hero-banner p,
.section-card p {
  margin: 4px 0 0;
  color: var(--adv-text-secondary);
  font-size: var(--adv-font-body-sm);
  line-height: 1.6;
}

.section-card {
  display: grid;
  gap: var(--adv-space-md);
  padding: var(--adv-space-lg);
}

.section-card--quiet {
  box-shadow: none;
}

.section-card__header {
  display: flex;
  gap: var(--adv-space-sm);
  align-items: center;
}

.section-card__icon {
  width: 38px;
  height: 38px;
  border-radius: var(--adv-radius-sm);
}

.security-list {
  display: grid;
  gap: var(--adv-space-sm);
  margin: 0;
  padding: 0;
  list-style: none;
}

.security-list li {
  display: flex;
  gap: var(--adv-space-sm);
  align-items: center;
  color: var(--adv-text-secondary);
  font-size: var(--adv-font-body-sm);
}

.security-list ion-icon {
  color: var(--ion-color-success);
  font-size: 18px;
}

.test-btn {
  display: flex;
  gap: var(--adv-space-sm);
  align-items: center;
  justify-content: center;
  min-height: 44px;
  border: 1px solid var(--ion-color-primary);
  border-radius: var(--adv-radius-md);
  color: var(--ion-color-primary);
  background: transparent;
  font-weight: 600;
  cursor: pointer;
}

.test-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.test-btn--success {
  color: var(--ion-color-success);
  border-color: var(--ion-color-success);
}

.test-btn--failed,
.result--failed {
  color: var(--ion-color-danger);
  border-color: var(--ion-color-danger);
}

.result--success {
  color: var(--ion-color-success) !important;
}

.notice {
  padding: var(--adv-space-sm);
  border-radius: var(--adv-radius-sm);
  background: color-mix(in srgb, var(--ion-color-warning) 10%, transparent);
}
</style>
