<script setup lang="ts">
import {
  alertController,
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonPage,
  IonTitle,
  IonToolbar,
  toastController,
} from '@ionic/vue'
import {
  bugOutline,
  closeCircleOutline,
  refreshOutline,
  serverOutline,
  terminalOutline,
  trashOutline,
} from 'ionicons/icons'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useSettingsStore } from '../../stores/useSettingsStore'

const { t } = useI18n()
const settingsStore = useSettingsStore()
const router = useRouter()

const showDebugInfo = ref(false)

function toggleDebugInfo() {
  showDebugInfo.value = !showDebugInfo.value
}

async function clearAllData() {
  const alert = await alertController.create({
    header: t('developer.resetTitle'),
    message: t('developer.resetMessage'),
    buttons: [
      { text: t('common.cancel'), role: 'cancel' },
      {
        text: t('developer.reset'),
        role: 'destructive',
        handler: async () => {
          localStorage.clear()
          sessionStorage.clear()
          const toast = await toastController.create({
            message: t('developer.resetDone'),
            duration: 2000,
            position: 'top',
          })
          await toast.present()
          setTimeout(() => window.location.reload(), 1500)
        },
      },
    ],
  })
  await alert.present()
}

async function copyDebugInfo() {
  const info = {
    userAgent: navigator.userAgent,
    language: navigator.language,
    platform: navigator.platform,
    theme: settingsStore.theme,
    locale: settingsStore.locale,
    storageKeys: Object.keys(localStorage),
    timestamp: new Date().toISOString(),
  }
  try {
    await navigator.clipboard.writeText(JSON.stringify(info, null, 2))
    const toast = await toastController.create({
      message: t('developer.copied'),
      duration: 1500,
      position: 'top',
    })
    await toast.present()
  }
  catch {
    // ignore
  }
}

function reloadApp() {
  window.location.reload()
}

async function disableDeveloperMode() {
  settingsStore.developerMode = false
  const toast = await toastController.create({
    message: t('developer.disabled'),
    duration: 1500,
    position: 'top',
  })
  await toast.present()
  router.replace('/tabs/me')
}

const debugInfo = {
  version: '0.0.1',
  userAgent: navigator.userAgent,
  language: navigator.language,
  platform: navigator.platform,
  storageUsed: (() => {
    let total = 0
    for (const key of Object.keys(localStorage)) {
      total += (localStorage.getItem(key) || '').length
    }
    return `${(total / 1024).toFixed(1)} KB`
  })(),
}
</script>

<template>
  <IonPage>
    <IonHeader>
      <IonToolbar>
        <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
        <IonButtons slot="start">
          <IonBackButton :text="t('common.back')" default-href="/tabs/me" />
        </IonButtons>
        <IonTitle>{{ t('developer.title') }}</IonTitle>
      </IonToolbar>
    </IonHeader>
    <IonContent :fullscreen="true">
      <IonHeader collapse="condense">
        <IonToolbar>
          <IonTitle size="large">
            {{ t('developer.title') }}
          </IonTitle>
        </IonToolbar>
      </IonHeader>

      <div class="page-container">
        <!-- Debug Tools -->
        <div class="section-title">
          {{ t('developer.tools') }}
        </div>
        <nav class="nav-group">
          <button class="nav-item" @click="toggleDebugInfo">
            <span class="nav-item__icon nav-item__icon--blue">
              <IonIcon :icon="bugOutline" />
            </span>
            <span class="nav-item__label">{{ t('developer.debugInfo') }}</span>
            <span class="nav-item__badge">{{ showDebugInfo ? 'ON' : 'OFF' }}</span>
          </button>

          <button class="nav-item" @click="copyDebugInfo">
            <span class="nav-item__icon nav-item__icon--teal">
              <IonIcon :icon="terminalOutline" />
            </span>
            <span class="nav-item__label">{{ t('developer.copyDebug') }}</span>
          </button>

          <button class="nav-item" @click="reloadApp">
            <span class="nav-item__icon nav-item__icon--green">
              <IonIcon :icon="refreshOutline" />
            </span>
            <span class="nav-item__label">{{ t('developer.reload') }}</span>
          </button>
        </nav>

        <!-- Debug Info Panel -->
        <div v-if="showDebugInfo" class="debug-panel">
          <div class="debug-panel__title">
            <IonIcon :icon="serverOutline" />
            {{ t('developer.systemInfo') }}
          </div>
          <div class="debug-panel__row">
            <span class="debug-panel__key">Version</span>
            <span class="debug-panel__val">{{ debugInfo.version }}</span>
          </div>
          <div class="debug-panel__row">
            <span class="debug-panel__key">Platform</span>
            <span class="debug-panel__val">{{ debugInfo.platform }}</span>
          </div>
          <div class="debug-panel__row">
            <span class="debug-panel__key">Language</span>
            <span class="debug-panel__val">{{ debugInfo.language }}</span>
          </div>
          <div class="debug-panel__row">
            <span class="debug-panel__key">Storage</span>
            <span class="debug-panel__val">{{ debugInfo.storageUsed }}</span>
          </div>
          <div class="debug-panel__row">
            <span class="debug-panel__key">Theme</span>
            <span class="debug-panel__val">{{ settingsStore.theme }}</span>
          </div>
          <div class="debug-panel__row debug-panel__row--ua">
            <span class="debug-panel__key">UA</span>
            <span class="debug-panel__val">{{ debugInfo.userAgent }}</span>
          </div>
        </div>

        <!-- Danger Zone -->
        <div class="section-title section-title--danger">
          {{ t('developer.dangerZone') }}
        </div>
        <nav class="nav-group nav-group--danger">
          <button class="nav-item" @click="disableDeveloperMode">
            <span class="nav-item__icon nav-item__icon--orange">
              <IonIcon :icon="closeCircleOutline" />
            </span>
            <span class="nav-item__label nav-item__label--danger">{{ t('developer.disable') }}</span>
          </button>

          <button class="nav-item" @click="clearAllData">
            <span class="nav-item__icon nav-item__icon--red">
              <IonIcon :icon="trashOutline" />
            </span>
            <span class="nav-item__label nav-item__label--danger">{{ t('developer.resetAll') }}</span>
          </button>
        </nav>
      </div>
    </IonContent>
  </IonPage>
