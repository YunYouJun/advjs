<template>
  <AdvIconButton class="display-history-button" @click="app.toggleHistory">
    <i-ri-message-2-line />
  </AdvIconButton>
</template>

<script setup lang="ts">
import { useAppStore } from '~/stores/app'
const app = useAppStore()
</script>
