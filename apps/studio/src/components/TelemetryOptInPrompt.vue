<script setup lang="ts">
import { alertController } from '@ionic/vue'
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { getOptIn, setOptIn } from '../utils/telemetry'

const { t } = useI18n()

/**
 * Show a one-time alert on first launch asking the user whether to enable
 * anonymous telemetry. Privacy default is OFF — no events are sent until the
 * user explicitly chooses "Allow".
 *
 * The user's choice persists in localStorage; this component is a no-op on
 * subsequent launches once they have answered.
 */
async function maybePrompt() {
  if (getOptIn() !== 'unset')
    return
  const alert = await alertController.create({
    header: t('telemetry.optInTitle'),
    message: t('telemetry.optInMessage'),
    backdropDismiss: false,
    buttons: [
      {
        text: t('telemetry.optOut'),
        role: 'cancel',
        handler: () => setOptIn('deny'),
      },
      {
        text: t('telemetry.optIn'),
        role: 'confirm',
        handler: () => setOptIn('allow'),
      },
    ],
  })
  await alert.present()
}

onMounted(() => {
  // Delay slightly so the prompt doesn't fight with onboarding overlays.
  setTimeout(() => {
    void maybePrompt()
  }, 1500)
})
</script>

<template>
  <span class="telemetry-opt-in-prompt" aria-hidden="true" />
</template>