</template>

<style scoped>
.page-container {
  padding: var(--adv-space-md);
  display: flex;
  flex-direction: column;
  gap: var(--adv-space-sm);
  max-width: 560px;
  margin: 0 auto;
}

.section-title {
  font-size: var(--adv-font-caption);
  font-weight: 600;
  color: var(--adv-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: var(--adv-space-sm) var(--adv-space-sm) 0;
}

.section-title--danger {
  color: var(--ion-color-danger);
}

/* ── Navigation Group ── */
.nav-group {
  display: flex;
  flex-direction: column;
  border-radius: var(--adv-radius-lg);
  background: var(--adv-surface-card);
  border: 1px solid var(--adv-border-subtle);
  box-shadow: var(--adv-shadow-subtle);
  overflow: hidden;
}

.nav-group--danger {
  border-color: rgba(239, 68, 68, 0.15);
}

.nav-item {
  display: flex;
  align-items: center;
  gap: var(--adv-space-sm);
  padding: 10px var(--adv-space-md);
  min-height: 44px;
  border: none;
  background: transparent;
  cursor: pointer;
  text-align: left;
  transition: background var(--adv-duration-fast) var(--adv-ease-default);
  -webkit-tap-highlight-color: transparent;
}

.nav-item:hover {
  background: var(--adv-surface-elevated);
}

.nav-item + .nav-item {
  border-top: 1px solid var(--adv-border-subtle);
}

.nav-item__icon {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 16px;
}

.nav-item__icon--blue {
  color: #6366f1;
  background: rgba(99, 102, 241, 0.1);
}

.nav-item__icon--teal {
  color: #14b8a6;
  background: rgba(20, 184, 166, 0.1);
}

.nav-item__icon--green {
  color: #10b981;
  background: rgba(16, 185, 129, 0.1);
}

.nav-item__icon--red {
  color: var(--ion-color-danger);
  background: rgba(239, 68, 68, 0.08);
}

.nav-item__icon--orange {
  color: #f97316;
  background: rgba(249, 115, 22, 0.1);
}

.nav-item__label {
  font-size: var(--adv-font-body);
  font-weight: 600;
  color: var(--adv-text-primary);
  flex: 1;
}

.nav-item__label--danger {
  color: var(--ion-color-danger);
}

.nav-item__badge {
  font-size: var(--adv-font-caption);
  font-weight: 700;
  padding: 2px 8px;
  border-radius: var(--adv-radius-full);
  background: rgba(99, 102, 241, 0.08);
  color: var(--ion-color-primary);
}

/* ── Debug Panel ── */
.debug-panel {
  border-radius: var(--adv-radius-lg);
  background: var(--adv-surface-card);
  border: 1px solid var(--adv-border-subtle);
  box-shadow: var(--adv-shadow-subtle);
  padding: var(--adv-space-md) var(--adv-space-lg);
  display: flex;
  flex-direction: column;
  gap: var(--adv-space-sm);
}

.debug-panel__title {
  display: flex;
  align-items: center;
  gap: var(--adv-space-xs);
  font-size: var(--adv-font-body-sm);
  font-weight: 700;
  color: var(--adv-text-primary);
  padding-bottom: var(--adv-space-xs);
  border-bottom: 1px solid var(--adv-border-subtle);
}

.debug-panel__row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--adv-space-md);
}

.debug-panel__row--ua {
  flex-direction: column;
  gap: var(--adv-space-xs);
}

.debug-panel__key {
  font-size: var(--adv-font-caption);
  font-weight: 600;
  color: var(--adv-text-tertiary);
  flex-shrink: 0;
}

.debug-panel__val {
  font-size: var(--adv-font-caption);
  color: var(--adv-text-secondary);
  text-align: right;
  word-break: break-all;
}

.debug-panel__row--ua .debug-panel__val {
  text-align: left;
  font-size: 11px;
  line-height: 1.4;
  opacity: 0.7;
}
</style>
