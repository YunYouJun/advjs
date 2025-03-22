<script setup lang="ts">
import { onMounted } from 'vue'
import { useAdvConfig, useAdvContext } from '../composables'

const { $adv } = useAdvContext()
const advConfig = useAdvConfig()

const isDev = import.meta.env.DEV

onMounted(async () => {
  await $adv.init()
  await $adv.$nav.start('background_01')
})
</script>

<template>
  <AdvGame :config="advConfig" />
  <AdvDevTools v-if="isDev" />
</template>

<route lang="yaml">
meta:
  layout: adv
</route>
