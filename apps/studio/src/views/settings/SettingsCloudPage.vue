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
  folderOutline,
  lockClosedOutline,
  refreshOutline,
  serverOutline,
  shieldCheckmarkOutline,
  timeOutline,
} from 'ionicons/icons'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCloudSync } from '../../composables/useCloudSync'
import { useAuthStore } from '../../stores/useAuthStore'
import { useSettingsStore } from '../../stores/useSettingsStore'
import { testConnection } from '../../utils/cloudSync'

const { t } = useI18n()
const settingsStore = useSettingsStore()
const authStore = useAuthStore()
const { lastSyncTime } = useCloudSync()

const isTesting = ref(false)
const testResult = ref<'idle' | 'success' | 'failed'>('idle')
const testError = ref('')
const isManagedStorageReady = computed(() => authStore.isLoggedIn
  && !!settingsStore.cos.bucket
  && !!settingsStore.cos.region)

async function handleTestConnection() {
  const { bucket, region } = settingsStore.cos
  if (!isManagedStorageReady.value)
    return

  isTesting.value = true
  testResult.value = 'idle'
  testError.value = ''

  try {
    await testConnection({ bucket, region })
    testResult.value = 'success'
  }
  catch (err) {
    testResult.value = 'failed'
    testError.value = err instanceof Error ? err.message : 'Unknown error'
  }
  finally {
    isTesting.value = false
  }
}

function formatSyncTime(): string {
  if (!lastSyncTime.value)
    return t('settings.neverSynced')
  return lastSyncTime.value.toLocaleTimeString()
}

