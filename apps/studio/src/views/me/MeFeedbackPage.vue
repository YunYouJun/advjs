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
  logoGithub,
  openOutline,
} from 'ionicons/icons'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<template>
  <IonPage>
    <IonHeader>
      <IonToolbar>
        <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
        <IonButtons slot="start">
          <IonBackButton :text="t('common.back')" default-href="/tabs/me" />
        </IonButtons>
        <IonTitle>{{ t('feedback.title') }}</IonTitle>
      </IonToolbar>
    </IonHeader>
    <IonContent :fullscreen="true">
      <IonHeader collapse="condense">
        <IonToolbar>
          <IonTitle size="large">
            {{ t('feedback.title') }}
          </IonTitle>
        </IonToolbar>
      </IonHeader>

      <div class="page-container">
        <nav class="nav-group">
          <a
            href="https://github.com/YunYouJun/advjs/issues/new"
            target="_blank"
            rel="noopener noreferrer"
            class="nav-item"
          >
            <span class="nav-item__icon">
              <IonIcon :icon="logoGithub" />
            </span>
            <span class="nav-item__text">
              <span class="nav-item__label">{{ t('feedback.github') }}</span>
              <span class="nav-item__desc">{{ t('feedback.githubDesc') }}</span>
            </span>
            <IonIcon :icon="openOutline" class="nav-item__chevron" />
          </a>
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
  gap: var(--adv-space-md);
  max-width: 560px;
  margin: 0 auto;
}

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
  gap: var(--adv-space-md);
  padding: var(--adv-space-md) var(--adv-space-lg);
  min-height: 64px;
  border: none;
  background: transparent;
  cursor: pointer;
  text-decoration: none;
  text-align: left;
  transition: background var(--adv-duration-fast) var(--adv-ease-default);
  -webkit-tap-highlight-color: transparent;
}

.nav-item:hover {
  background: var(--adv-surface-elevated);
}

.nav-item__icon {
  width: 36px;
  height: 36px;
  border-radius: var(--adv-radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 18px;
  background: rgba(0, 0, 0, 0.06);
  color: var(--adv-text-primary);
}

:root.dark .nav-item__icon {
  background: rgba(255, 255, 255, 0.1);
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
  font-size: 14px;
  color: var(--adv-text-tertiary);
  flex-shrink: 0;
}
</style>
