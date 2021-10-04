<template>
  <AdvIconButton class="hide-ui-button" @click="app.toggleUi">
    <i-ri-eye-close-line />
  </AdvIconButton>
</template>

<script setup lang="ts">
import { useAppStore } from '~/stores/app'
const app = useAppStore()
</script>