const syncIntervalOptions = [5, 10, 15, 30]
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
        <!-- Hero Banner -->
        <div class="hero-banner">
          <div class="hero-banner__icon">
            <IonIcon :icon="cloudOutline" />
          </div>
          <p class="hero-banner__desc">
            {{ t('settings.cloudSyncDesc') }}
          </p>
        </div>

        <!-- Managed Storage Card -->
        <div class="section-card">
          <div class="section-card__header">
            <div class="section-card__icon section-card__icon--key">
              <IonIcon :icon="lockClosedOutline" />
            </div>
            <div class="section-card__header-text">
              <h3 class="section-card__title">
                {{ t('settings.managedStorage') }}
              </h3>
              <p class="section-card__subtitle">
                {{ isManagedStorageReady ? t('settings.managedStorageReady') : t('settings.managedStorageLogin') }}
              </p>
            </div>
          </div>

          <div class="form-group">
            <div class="input-field">
              <label class="input-field__label">
                <IonIcon :icon="serverOutline" class="input-field__label-icon" />
                {{ t('settings.bucket') }}
              </label>
              <div class="managed-value">
                {{ settingsStore.cos.bucket }}
              </div>
            </div>

            <div class="input-field">
              <label class="input-field__label">
                <IonIcon :icon="serverOutline" class="input-field__label-icon" />
                {{ t('settings.region') }}
              </label>
              <div class="managed-value">
                {{ settingsStore.cos.region }} · Shanghai
              </div>
            </div>

            <div class="input-field">
              <label class="input-field__label">
                <IonIcon :icon="folderOutline" class="input-field__label-icon" />
                {{ t('settings.projectRoot') }}
              </label>
              <input
                v-model.trim="settingsStore.cos.projectRoot"
                class="input-field__input"
                type="text"
                placeholder="adv-projects/"
                autocomplete="off"
              >
              <span class="input-field__hint">{{ t('settings.projectRootDesc') }}</span>
            </div>

            <p class="managed-security-note">
              <IonIcon :icon="shieldCheckmarkOutline" />
              {{ t('settings.managedStorageSecurity') }}
            </p>
          </div>

          <!-- Test Connection -->
          <button
            type="button"
            class="test-btn"
            :class="{
              'test-btn--success': testResult === 'success',
              'test-btn--failed': testResult === 'failed',
              'test-btn--loading': isTesting,
            }"
            :disabled="isTesting || !isManagedStorageReady"
            @click="handleTestConnection"
          >
            <IonSpinner v-if="isTesting" name="crescent" class="test-btn__spinner" />
            <IonIcon v-else-if="testResult === 'success'" :icon="checkmarkCircleOutline" />
            <IonIcon v-else-if="testResult === 'failed'" :icon="closeCircleOutline" />
            <IonIcon v-else :icon="shieldCheckmarkOutline" />
            <span>
              {{ isTesting
                ? t('settings.testing')
                : testResult === 'success'
                  ? t('settings.testSuccess')
                  : testResult === 'failed'
                    ? t('settings.testConnection')
                    : t('settings.testConnection')
              }}
            </span>
          </button>

          <p v-if="testResult === 'failed'" class="test-error">
            {{ testError }}
          </p>

          <p v-if="!authStore.isLoggedIn" class="cors-hint">
            <IonIcon :icon="shieldCheckmarkOutline" class="cors-hint__icon" />
            {{ t('settings.managedStorageLogin') }}
          </p>
        </div>

        <!-- Sync Options Card -->
        <div class="section-card">
          <div class="section-card__header">
            <div class="section-card__icon section-card__icon--sync">
              <IonIcon :icon="refreshOutline" />
            </div>
            <h3 class="section-card__title">
              {{ t('settings.syncOptions') }}
            </h3>
          </div>

          <!-- Auto Save Toggle -->
          <label class="toggle-row">
            <div class="toggle-row__text">
              <span class="toggle-row__label">{{ t('settings.autoSave') }}</span>
              <span class="toggle-row__desc">{{ t('settings.autoSaveDesc') }}</span>
            </div>
            <button
              type="button"
              class="toggle-switch"
              :class="{ 'toggle-switch--active': settingsStore.cos.autoSave }"
              role="switch"
              :aria-checked="settingsStore.cos.autoSave"
              @click="settingsStore.cos.autoSave = !settingsStore.cos.autoSave"
            >
              <span class="toggle-switch__thumb" />
            </button>
          </label>

          <!-- Auto Sync Toggle -->
          <label class="toggle-row">
            <div class="toggle-row__text">
              <span class="toggle-row__label">{{ t('settings.autoSync') }}</span>
              <span class="toggle-row__desc">{{ t('settings.autoSyncDesc') }}</span>
            </div>
            <button
              type="button"
              class="toggle-switch"
              :class="{ 'toggle-switch--active': settingsStore.cos.autoSync }"
              role="switch"
              :aria-checked="settingsStore.cos.autoSync"
              @click="settingsStore.cos.autoSync = !settingsStore.cos.autoSync"
            >
              <span class="toggle-switch__thumb" />
            </button>
          </label>

          <!-- Sync Interval Selector -->
          <div class="interval-section">
            <div class="interval-section__label">
              <IonIcon :icon="timeOutline" class="interval-section__icon" />
              <span>{{ t('settings.syncInterval') }}</span>
            </div>
            <div class="interval-chips">
              <button
                v-for="n in syncIntervalOptions"
                :key="n"
                type="button"
                class="interval-chip"
                :class="{ 'interval-chip--active': settingsStore.cos.syncInterval === n }"
                @click="settingsStore.cos.syncInterval = n"
              >
                {{ t('settings.syncIntervalMinutes', { n }) }}
              </button>
            </div>
          </div>

          <!-- Last Sync Time -->
          <div class="sync-time-row">
            <IonIcon :icon="timeOutline" class="sync-time-row__icon" />
            <span class="sync-time-row__text">
              {{ lastSyncTime ? t('settings.lastSync', { time: formatSyncTime() }) : t('settings.neverSynced') }}
            </span>
          </div>
        </div>
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

