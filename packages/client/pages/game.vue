<script setup lang="ts">
// we need .adv.md
import { defineAsyncComponent } from 'vue'
import { useAdvConfig } from '../composables'

const advConfig = useAdvConfig()
const Drama = defineAsyncComponent(() =>
  advConfig.value.format === 'fountain'
    ? import('/@advjs/drama.adv.md')
    : import('../components/game/AdvGame.vue'))
</script>

<template>
  <Drama />
</template>

<route lang="yaml">
meta:
  layout: adv
</route>
