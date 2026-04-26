<!--
  Short link redirect page.

  Route: `/s/:code`

  Resolves a short code via the CloudBase `shortlink` function
  and redirects to the target URL. Shows a spinner while loading
  and a graceful error if the link is not found.
-->
<script setup lang="ts">
import {
  IonButton,
  IonContent,
  IonPage,
  IonSpinner,
} from '@ionic/vue'
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useShortLink } from '../composables/useShortLink'

const route = useRoute()
const { resolveShortLink } = useShortLink()

const isLoading = ref(true)
const notFound = ref(false)

let cloudApp: any = null
try {
  const { useCloudbase } = await import('../composables/useCloudbase')
  cloudApp = useCloudbase().app
}
catch {
  // CloudBase not configured
}

onMounted(async () => {
  const code = route.params.code as string
  if (!code || !cloudApp) {
    notFound.value = true
    isLoading.value = false
    return
  }

  const targetUrl = await resolveShortLink(cloudApp, code)
  if (targetUrl) {
    window.location.href = targetUrl
  }
  else {
    notFound.value = true
    isLoading.value = false
  }
})
</script>

<template>
  <IonPage>
    <IonContent class="shortlink-page">
      <div v-if="isLoading" class="shortlink-page__loading">
        <IonSpinner name="crescent" />
        <p>Redirecting…</p>
      </div>
      <div v-else-if="notFound" class="shortlink-page__error">
        <div class="shortlink-page__icon">
          🔗
        </div>
        <h2>Link not found</h2>
        <p>This short link may have expired or does not exist.</p>
        <IonButton router-link="/" fill="outline">
          Go to Studio
        </IonButton>
      </div>
    </IonContent>
  </IonPage>
</template>

<style scoped>
.shortlink-page__loading,
.shortlink-page__error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 48px 24px;
  gap: 12px;
  min-height: 50vh;
  color: var(--adv-text-secondary, #64748b);
}

.shortlink-page__icon {
  font-size: 48px;
  opacity: 0.4;
}

.shortlink-page__error h2 {
  margin: 0;
  font-size: 20px;
  color: var(--adv-text-primary, #1a1a2e);
}

.shortlink-page__error p {
  max-width: 320px;
  line-height: 1.6;
  font-size: 14px;
  margin: 0;
}
</style>
