<script setup lang="ts">
import { onMounted } from 'vue'
import { useAdvConfig, useAdvContext } from '../composables'

const { $adv } = useAdvContext()
const advConfig = useAdvConfig()

const isDev = import.meta.env.DEV && !import.meta.env.ADVJS_EDITOR_PREVIEW

onMounted(async () => {
  await $adv.init()
  await $adv.runtime.start()
})
</script>

<template>
  <AdvGame class="h-screen w-screen" :frontmatter="advConfig" />
  <AdvDevTools v-if="isDev" />
</template>

<route lang="yaml">
meta:
  layout: adv
</route>
