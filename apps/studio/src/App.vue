<script setup lang="ts">
import { IonApp, IonRouterOutlet } from '@ionic/vue'
import { onMounted } from 'vue'
import ErrorBoundary from './components/ErrorBoundary.vue'
import OfflineBanner from './components/OfflineBanner.vue'
import OnboardingOverlay from './components/OnboardingOverlay.vue'
import TelemetryOptInPrompt from './components/TelemetryOptInPrompt.vue'
import UpdatePrompt from './components/UpdatePrompt.vue'
import { useOnboardingTour } from './composables/useOnboardingTour'

const { autoStart } = useOnboardingTour()
onMounted(() => autoStart())
</script>

<template>
  <IonApp>
    <OfflineBanner />
    <ErrorBoundary>
      <IonRouterOutlet />
    </ErrorBoundary>
    <OnboardingOverlay />
    <UpdatePrompt />
    <TelemetryOptInPrompt />
  </IonApp>
</template>
