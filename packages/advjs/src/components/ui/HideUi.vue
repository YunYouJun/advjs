<template>
  <div
    class="adv-icon-button hide-ui-button"
    @click="app.toggleUi"
  >
    <AdvIcon><i-ri-eye-close-line /></AdvIcon>
  </div>
</template>

<script setup lang="ts">
import { useAppStore } from '~/stores/app'
const app = useAppStore()
</script>
