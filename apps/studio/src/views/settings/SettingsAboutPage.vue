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
  toastController,
} from '@ionic/vue'
import {
  bookOutline,
  logoGithub,
  openOutline,
  sparklesOutline,
} from 'ionicons/icons'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '../../stores/useSettingsStore'

const { t } = useI18n()
const settingsStore = useSettingsStore()

const TAP_TARGET = 5
const TAP_TIMEOUT = 3000
const tapCount = ref(0)
let tapTimer: ReturnType<typeof setTimeout> | null = null

async function onLogoTap() {
  if (settingsStore.developerMode)
    return

  tapCount.value++

  if (tapTimer)
    clearTimeout(tapTimer)
  tapTimer = setTimeout(() => {
    tapCount.value = 0
  }, TAP_TIMEOUT)

  const remaining = TAP_TARGET - tapCount.value
  if (remaining > 0 && remaining <= 3) {
    const toast = await toastController.create({
      message: t('developer.stepsRemaining', { n: remaining }),
      duration: 800,
      position: 'top',
    })
    await toast.present()
  }

  if (tapCount.value >= TAP_TARGET) {
    tapCount.value = 0
    settingsStore.developerMode = true
    const toast = await toastController.create({
      message: t('developer.enabled'),
      duration: 2000,
      position: 'top',
    })
    await toast.present()
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
        <IonTitle>{{ t('settings.about') }}</IonTitle>
      </IonToolbar>
    </IonHeader>
    <IonContent :fullscreen="true">
      <IonHeader collapse="condense">
        <IonToolbar>
          <IonTitle size="large">
            {{ t('settings.about') }}
          </IonTitle>
        </IonToolbar>
      </IonHeader>

      <div class="page-container">
        <!-- App Identity -->
        <div class="identity-card">
          <div class="identity-card__logo" @click="onLogoTap">
            <IonIcon :icon="sparklesOutline" />
          </div>
          <h2 class="identity-card__name">
            ADV.JS Studio
          </h2>
          <span class="identity-card__version">v0.0.1</span>
          <p class="identity-card__tagline">
            Visual Novel Engine
          </p>
        </div>

        <!-- Links -->
        <div class="links-card">
          <a
            href="https://advjs.org"
            target="_blank"
            rel="noopener noreferrer"
            class="link-item"
          >
            <span class="link-item__icon link-item__icon--docs">
              <IonIcon :icon="bookOutline" />
            </span>
            <span class="link-item__text">
              <span class="link-item__label">{{ t('settings.docs') }}</span>
              <span class="link-item__url">advjs.org</span>
            </span>
            <IonIcon :icon="openOutline" class="link-item__open" />
          </a>
          <a
            href="https://github.com/YunYouJun/advjs"
            target="_blank"
            rel="noopener noreferrer"
            class="link-item"
          >
            <span class="link-item__icon link-item__icon--github">
              <IonIcon :icon="logoGithub" />
            </span>
            <span class="link-item__text">
              <span class="link-item__label">GitHub</span>
              <span class="link-item__url">YunYouJun/advjs</span>
            </span>
            <IonIcon :icon="openOutline" class="link-item__open" />
          </a>
        </div>

        <!-- Footer -->
        <p class="footer-text">
          MPL-2.0 License
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

/* ── Identity Card ── */
.identity-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--adv-space-xl) var(--adv-space-lg);
  border-radius: var(--adv-radius-lg);
  background: var(--adv-surface-card);
  border: 1px solid var(--adv-border-subtle);
  box-shadow: var(--adv-shadow-subtle);
  text-align: center;
}

.identity-card__logo {
  width: 64px;
  height: 64px;
  border-radius: var(--adv-radius-lg);
  background: var(--adv-gradient-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  color: #fff;
  box-shadow: var(--adv-shadow-glow);
  margin-bottom: var(--adv-space-md);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: transform 0.1s ease;
}

.identity-card__logo:active {
  transform: scale(0.92);
}

.identity-card__name {
  font-size: var(--adv-font-title);
  font-weight: 800;
  color: var(--adv-text-primary);
  margin: 0 0 var(--adv-space-xs);
  letter-spacing: -0.02em;
}

.identity-card__version {
  display: inline-block;
  font-size: var(--adv-font-caption);
  font-weight: 600;
  color: var(--ion-color-primary);
  background: rgba(99, 102, 241, 0.08);
  padding: 2px 10px;
  border-radius: var(--adv-radius-full);
  margin-bottom: var(--adv-space-xs);
}

.identity-card__tagline {
  font-size: var(--adv-font-body-sm);
  color: var(--adv-text-tertiary);
  margin: 0;
}

/* ── Links Card ── */
.links-card {
  border-radius: var(--adv-radius-lg);
  background: var(--adv-surface-card);
  border: 1px solid var(--adv-border-subtle);
  box-shadow: var(--adv-shadow-subtle);
  overflow: hidden;
}

.link-item {
  display: flex;
  align-items: center;
  gap: var(--adv-space-md);
  padding: var(--adv-space-md) var(--adv-space-lg);
  min-height: 60px;
  text-decoration: none;
  transition: background var(--adv-duration-fast) var(--adv-ease-default);
  -webkit-tap-highlight-color: transparent;
}

.link-item:hover {
  background: var(--adv-surface-elevated);
}

.link-item + .link-item {
  border-top: 1px solid var(--adv-border-subtle);
}

.link-item__icon {
  width: 36px;
  height: 36px;
  border-radius: var(--adv-radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 18px;
}

.link-item__icon--docs {
  background: rgba(99, 102, 241, 0.1);
  color: var(--ion-color-primary);
}

.link-item__icon--github {
  background: rgba(0, 0, 0, 0.06);
  color: var(--adv-text-primary);
}

:root.dark .link-item__icon--github {
  background: rgba(255, 255, 255, 0.1);
}

.link-item__text {
  display: flex;
  flex-direction: column;
  gap: 1px;
  flex: 1;
  min-width: 0;
}

.link-item__label {
  font-size: var(--adv-font-body);
  font-weight: 600;
  color: var(--adv-text-primary);
}

.link-item__url {
  font-size: var(--adv-font-caption);
  color: var(--adv-text-tertiary);
}

.link-item__open {
  font-size: 14px;
  color: var(--adv-text-tertiary);
  flex-shrink: 0;
}

/* ── Footer ── */
.footer-text {
  text-align: center;
  font-size: var(--adv-font-caption);
  color: var(--adv-text-tertiary);
  margin: 0;
  padding: var(--adv-space-sm) 0;
}
</style>
