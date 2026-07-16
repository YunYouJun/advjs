<script setup lang="ts">
import { useAdvContext } from '@advjs/client'
import { onMounted } from 'vue'

const isDev = import.meta.env.DEV
const { $adv } = useAdvContext()

onMounted(async () => {
  await $adv.init()
  await $adv.runtime.start()
})
</script>

<template>
  <AdvGame />
  <AdvDevTools v-if="isDev" />
</template>

<route lang="yaml">
meta:
  layout: adv
</route>
