<template>
  <div
    class="adv-icon-button display-history-button"
    @click="app.toggleHistory"
  >
    <AdvIcon><i-ri-message-2-line /></AdvIcon>
  </div>
</template>

<script setup lang="ts">
import { useAppStore } from '~/stores/app'
const app = useAppStore()
</script>
