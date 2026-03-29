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
  chevronForwardOutline,
  cloudOutline,
  colorPaletteOutline,
  globeOutline,
  sparklesOutline,
  trashOutline,
} from 'ionicons/icons'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

const { t } = useI18n()
const router = useRouter()

async function clearCache() {
  const alert = await alertController.create({
    header: t('settings.clearCacheTitle'),
    message: t('settings.clearCacheMessage'),
    buttons: [
      { text: t('common.cancel'), role: 'cancel' },
      {
        text: t('common.clear'),
        role: 'destructive',
        handler: async () => {
          localStorage.clear()
          const toast = await toastController.create({
            message: t('settings.clearCacheDone'),
            duration: 2000,
            position: 'top',
          })
          await toast.present()
        },
      },
    ],
  })
  await alert.present()
}

const generalItems = [
  {
    key: 'appearance',
    labelKey: 'settings.appearance',
    descKey: 'settings.appearanceDesc',
    icon: colorPaletteOutline,
    color: '--nav-icon-appearance',
    route: '/tabs/me/settings/appearance',
  },
  {
    key: 'language',
    labelKey: 'settings.language',
    descKey: 'settings.languageDesc',
    icon: globeOutline,
    color: '--nav-icon-language',
    route: '/tabs/me/settings/language',
  },
]

const serviceItems = [
  {
    key: 'ai',
    labelKey: 'settings.ai',
    descKey: 'settings.aiDesc',
    icon: sparklesOutline,
    color: '--nav-icon-ai',
    route: '/tabs/me/settings/ai',
  },
  {
    key: 'cloudSync',
    labelKey: 'settings.cloudSync',
    descKey: 'settings.cloudSyncDesc',
    icon: cloudOutline,
    color: '--nav-icon-cloud',
    route: '/tabs/me/settings/cloud',
  },
]
</script>

<template>
  <IonPage>
    <IonHeader>
      <IonToolbar>
        <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
        <IonButtons slot="start">
          <IonBackButton :text="t('common.back')" default-href="/tabs/me" />
        </IonButtons>
        <IonTitle>{{ t('me.settings') }}</IonTitle>
      </IonToolbar>
    </IonHeader>
    <IonContent :fullscreen="true">
      <IonHeader collapse="condense">
        <IonToolbar>
          <IonTitle size="large">
            {{ t('me.settings') }}
          </IonTitle>
        </IonToolbar>
      </IonHeader>

      <div class="page-container">
        <!-- General: Appearance & Language -->
        <nav class="nav-group">
          <button
            v-for="item in generalItems"
            :key="item.key"
            class="nav-item"
            @click="router.push(item.route)"
          >
            <span class="nav-item__icon" :style="{ '--icon-color': `var(${item.color})` }">
              <IonIcon :icon="item.icon" />
            </span>
            <span class="nav-item__text">
              <span class="nav-item__label">{{ t(item.labelKey) }}</span>
              <span class="nav-item__desc">{{ t(item.descKey) }}</span>
            </span>
            <IonIcon :icon="chevronForwardOutline" class="nav-item__chevron" />
          </button>
        </nav>

        <!-- Services: AI & Cloud Sync -->
        <nav class="nav-group">
          <button
            v-for="item in serviceItems"
            :key="item.key"
            class="nav-item"
            @click="router.push(item.route)"
          >
            <span class="nav-item__icon" :style="{ '--icon-color': `var(${item.color})` }">
              <IonIcon :icon="item.icon" />
            </span>
            <span class="nav-item__text">
              <span class="nav-item__label">{{ t(item.labelKey) }}</span>
              <span class="nav-item__desc">{{ t(item.descKey) }}</span>
            </span>
            <IonIcon :icon="chevronForwardOutline" class="nav-item__chevron" />
          </button>
        </nav>

        <!-- Danger Zone -->
        <div class="danger-section">
          <button class="danger-btn" @click="clearCache">
            <IonIcon :icon="trashOutline" />
            <span>{{ t('settings.clearCache') }}</span>
          </button>
        </div>
      </div>
    </IonContent>
  </IonPage>
</template>

<style scoped>
.page-container {
  padding: var(--adv-space-sm) var(--adv-space-md);
  display: flex;
  flex-direction: column;
  gap: var(--adv-space-sm);
  max-width: 560px;
  margin: 0 auto;

  --nav-icon-ai: #a855f7;
  --nav-icon-appearance: #f59e0b;
  --nav-icon-language: #10b981;
  --nav-icon-cloud: #6366f1;
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

.nav-item {
  display: flex;
  align-items: center;
  gap: var(--adv-space-sm);
  padding: var(--adv-space-sm) var(--adv-space-md);
  min-height: 52px;
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

.nav-item:active {
  background: var(--adv-surface-elevated);
}

.nav-item + .nav-item {
  border-top: 1px solid var(--adv-border-subtle);
}

.nav-item__icon {
  width: 34px;
  height: 34px;
  border-radius: var(--adv-radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 18px;
  color: var(--icon-color);
  background: color-mix(in srgb, var(--icon-color) 10%, transparent);
}

.nav-item__text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.nav-item__label {
  font-size: var(--adv-font-body);
  font-weight: 600;
  color: var(--adv-text-primary);
}

.nav-item__desc {
  font-size: var(--adv-font-caption);
  color: var(--adv-text-tertiary);
  line-height: 1.3;
}

.nav-item__chevron {
  font-size: 16px;
  color: var(--adv-text-tertiary);
  flex-shrink: 0;
}

/* ── Danger Section ── */
.danger-section {
  padding-top: var(--adv-space-sm);
}

.danger-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--adv-space-xs);
  width: 100%;
  height: 44px;
  border-radius: var(--adv-radius-md);
  border: 1.5px solid rgba(239, 68, 68, 0.2);
  background: transparent;
  color: var(--ion-color-danger);
  font-size: var(--adv-font-body-sm);
  font-weight: 600;
  cursor: pointer;
  transition:
    background var(--adv-duration-fast) var(--adv-ease-default),
    transform var(--adv-duration-fast) var(--adv-ease-default);
  -webkit-tap-highlight-color: transparent;
}

.danger-btn:hover {
  background: rgba(239, 68, 68, 0.04);
}

.danger-btn:active {
  transform: scale(0.98);
}
</style>
