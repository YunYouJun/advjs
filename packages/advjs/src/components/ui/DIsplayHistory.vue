<template>
  <div
    class="adv-icon-button display-history-button"
    @click="app.toggleHistory"
  >
    <!-- <icon-font name="message-2-line" color="white" size="3rem"></icon-font> -->
    <ri-message-2-line />
  </div>
</template>

<script setup lang="ts">
import { useAppStore } from '~/stores/app'
const app = useAppStore()
</script>
