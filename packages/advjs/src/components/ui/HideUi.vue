<template>
  <div
    class="adv-icon-button hide-ui-button"
    @click="app.toggleUi"
  >
    <!-- <icon-font name="eye-close-line" color="white" size="3rem"></icon-font> -->
    <ri-eye-close-line />
  </div>
</template>

<script setup lang="ts">
import { useAppStore } from '~/stores/app'
const app = useAppStore()
</script>