/* ── Hero Banner ── */
.hero-banner {
  display: flex;
  align-items: center;
  gap: var(--adv-space-md);
  padding: var(--adv-space-md) var(--adv-space-lg);
  border-radius: var(--adv-radius-lg);
  background: var(--adv-gradient-surface);
  border: 1px solid rgba(99, 102, 241, 0.12);
}

.hero-banner__icon {
  width: 44px;
  height: 44px;
  border-radius: var(--adv-radius-md);
  background: var(--adv-gradient-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: #fff;
  font-size: var(--adv-font-lg);
  box-shadow: var(--adv-shadow-glow);
}

.hero-banner__desc {
  font-size: var(--adv-font-body-sm);
  color: var(--adv-text-secondary);
  margin: 0;
  line-height: 1.4;
}

/* ── Collapsible Guide ── */
.guide-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: var(--adv-space-sm) var(--adv-space-md);
  border-radius: var(--adv-radius-md);
  border: 1px dashed var(--adv-border-subtle);
  background: transparent;
  cursor: pointer;
  color: var(--ion-color-primary);
  font-size: var(--adv-font-body-sm);
  font-weight: 500;
  transition: background var(--adv-duration-fast) var(--adv-ease-default);
  -webkit-tap-highlight-color: transparent;
}

.guide-toggle:hover {
  background: var(--adv-gradient-surface);
}

.guide-toggle__label {
  display: flex;
  align-items: center;
  gap: var(--adv-space-xs);
}

.guide-panel {
  overflow: hidden;
}

.guide-enter-active,
.guide-leave-active {
  transition:
    max-height var(--adv-duration-normal) var(--adv-ease-default),
    opacity var(--adv-duration-normal) var(--adv-ease-default);
}

.guide-enter-from,
.guide-leave-to {
  max-height: 0;
  opacity: 0;
}

.guide-enter-to,
.guide-leave-from {
  max-height: 500px;
  opacity: 1;
}

.guide-steps {
  list-style: none;
  margin: 0;
  padding: var(--adv-space-sm) 0 0;
  display: flex;
  flex-direction: column;
  gap: var(--adv-space-sm);
}

.guide-step {
  display: flex;
  gap: var(--adv-space-sm);
}

.guide-step__number {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--adv-gradient-primary);
  color: #fff;
  font-size: var(--adv-font-caption);
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 1px;
}

.guide-step__content {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: var(--adv-font-body-sm);
  color: var(--adv-text-secondary);
  line-height: 1.5;
}

.guide-step__content strong {
  color: var(--adv-text-primary);
  font-weight: 600;
}

.guide-link {
  color: var(--ion-color-primary);
  text-decoration: none;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.guide-link:hover {
  text-decoration: underline;
}

.guide-link__icon {
  font-size: var(--adv-font-body-sm);
}

/* ── Section Card ── */
.section-card {
  padding: var(--adv-space-lg);
  border-radius: var(--adv-radius-lg);
  background: var(--adv-surface-card);
  border: 1px solid var(--adv-border-subtle);
  box-shadow: var(--adv-shadow-subtle);
  display: flex;
  flex-direction: column;
  gap: var(--adv-space-md);
}

.section-card__header {
  display: flex;
  align-items: center;
  gap: var(--adv-space-sm);
}

.section-card__header-text {
  display: flex;
  align-items: baseline;
  gap: var(--adv-space-sm);
  flex: 1;
}

.section-card__icon {
  width: 36px;
  height: 36px;
  border-radius: var(--adv-radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: var(--adv-font-subtitle);
}

.section-card__icon--key {
  background: rgba(99, 102, 241, 0.1);
  color: var(--ion-color-primary);
}

.section-card__icon--sync {
  background: rgba(16, 185, 129, 0.1);
  color: var(--adv-success);
}

.section-card__title {
  font-size: var(--adv-font-body);
  font-weight: 600;
  color: var(--adv-text-primary);
  margin: 0;
}

.section-card__subtitle {
  font-size: var(--adv-font-caption);
  color: var(--adv-text-tertiary);
  margin: 0;
  font-weight: 500;
}

/* ── Form Inputs ── */
.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--adv-space-sm);
}

