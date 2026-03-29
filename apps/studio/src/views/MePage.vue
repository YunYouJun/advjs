<script setup lang="ts">
import {
  IonContent,
  IonHeader,
  IonIcon,
  IonPage,
  IonTitle,
  IonToolbar,
  toastController,
} from '@ionic/vue'
import {
  chatbubbleEllipsesOutline,
  chevronForwardOutline,
  codeSlashOutline,
  informationCircleOutline,
  logOutOutline,
  personCircleOutline,
  settingsOutline,
} from 'ionicons/icons'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useSettingsStore } from '../stores/useSettingsStore'

const { t } = useI18n()
const settingsStore = useSettingsStore()
const router = useRouter()

async function handleLogin() {
  const toast = await toastController.create({
    message: t('me.comingSoon'),
    duration: 2000,
    position: 'top',
  })
  await toast.present()
}

async function handleRegister() {
  const toast = await toastController.create({
    message: t('me.comingSoon'),
    duration: 2000,
    position: 'top',
  })
  await toast.present()
}

async function handleLogout() {
  settingsStore.logout()
  const toast = await toastController.create({
    message: t('me.loggedOut'),
    duration: 1500,
    position: 'top',
  })
  await toast.present()
}

function navigateTo(path: string) {
  router.push(path)
}

const navItems = [
  {
    key: 'settings',
    icon: settingsOutline,
    color: '--nav-icon-settings',
    route: '/tabs/me/settings',
  },
]

const infoItems = [
  {
    key: 'feedback',
    icon: chatbubbleEllipsesOutline,
    color: '--nav-icon-feedback',
    route: '/tabs/me/feedback',
  },
  {
    key: 'about',
    icon: informationCircleOutline,
    color: '--nav-icon-about',
    route: '/tabs/me/settings/about',
  },
]
</script>

<template>
  <IonPage>
    <IonHeader>
      <IonToolbar>
        <IonTitle>{{ t('me.title') }}</IonTitle>
      </IonToolbar>
    </IonHeader>
    <IonContent :fullscreen="true">
      <IonHeader collapse="condense">
        <IonToolbar>
          <IonTitle size="large">
            {{ t('me.title') }}
          </IonTitle>
        </IonToolbar>
      </IonHeader>

      <div class="page-container">
        <!-- Account Section -->
        <!-- Logged-in state -->
        <div v-if="settingsStore.account.isLoggedIn" class="account-card">
          <div class="account-card__user">
            <div class="account-card__avatar">
              <img v-if="settingsStore.account.avatar" :src="settingsStore.account.avatar" alt="avatar">
              <span v-else class="account-card__avatar-fallback">
                {{ settingsStore.account.username.charAt(0).toUpperCase() }}
              </span>
            </div>
            <div class="account-card__info">
              <span class="account-card__name">{{ settingsStore.account.username }}</span>
              <span class="account-card__email">{{ settingsStore.account.email }}</span>
            </div>
            <IonIcon :icon="chevronForwardOutline" class="account-card__chevron" />
          </div>
        </div>

        <!-- Not logged in — hero card -->
        <div v-else class="account-hero" @click="handleLogin">
          <div class="account-hero__glow" />
          <div class="account-hero__content">
            <div class="account-hero__avatar-ring">
              <IonIcon :icon="personCircleOutline" />
            </div>
            <h3 class="account-hero__title">
              {{ t('me.accountTitle') }}
            </h3>
            <p class="account-hero__desc">
              {{ t('me.accountDesc') }}
            </p>
            <div class="account-hero__actions">
              <button class="hero-btn hero-btn--primary" @click.stop="handleLogin">
                {{ t('me.login') }}
              </button>
              <button class="hero-btn hero-btn--ghost" @click.stop="handleRegister">
                {{ t('me.register') }}
              </button>
            </div>
          </div>
        </div>

        <!-- Settings & Features -->
        <nav class="nav-group">
          <button
            v-for="item in navItems"
            :key="item.key"
            class="nav-item"
            @click="navigateTo(item.route)"
          >
            <span class="nav-item__icon" :style="{ '--icon-color': `var(${item.color})` }">
              <IonIcon :icon="item.icon" />
            </span>
            <span class="nav-item__label">{{ t(`me.${item.key}`) }}</span>
            <IonIcon :icon="chevronForwardOutline" class="nav-item__chevron" />
          </button>
        </nav>

        <!-- Help & About -->
        <nav class="nav-group">
          <button
            v-for="item in infoItems"
            :key="item.key"
            class="nav-item"
            @click="navigateTo(item.route)"
          >
            <span class="nav-item__icon" :style="{ '--icon-color': `var(${item.color})` }">
              <IonIcon :icon="item.icon" />
            </span>
            <span class="nav-item__label">{{ t(`me.${item.key}`) }}</span>
            <IonIcon :icon="chevronForwardOutline" class="nav-item__chevron" />
          </button>
        </nav>

        <!-- Developer Options (conditional) -->
        <nav v-if="settingsStore.developerMode" class="nav-group">
          <button
            class="nav-item"
            @click="navigateTo('/tabs/me/developer')"
          >
            <span class="nav-item__icon" :style="{ '--icon-color': 'var(--nav-icon-developer)' }">
              <IonIcon :icon="codeSlashOutline" />
            </span>
            <span class="nav-item__label">{{ t('me.developer') }}</span>
            <IonIcon :icon="chevronForwardOutline" class="nav-item__chevron" />
          </button>
        </nav>

        <!-- Logout -->
        <div v-if="settingsStore.account.isLoggedIn" class="danger-section">
          <button class="danger-btn" @click="handleLogout">
            <IonIcon :icon="logOutOutline" />
            <span>{{ t('me.logout') }}</span>
          </button>
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

  /* Nav icon palette */
  --nav-icon-settings: #8b8b8b;
  --nav-icon-about: #10b981;
  --nav-icon-feedback: #f97316;
  --nav-icon-developer: #8b5cf6;
}

