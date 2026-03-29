<script setup lang="ts">
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
} from '@ionic/vue'
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '../../stores/useSettingsStore'

const { t } = useI18n()
const settingsStore = useSettingsStore()

const localeOptions = [
  { value: 'en', label: 'English' },
  { value: 'zh-CN', label: '中文' },
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
        <IonTitle>{{ t('settings.language') }}</IonTitle>
      </IonToolbar>
    </IonHeader>
    <IonContent :fullscreen="true">
      <IonHeader collapse="condense">
        <IonToolbar>
          <IonTitle size="large">
            {{ t('settings.language') }}
          </IonTitle>
        </IonToolbar>
      </IonHeader>

      <div class="page-container">
        <div class="locale-list">
          <button
            v-for="opt in localeOptions"
            :key="opt.value"
            class="locale-item"
            :class="{ 'locale-item--active': settingsStore.locale === opt.value }"
            @click="settingsStore.locale = opt.value"
          >
            <span class="locale-item__label">{{ opt.label }}</span>
            <span v-if="settingsStore.locale === opt.value" class="locale-item__check">
              &#10003;
            </span>
          </button>
        </div>
      </div>
    </IonContent>
  </IonPage>
</template>

<style scoped>
.page-container {
  padding: var(--adv-space-md);
  max-width: 560px;
  margin: 0 auto;
}

/* ── Locale List ── */
.locale-list {
  display: flex;
  flex-direction: column;
  border-radius: var(--adv-radius-lg);
  background: var(--adv-surface-card);
  border: 1px solid var(--adv-border-subtle);
  box-shadow: var(--adv-shadow-subtle);
  overflow: hidden;
}

.locale-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--adv-space-sm) var(--adv-space-md);
  min-height: 44px;
  border: none;
  background: transparent;
  cursor: pointer;
  transition: background var(--adv-duration-fast) var(--adv-ease-default);
  -webkit-tap-highlight-color: transparent;
}

.locale-item:hover {
  background: var(--adv-surface-elevated);
}

.locale-item + .locale-item {
  border-top: 1px solid var(--adv-border-subtle);
}

.locale-item__label {
  font-size: var(--adv-font-body);
  font-weight: 500;
  color: var(--adv-text-primary);
}

.locale-item--active .locale-item__label {
  color: var(--ion-color-primary);
  font-weight: 600;
}

.locale-item__check {
  font-size: var(--adv-font-body);
  color: var(--ion-color-primary);
  font-weight: 700;
}
</style>