.input-field {
  display: flex;
  flex-direction: column;
  gap: var(--adv-space-xs);
}

.input-field__label {
  display: flex;
  align-items: center;
  gap: var(--adv-space-xs);
  font-size: var(--adv-font-caption);
  font-weight: 600;
  color: var(--adv-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.input-field__label-icon {
  font-size: var(--adv-font-body-sm);
}

.input-field__input {
  width: 100%;
  height: 44px;
  padding: 0 var(--adv-space-md);
  border-radius: var(--adv-radius-md);
  border: 1.5px solid var(--adv-border-subtle);
  background: var(--adv-surface-elevated);
  color: var(--adv-text-primary);
  font-size: var(--adv-font-body);
  font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', ui-monospace, monospace;
  outline: none;
  transition:
    border-color var(--adv-duration-fast) var(--adv-ease-default),
    box-shadow var(--adv-duration-fast) var(--adv-ease-default);
  box-sizing: border-box;
}

.input-field__input::placeholder {
  color: var(--adv-text-tertiary);
  font-family: inherit;
}

.input-field__input:focus {
  border-color: var(--ion-color-primary);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12);
}

.input-field__hint {
  font-size: var(--adv-font-caption);
  color: var(--adv-text-tertiary);
  line-height: 1.3;
}

.managed-value {
  display: flex;
  align-items: center;
  min-height: 44px;
  padding: 0 var(--adv-space-md);
  border: 1px solid var(--adv-border-subtle);
  border-radius: var(--adv-radius-md);
  background: var(--adv-surface-elevated);
  color: var(--adv-text-primary);
  font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', ui-monospace, monospace;
  font-size: var(--adv-font-body-sm);
  overflow-wrap: anywhere;
}

.managed-security-note {
  display: flex;
  align-items: flex-start;
  gap: var(--adv-space-xs);
  margin: var(--adv-space-xs) 0 0;
  color: var(--adv-text-secondary);
  font-size: var(--adv-font-caption);
  line-height: 1.45;
}

.managed-security-note ion-icon {
  flex: 0 0 auto;
  margin-top: 2px;
  color: var(--adv-success);
}

/* ── Test Connection Button ── */
.test-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--adv-space-sm);
  width: 100%;
  height: 44px;
  border-radius: var(--adv-radius-md);
  border: 1.5px solid var(--ion-color-primary);
  background: transparent;
  color: var(--ion-color-primary);
  font-size: var(--adv-font-body);
  font-weight: 600;
  cursor: pointer;
  transition:
    background var(--adv-duration-fast) var(--adv-ease-default),
    border-color var(--adv-duration-fast) var(--adv-ease-default),
    color var(--adv-duration-fast) var(--adv-ease-default),
    transform var(--adv-duration-fast) var(--adv-ease-default);
  -webkit-tap-highlight-color: transparent;
}

.test-btn:not(:disabled):hover {
  background: rgba(99, 102, 241, 0.06);
}

.test-btn:not(:disabled):active {
  transform: scale(0.98);
}

.test-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.test-btn--success {
  border-color: var(--ion-color-success);
  color: var(--ion-color-success);
  background: rgba(16, 185, 129, 0.06);
}

.test-btn--failed {
  border-color: var(--ion-color-danger);
  color: var(--ion-color-danger);
  background: rgba(239, 68, 68, 0.06);
}

.test-btn--loading {
  border-color: var(--adv-text-tertiary);
  color: var(--adv-text-tertiary);
}

.test-btn__spinner {
  width: 18px;
  height: 18px;
}

