<script setup lang="ts">
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonLoading,
  IonPage,
  IonTitle,
  IonToolbar,
  toastController,
} from '@ionic/vue'
import { computed, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import SButton from '../components/ui/SButton.vue'
import SFormField from '../components/ui/SFormField.vue'
import SInput from '../components/ui/SInput.vue'
import SSelect from '../components/ui/SSelect.vue'
import { useCloudbase } from '../composables/useCloudbase'
import { useAuthStore } from '../stores/useAuthStore'
import { areaCodes, getMaxLength, isValidPhone } from '../utils/phone'

let auth: ReturnType<typeof useCloudbase>['auth'] | null = null
try {
  auth = useCloudbase().auth
}
catch {
  // CloudBase not configured
}
const authUnavailable = auth === null

const authStore = useAuthStore()
const router = useRouter()
const { t } = useI18n()

const phoneNumber = ref(localStorage.getItem('adv:login-phone') || '')
const smsCode = ref('')
const isSending = ref(false)
const isSigningIn = ref(false)

const areaCode = ref(localStorage.getItem('adv:login-area-code') || '+86')

watch(phoneNumber, v => localStorage.setItem('adv:login-phone', v))
watch(areaCode, v => localStorage.setItem('adv:login-area-code', v))

const fullPhoneNumber = computed(() => {
  return `${areaCode.value} ${phoneNumber.value}`
})

const areaCodeOptions = computed(() =>
  areaCodes.map(a => ({ value: a.code, label: `${a.flag} ${a.code}` })),
)

const verificationInfo = ref<any | null>(null)

const countdownSeconds = ref(0)
let countdownTimer: number | null = null

onUnmounted(() => {
  if (countdownTimer) {
    window.clearInterval(countdownTimer)
    countdownTimer = null
  }
})

const canSendCode = computed(() => {
  return !authUnavailable && !isSending.value && countdownSeconds.value === 0 && isValidPhone(areaCode.value, phoneNumber.value)
})

const canSignIn = computed(() => {
  return !authUnavailable && !isSigningIn.value && !!verificationInfo.value && smsCode.value.trim().length >= 4 && isValidPhone(areaCode.value, phoneNumber.value)
})

function startCountdown(seconds = 60) {
  countdownSeconds.value = seconds
  if (countdownTimer)
    window.clearInterval(countdownTimer)

  countdownTimer = window.setInterval(() => {
    if (countdownSeconds.value > 0) {
      countdownSeconds.value -= 1
    }
    else {
      if (countdownTimer)
        window.clearInterval(countdownTimer)
      countdownTimer = null
    }
  }, 1000)
}

async function showToast(message: string, color: 'success' | 'danger' = 'danger') {
  const toast = await toastController.create({
    message,
    duration: 2500,
    position: 'bottom',
    color,
  })
  await toast.present()
}

async function sendCode() {
  if (!isValidPhone(areaCode.value, phoneNumber.value)) {
    await showToast(t('login.invalidPhone'))
    return
  }

  try {
    isSending.value = true
    const info = await auth!.getVerification({
      phone_number: fullPhoneNumber.value,
    })
    verificationInfo.value = info
    startCountdown(60)
    await showToast(t('login.codeSent'), 'success')
  }
  catch (err: any) {
    await showToast(err?.message || t('login.sendError'))
  }
  finally {
    isSending.value = false
  }
}

async function signIn() {
  if (!verificationInfo.value || smsCode.value.trim().length < 4) {
    await showToast(t('login.codeRequired'))
    return
  }

  try {
    isSigningIn.value = true
    const loginState = await auth!.signInWithSms({
      verificationInfo: verificationInfo.value,
      verificationCode: smsCode.value.trim(),
      phoneNum: fullPhoneNumber.value,
    })

    authStore.setLoginState(loginState)
    await authStore.loadUserInfo(auth!)

    await showToast(t('login.success'), 'success')
    router.replace('/tabs/me')
  }
  catch (err: any) {
    await showToast(err?.message || t('login.signInError'))
  }
  finally {
    isSigningIn.value = false
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
      <!-- Ambient background -->
      <div class="login-bg">
        <div class="login-bg__orb login-bg__orb--1" />
        <div class="login-bg__orb login-bg__orb--2" />
      </div>

      <div class="login-container">
        <!-- Brand header -->
        <div class="login-header">
          <div class="login-logo">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <rect width="40" height="40" rx="12" fill="url(#logo-grad)" />
              <path d="M12 26L20 14L28 26H12Z" fill="white" fill-opacity="0.9" />
              <defs>
                <linearGradient id="logo-grad" x1="0" y1="0" x2="40" y2="40">
                  <stop stop-color="#7c3aed" />
                  <stop offset="1" stop-color="#a78bfa" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <h2 class="login-title">
            {{ t('login.welcome') }}
          </h2>
          <p class="login-subtitle">
            {{ t('login.subtitle') }}
          </p>
        </div>

        <!-- Form card -->
        <div class="login-card">
          <SFormField :label="t('login.phoneLabel')">
            <SSelect
              v-model="areaCode"
              :options="areaCodeOptions"
              :placeholder="t('login.areaCodePlaceholder')"
              class="area-code-select"
            />
            <SInput
              v-model="phoneNumber"
              type="tel"
              :placeholder="t('login.phonePlaceholder')"
              :maxlength="getMaxLength(areaCode)"
              inputmode="numeric"
              clearable
              class="flex-1"
            />
          </SFormField>

          <SFormField :label="t('login.codeLabel')">
            <SInput
              v-model="smsCode"
              :placeholder="t('login.codePlaceholder')"
              inputmode="numeric"
              clearable
              class="flex-1"
            />
            <SButton
              variant="outline"
              size="md"
              :disabled="!canSendCode"
              @click="sendCode"
            >
              {{ countdownSeconds > 0 ? `${countdownSeconds}s` : t('login.getCode') }}
            </SButton>
          </SFormField>

          <SButton
            variant="primary"
            size="lg"
            block
            :disabled="!canSignIn"
            :loading="isSigningIn"
            class="login-submit"
            @click="signIn"
          >
            {{ isSigningIn ? t('login.signingIn') : t('login.signIn') }}
          </SButton>
        </div>

        <!-- Footer hint -->
        <p class="login-footer">
          {{ t('login.agreement', 'By signing in, you agree to our Terms of Service.') }}
        </p>
      </div>

      <IonLoading
        :is-open="isSending || isSigningIn"
        :message="isSending ? t('login.sendingCode') : t('login.signingIn')"
        :duration="0"
      />
    </IonContent>
  </IonPage>
</template>

<style scoped>
/* ── Ambient background ── */
.login-bg {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  z-index: 0;
}

.login-bg__orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.18;
}

.login-bg__orb--1 {
  width: 320px;
  height: 320px;
  top: -60px;
  right: -80px;
  background: var(--ion-color-primary, #7c3aed);
  animation: login-float 12s ease-in-out infinite alternate;
}

.login-bg__orb--2 {
  width: 240px;
  height: 240px;
  bottom: 10%;
  left: -60px;
  background: var(--adv-primary);
  animation: login-float 10s ease-in-out infinite alternate-reverse;
}

@keyframes login-float {
  0% {
    transform: translate(0, 0) scale(1);
  }
  100% {
    transform: translate(20px, -30px) scale(1.1);
  }
}

:root.dark .login-bg__orb {
  opacity: 0.12;
}

/* ── Container ── */
.login-container {
  position: relative;
  z-index: 1;
  padding: var(--adv-space-xl) var(--adv-space-md) var(--adv-space-lg);
  max-width: 420px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--adv-space-lg);
  min-height: 100%;
  justify-content: center;
}

/* ── Brand header ── */
.login-header {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--adv-space-sm);
}

.login-logo {
  width: 56px;
  height: 56px;
  border-radius: var(--adv-radius-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: var(--adv-space-xs);
  box-shadow: var(--adv-shadow-glow);
  animation: login-logo-in 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}

.login-logo svg {
  width: 40px;
  height: 40px;
}

@keyframes login-logo-in {
  from {
    opacity: 0;
    transform: scale(0.5) rotate(-8deg);
  }
  to {
    opacity: 1;
    transform: scale(1) rotate(0deg);
  }
}

.login-title {
  font-size: var(--adv-font-display, 28px);
  font-weight: 800;
  color: var(--adv-text-primary);
  margin: 0;
  letter-spacing: -0.03em;
  animation: login-fade-up 0.5s ease both 0.1s;
}

.login-subtitle {
  font-size: var(--adv-font-body, 15px);
  color: var(--adv-text-tertiary);
  margin: 0;
  animation: login-fade-up 0.5s ease both 0.2s;
}

@keyframes login-fade-up {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* ── Form card ── */
.login-card {
  width: 100%;
  background: var(--adv-surface-card);
  border: 1px solid var(--adv-border-subtle);
  border-radius: var(--adv-radius-lg);
  padding: var(--adv-space-lg);
  box-shadow:
    var(--adv-shadow-medium),
    0 0 0 1px rgba(var(--ion-color-primary-rgb), 0.03);
  display: flex;
  flex-direction: column;
  gap: var(--adv-space-md);
  animation: login-card-in 0.5s ease both 0.25s;
}

@keyframes login-card-in {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

:root.dark .login-card {
  box-shadow:
    var(--adv-shadow-medium),
    0 0 0 1px rgba(255, 255, 255, 0.03);
}

/* ── Form elements ── */
.area-code-select {
  width: 110px;
  flex-shrink: 0;
}

.flex-1 {
  flex: 1;
  min-width: 0;
}

.login-submit {
  margin-top: var(--adv-space-xs);
  border-radius: var(--adv-radius-md);
  font-weight: 700;
  letter-spacing: -0.01em;
}

/* ── Footer ── */
.login-footer {
  font-size: var(--adv-font-caption, 11px);
  color: var(--adv-text-tertiary);
  text-align: center;
  margin: 0;
  max-width: 280px;
  line-height: 1.5;
  animation: login-fade-up 0.5s ease both 0.4s;
}
</style>
