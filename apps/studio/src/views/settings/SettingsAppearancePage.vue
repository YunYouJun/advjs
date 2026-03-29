<script setup lang="ts">
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonPage,
  IonTitle,
  IonToolbar,
} from '@ionic/vue'
import {
  moonOutline,
  phonePortraitOutline,
  sunnyOutline,
} from 'ionicons/icons'
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '../../stores/useSettingsStore'

const { t } = useI18n()
const settingsStore = useSettingsStore()

const themeOptions = [
  { value: 'light' as const, key: 'colorModeLight', icon: sunnyOutline },
  { value: 'dark' as const, key: 'colorModeDark', icon: moonOutline },
  { value: 'system' as const, key: 'colorModeSystem', icon: phonePortraitOutline },
]
</script>

<template>
  <IonPage>
    <IonHeader>
      <IonToolbar>
        <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
        <IonButtons slot="start">
          <IonBackButton :text="t('common.back')" default-href="/tabs/me/settings" />
        </IonButtons>
        <IonTitle>{{ t('settings.appearance') }}</IonTitle>
      </IonToolbar>
    </IonHeader>
    <IonContent :fullscreen="true">
      <IonHeader collapse="condense">
        <IonToolbar>
          <IonTitle size="large">
            {{ t('settings.appearance') }}
          </IonTitle>
        </IonToolbar>
      </IonHeader>

      <div class="page-container">
        <!-- Color Mode -->
        <div class="section-card">
          <h3 class="section-card__title">
            {{ t('settings.colorMode') }}
          </h3>
          <div class="theme-grid">
            <button
              v-for="opt in themeOptions"
              :key="opt.value"
              class="theme-option"
              :class="{ 'theme-option--active': settingsStore.theme === opt.value }"
              @click="settingsStore.theme = opt.value"
            >
              <span class="theme-option__icon">
                <IonIcon :icon="opt.icon" />
              </span>
              <span class="theme-option__label">{{ t(`settings.${opt.key}`) }}</span>
            </button>
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

.section-card__title {
  font-size: var(--adv-font-body);
  font-weight: 600;
  color: var(--adv-text-primary);
  margin: 0;
}

/* ── Theme Grid ── */
.theme-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--adv-space-sm);
}

.theme-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--adv-space-sm);
  padding: var(--adv-space-md) var(--adv-space-sm);
  border-radius: var(--adv-radius-md);
  border: 1.5px solid var(--adv-border-subtle);
  background: transparent;
  cursor: pointer;
  transition:
    border-color var(--adv-duration-fast) var(--adv-ease-default),
    background var(--adv-duration-fast) var(--adv-ease-default),
    transform var(--adv-duration-fast) var(--adv-ease-default);
  -webkit-tap-highlight-color: transparent;
}

.theme-option:hover {
  border-color: var(--ion-color-primary-tint);
}

.theme-option:active {
  transform: scale(0.97);
}

.theme-option--active {
  border-color: var(--ion-color-primary);
  background: rgba(99, 102, 241, 0.06);
}

.theme-option__icon {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--adv-surface-elevated);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  color: var(--adv-text-secondary);
  transition:
    color var(--adv-duration-fast) var(--adv-ease-default),
    background var(--adv-duration-fast) var(--adv-ease-default);
}

.theme-option--active .theme-option__icon {
  background: var(--adv-gradient-primary);
  color: #fff;
  box-shadow: var(--adv-shadow-glow);
}

.theme-option__label {
  font-size: var(--adv-font-body-sm);
  font-weight: 500;
  color: var(--adv-text-secondary);
}

.theme-option--active .theme-option__label {
  color: var(--ion-color-primary);
  font-weight: 600;
}
</style>
