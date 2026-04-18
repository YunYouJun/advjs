<script setup lang="ts">
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonLoading,
  IonPage,
  IonSelect,
  IonSelectOption,
  IonTitle,
  IonToolbar,
  toastController,
} from '@ionic/vue'
import { computed, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
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

const phoneNumber = ref('')
const smsCode = ref('')
const isSending = ref(false)
const isSigningIn = ref(false)

const areaCode = ref('+86')

const fullPhoneNumber = computed(() => {
  return `${areaCode.value} ${phoneNumber.value}`
})

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
      <div class="login-container">
        <div class="login-header">
          <h2 class="login-title">
            {{ t('login.welcome') }}
          </h2>
          <p class="login-subtitle">
            {{ t('login.subtitle') }}
          </p>
        </div>

        <div class="form-group">
          <IonItem>
            <IonLabel position="stacked">
              {{ t('login.phoneLabel') }}
            </IonLabel>
            <div class="phone-row">
              <IonSelect
                v-model="areaCode"
                :placeholder="t('login.areaCodePlaceholder')"
                class="area-code-select"
              >
                <IonSelectOption
                  v-for="area in areaCodes"
                  :key="area.code"
                  :value="area.code"
                >
                  {{ area.flag }} {{ area.code }}
                </IonSelectOption>
              </IonSelect>
              <IonInput
                v-model="phoneNumber"
                type="tel"
                :placeholder="t('login.phonePlaceholder')"
                :maxlength="getMaxLength(areaCode)"
                inputmode="numeric"
                clear-input
                class="flex-1"
              />
            </div>
          </IonItem>
        </div>

        <div class="form-group">
          <IonItem>
            <IonLabel position="stacked">
              {{ t('login.codeLabel') }}
            </IonLabel>
            <div class="phone-row">
              <IonInput
                v-model="smsCode"
                type="text"
                :placeholder="t('login.codePlaceholder')"
                inputmode="numeric"
                clear-input
              />
              <IonButton :disabled="!canSendCode" fill="outline" class="whitespace-nowrap" @click="sendCode">
                {{ countdownSeconds > 0 ? `${countdownSeconds}s` : t('login.getCode') }}
              </IonButton>
            </div>
          </IonItem>
        </div>

        <IonButton class="login-btn" expand="block" :disabled="!canSignIn" @click="signIn">
          {{ isSigningIn ? t('login.signingIn') : t('login.signIn') }}
        </IonButton>
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
.login-container {
  padding: var(--adv-space-lg) var(--adv-space-md);
  max-width: 480px;
  margin: 0 auto;
}

.login-header {
  text-align: center;
  margin-bottom: var(--adv-space-xl);
}

.login-title {
  font-size: var(--adv-font-title, 22px);
  font-weight: 700;
  color: var(--adv-text-primary);
  margin: 0 0 var(--adv-space-xs);
}

.login-subtitle {
  font-size: var(--adv-font-body-sm, 13px);
  color: var(--adv-text-tertiary);
  margin: 0;
}

.form-group {
  margin-bottom: var(--adv-space-md);
}

.phone-row {
  display: flex;
  gap: 8px;
  width: 100%;
  align-items: center;
}

.area-code-select {
  max-width: 120px;
  min-width: 100px;
}

.login-btn {
  margin-top: var(--adv-space-lg);
}
</style>
