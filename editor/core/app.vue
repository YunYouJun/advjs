<script setup lang="ts">
import { mountCssVarsRootStyle } from '@advjs/gui/client'
import { appName } from '~/constants'

useHead({
  title: appName,
})

onMounted(() => {
  mountCssVarsRootStyle()
})
</script>

<template>
  <VitePwaManifest />
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>

<style>
html,
body,
#__nuxt {
  height: 100vh;
  margin: 0;
  padding: 0;

  overflow: hidden;

  color: white;
  background: var(--agui-c-bg);
}
</style>
