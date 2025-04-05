<script setup lang="ts">
import { advConfigSymbol, gameConfigSymbol, themeConfigSymbol } from '@advjs/core'
import { mountCssVarsRootStyle } from '@advjs/gui/client'
import { appName } from '~/constants'

import { injectionAdvContext } from '../../../packages/client/constants'
import { initAdvContext } from '../../../packages/client/runtime'
import './styles'

useHead({
  title: appName,
})

onMounted(() => {
  mountCssVarsRootStyle()
})

const gameStore = useGameStore()

// advjs context
const nuxtApp = useNuxtApp()
const advContext = initAdvContext(gameStore.gameConfig)
nuxtApp.vueApp.provide(injectionAdvContext, advContext)
nuxtApp.vueApp.provide(advConfigSymbol, advContext.config || {})
nuxtApp.vueApp.provide(gameConfigSymbol, advContext.gameConfig)
nuxtApp.vueApp.provide(themeConfigSymbol, advContext.themeConfig)
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
