<script setup lang="ts">
import { onMounted } from 'vue'
import { getOptIn, setOptIn } from '../utils/telemetry'

/**
 * Silent privacy default.
 *
 * Historically this component showed a one-time alert on first launch asking
 * the user whether to enable anonymous telemetry. That UX created friction
 * (and made the App Store reviewer path noisier than necessary), so we now
 * default-deny on first launch and surface the toggle inside
 * `Me → Privacy` (`SettingsPrivacyPage.vue`) where users can opt in any time.
 *
 * Privacy contract is unchanged:
 * - Default OFF — no events leave the device unless the user explicitly
 *   flips the switch in the privacy settings page.
 * - User's choice persists in `localStorage` (`advjs-studio:telemetry-opt-in`).
 *
 * This component intentionally renders nothing; it exists only to seed the
 * default `'deny'` value if the user has never made a choice.
 */
onMounted(() => {
  if (getOptIn() === 'unset')
    setOptIn('deny')
})
</script>

<template>
  <span class="telemetry-opt-in-prompt" aria-hidden="true" />
</template>
