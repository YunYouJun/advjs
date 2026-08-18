<script setup lang="ts">
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  toastController,
} from '@ionic/vue'
import { computed, onMounted, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { resolveStudioSsoConfig } from '../auth/sso-config'
import { beginStudioSso } from '../auth/studio-sso'
import SButton from '../components/ui/SButton.vue'
import { useCloudbase } from '../composables/useCloudbase'
import { useAuthStore } from '../stores/useAuthStore'

const authStore = useAuthStore()
const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const isRedirecting = shallowRef(false)

let auth: ReturnType<typeof useCloudbase>['auth'] | null = null
try {
  auth = useCloudbase().auth
}
catch {
  // CloudBase is unavailable in builds without an environment configuration.
}

const ssoConfig = resolveStudioSsoConfig(window.location.origin)
const ssoAvailable = Boolean(auth && ssoConfig)
const returnPath = computed(() => {
  return typeof route.query.returnTo === 'string' ? route.query.returnTo : '/tabs/me'
})

onMounted(() => {
  if (authStore.isLoggedIn)
    void router.replace(returnPath.value)
})

async function showError(message: string): Promise<void> {
  const toast = await toastController.create({
    message,
    duration: 3000,
    position: 'bottom',
    color: 'danger',
  })
  await toast.present()
}

async function signInWithYunlefun(): Promise<void> {
  if (!ssoConfig || !auth) {
    await showError(t('login.ssoUnavailable'))
    return
  }
  try {
    isRedirecting.value = true
    authStore.setAuthError()
    const result = await beginStudioSso(auth, ssoConfig, returnPath.value)
    if (result.status === 'authenticated') {
      await authStore.restoreSession(auth)
      isRedirecting.value = false
      await router.replace(result.returnPath)
    }
  }
  catch (error) {
    isRedirecting.value = false
    await showError(error instanceof Error ? error.message : t('login.signInError'))
  }
}
</script>

<template>
  <IonPage>
    <IonHeader :translucent="true">
      <IonToolbar>
        <IonButtons slot="start">
          <IonBackButton :text="t('common.back')" default-href="/tabs/me" />
        </IonButtons>
        <IonTitle>{{ t('login.title') }}</IonTitle>
      </IonToolbar>
    </IonHeader>

    <IonContent :fullscreen="true">
      <div class="login-bg" aria-hidden="true">
        <div class="login-bg__orb login-bg__orb--1" />
        <div class="login-bg__orb login-bg__orb--2" />
      </div>

      <main class="login-container">
        <div class="login-header">
          <div class="login-logo" aria-hidden="true">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <rect width="40" height="40" rx="12" fill="url(#logo-grad)" />
              <path d="M12 26L20 14L28 26H12Z" fill="white" fill-opacity="0.9" />
              <defs>
                <linearGradient id="logo-grad" x1="0" y1="0" x2="40" y2="40">
                  <stop stop-color="#8b5cf6" />
                  <stop offset="1" stop-color="#d4a853" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <h1 class="login-title">
            {{ t('login.welcome') }}
          </h1>
          <p class="login-subtitle">
            {{ t('login.subtitle') }}
          </p>
        </div>

        <section class="login-card" :aria-busy="isRedirecting">
          <p v-if="authStore.authError" class="login-error" role="alert">
            {{ t('login.callbackRejected') }}
          </p>
          <SButton
            variant="primary"
            size="lg"
            block
            class="login-submit"
            :disabled="!ssoAvailable || isRedirecting"
            :loading="isRedirecting"
            @click="signInWithYunlefun"
          >
            {{ isRedirecting ? t('login.redirecting') : t('login.signInWithYunlefun') }}
          </SButton>
          <p v-if="!ssoAvailable" class="login-unavailable" role="status">
            {{ t('login.ssoUnavailable') }}
          </p>
          <p class="login-security">
            {{ t('login.ssoSecurity') }}
          </p>
        </section>

        <p class="login-footer">
          {{ t('login.agreement') }}
        </p>
      </main>
    </IonContent>
  </IonPage>
</template>

<style scoped>
.login-bg {
  position: absolute;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
  inset: 0;
}

.login-bg__orb {
  position: absolute;
  border-radius: 50%;
  opacity: 0.18;
  filter: blur(80px);
}

.login-bg__orb--1 {
  top: -60px;
  right: -80px;
  width: 320px;
  height: 320px;
  background: var(--ion-color-primary, #7c3aed);
}

.login-bg__orb--2 {
  bottom: 5%;
  left: -100px;
  width: 280px;
  height: 280px;
  background: #d4a853;
}

.login-container {
  position: relative;
  z-index: 1;
  display: flex;
  width: min(100% - 32px, 440px);
  min-height: calc(100% - 32px);
  margin: 0 auto;
  padding: 72px 0 32px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.login-header {
  margin-bottom: 28px;
  text-align: center;
}

.login-logo {
  display: inline-flex;
  margin-bottom: 16px;
}

.login-title {
  margin: 0;
  color: var(--ion-text-color);
  font-size: 28px;
  font-weight: 750;
  letter-spacing: -0.02em;
}

.login-subtitle {
  max-width: 360px;
  margin: 10px auto 0;
  color: var(--ion-color-medium);
  font-size: 15px;
  line-height: 1.6;
}

.login-card {
  width: 100%;
  padding: 24px;
  border: 1px solid color-mix(in srgb, var(--ion-color-primary) 18%, transparent);
  border-radius: 20px;
  background: color-mix(in srgb, var(--ion-background-color) 88%, transparent);
  box-shadow: 0 24px 70px rgb(44 24 80 / 12%);
  backdrop-filter: blur(20px);
}

.login-submit {
  width: 100%;
}

.login-error,
.login-unavailable {
  margin: 0 0 14px;
  color: var(--ion-color-danger);
  font-size: 13px;
  line-height: 1.5;
  text-align: center;
}

.login-security {
  margin: 14px 0 0;
  color: var(--ion-color-medium);
  font-size: 12px;
  line-height: 1.55;
  text-align: center;
}

.login-footer {
  margin: 18px 0 0;
  color: var(--ion-color-medium);
  font-size: 12px;
  line-height: 1.5;
  text-align: center;
}

@media (prefers-reduced-motion: reduce) {
  .login-bg__orb {
    animation: none;
  }
}
</style>