/* ── Logged-in Account Card ── */
.account-card {
  padding: var(--adv-space-lg);
  border-radius: var(--adv-radius-lg);
  background: var(--adv-surface-card);
  border: 1px solid var(--adv-border-subtle);
  box-shadow: var(--adv-shadow-subtle);
  cursor: pointer;
  transition: background var(--adv-duration-fast) var(--adv-ease-default);
  -webkit-tap-highlight-color: transparent;
}

.account-card:hover {
  background: var(--adv-surface-elevated);
}

.account-card__user {
  display: flex;
  align-items: center;
  gap: var(--adv-space-md);
}

.account-card__avatar {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  background: var(--adv-gradient-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--adv-shadow-glow);
}

.account-card__avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.account-card__avatar-fallback {
  color: #fff;
  font-size: var(--adv-font-title);
  font-weight: 700;
}

.account-card__info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.account-card__name {
  font-size: var(--adv-font-subtitle);
  font-weight: 700;
  color: var(--adv-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.account-card__email {
  font-size: var(--adv-font-body-sm);
  color: var(--adv-text-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.account-card__chevron {
  font-size: 16px;
  color: var(--adv-text-tertiary);
  flex-shrink: 0;
}

/* ── Account Hero (Not Logged In) ── */
.account-hero {
  padding: var(--adv-space-xl) var(--adv-space-lg);
  border-radius: var(--adv-radius-lg);
  background: var(--adv-gradient-primary);
  color: white;
  position: relative;
  overflow: hidden;
  cursor: pointer;
}

.account-hero__glow {
  position: absolute;
  right: -20%;
  top: -40%;
  width: 180px;
  height: 180px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.08);
  pointer-events: none;
}

.account-hero__glow::after {
  content: '';
  position: absolute;
  left: -60%;
  bottom: -80%;
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.06);
}

.account-hero__content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.account-hero__avatar-ring {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.3);
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  margin-bottom: var(--adv-space-md);
}

.account-hero__title {
  font-size: var(--adv-font-subtitle);
  font-weight: 700;
  margin: 0 0 var(--adv-space-xs);
}

.account-hero__desc {
  font-size: var(--adv-font-body-sm);
  opacity: 0.8;
  margin: 0 0 var(--adv-space-lg);
  max-width: 240px;
  line-height: 1.4;
}

.account-hero__actions {
  display: flex;
  gap: var(--adv-space-sm);
  width: 100%;
  max-width: 280px;
}

.hero-btn {
  flex: 1;
  height: 44px;
  border-radius: var(--adv-radius-sm);
  font-size: var(--adv-font-body);
  font-weight: 600;
  cursor: pointer;
  transition:
    transform var(--adv-duration-fast) var(--adv-ease-default),
    background var(--adv-duration-fast) var(--adv-ease-default);
  -webkit-tap-highlight-color: transparent;
}

.hero-btn:active {
  transform: scale(0.97);
}

.hero-btn--primary {
  border: none;
  background: rgba(255, 255, 255, 0.95);
  color: var(--ion-color-primary-shade);
}

.hero-btn--primary:hover {
  background: #fff;
}

.hero-btn--ghost {
  border: 1.5px solid rgba(255, 255, 255, 0.35);
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  color: white;
}

.hero-btn--ghost:hover {
  background: rgba(255, 255, 255, 0.15);
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

.nav-item:active {
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
  color: var(--icon-color);
  background: color-mix(in srgb, var(--icon-color) 10%, transparent);
}

.nav-item__label {
  font-size: var(--adv-font-body);
  font-weight: 600;
  color: var(--adv-text-primary);
  flex: 1;
}

.nav-item__chevron {
  font-size: 14px;
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