.test-error {
  margin: 0;
  padding: var(--adv-space-sm) var(--adv-space-md);
  border-radius: var(--adv-radius-sm);
  background: rgba(239, 68, 68, 0.06);
  border: 1px solid rgba(239, 68, 68, 0.15);
  color: var(--ion-color-danger);
  font-size: var(--adv-font-caption);
  line-height: 1.4;
  word-break: break-word;
}

.cors-hint {
  display: flex;
  align-items: center;
  gap: var(--adv-space-xs);
  margin: 0;
  font-size: var(--adv-font-caption);
  color: var(--adv-text-tertiary);
  line-height: 1.4;
}

.cors-hint__icon {
  font-size: var(--adv-font-body-sm);
  flex-shrink: 0;
}

/* ── Toggle Row ── */
.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--adv-space-md);
  padding: var(--adv-space-sm) 0;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.toggle-row + .toggle-row {
  border-top: 1px solid var(--adv-border-subtle);
}

.toggle-row__text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.toggle-row__label {
  font-size: var(--adv-font-body);
  font-weight: 500;
  color: var(--adv-text-primary);
}

.toggle-row__desc {
  font-size: var(--adv-font-caption);
  color: var(--adv-text-tertiary);
  line-height: 1.3;
}

/* ── Toggle Switch (custom) ── */
.toggle-switch {
  position: relative;
  width: 48px;
  height: 28px;
  border-radius: var(--adv-radius-lg);
  border: none;
  background: var(--adv-border-subtle);
  cursor: pointer;
  flex-shrink: 0;
  padding: 2px;
  transition: background var(--adv-duration-fast) var(--adv-ease-default);
  -webkit-tap-highlight-color: transparent;
}

.toggle-switch--active {
  background: var(--ion-color-primary);
}

.toggle-switch__thumb {
  display: block;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
  transition: transform var(--adv-duration-fast) var(--adv-ease-default);
}

.toggle-switch--active .toggle-switch__thumb {
  transform: translateX(20px);
}

/* ── Interval Chips ── */
.interval-section {
  display: flex;
  flex-direction: column;
  gap: var(--adv-space-sm);
  padding-top: var(--adv-space-sm);
  border-top: 1px solid var(--adv-border-subtle);
}

.interval-section__label {
  display: flex;
  align-items: center;
  gap: var(--adv-space-xs);
  font-size: var(--adv-font-body-sm);
  font-weight: 500;
  color: var(--adv-text-secondary);
}

.interval-section__icon {
  font-size: var(--adv-font-body);
}

.interval-chips {
  display: flex;
  gap: var(--adv-space-xs);
}

.interval-chip {
  display: flex;
  align-items: center;
  justify-content: center;

  flex: 1;
  height: 36px;
  border-radius: var(--adv-radius-sm);
  border: 1.5px solid var(--adv-border-subtle);
  background: transparent;
  color: var(--adv-text-secondary);
  font-size: var(--adv-font-body-sm);
  font-weight: 500;
  cursor: pointer;
  transition:
    border-color var(--adv-duration-fast) var(--adv-ease-default),
    background var(--adv-duration-fast) var(--adv-ease-default),
    color var(--adv-duration-fast) var(--adv-ease-default);
  -webkit-tap-highlight-color: transparent;
}

.interval-chip:hover {
  border-color: var(--ion-color-primary-tint);
}

.interval-chip--active {
  border-color: var(--ion-color-primary);
  background: rgba(99, 102, 241, 0.08);
  color: var(--ion-color-primary);
  font-weight: 600;
}

/* ── Sync Time Row ── */
.sync-time-row {
  display: flex;
  align-items: center;
  gap: var(--adv-space-xs);
  padding-top: var(--adv-space-sm);
  border-top: 1px solid var(--adv-border-subtle);
}

.sync-time-row__icon {
  font-size: var(--adv-font-body);
  color: var(--adv-text-tertiary);
}

.sync-time-row__text {
  font-size: var(--adv-font-caption);
  color: var(--adv-text-tertiary);
}
</style>
