<script setup lang="ts">
import { configureAudioAssets } from '@advjs/client'
import { initAdvContext, initAdvData } from '@advjs/client/compiler'
import { advConfigSymbol, gameConfigSymbol, themeConfigSymbol } from '@advjs/core'
import { mountCssVarsRootStyle } from '@advjs/gui/client'
import { useDesktopHost } from '~/composables/useDesktopHost'
import { appName } from '~/constants'
import { injectionAdvContext } from '../../../packages/client/constants'

import { useEditorExtensions } from './composables/useEditorExtensions'
import './styles'

const colorMode = useColorMode()
// Portalled AGUI menus and dialogs must inherit the same theme as the workspace.
useHead(() => ({ htmlAttrs: { class: colorMode.value === 'dark' ? 'dark' : '' } }))

useHead({
  title: appName,
})

const consoleStore = useConsoleStore()
const capabilities = useEditorCapabilities()

if (capabilities.mode === 'local') {
  configureAudioAssets({
    popDownUrl: '',
    popUpOffUrl: '',
    popUpOnUrl: '',
  })
}

// advjs context
const nuxtApp = useNuxtApp()
const advContext = initAdvContext(initAdvData())
nuxtApp.vueApp.provide(injectionAdvContext, advContext)
nuxtApp.vueApp.provide(advConfigSymbol, advContext.config || {})
nuxtApp.vueApp.provide(gameConfigSymbol, advContext.gameConfig)
nuxtApp.vueApp.provide(themeConfigSymbol, advContext.themeConfig)
const projectStore = useProjectStore()
useEditorExtensions()
useDesktopHost()

onMounted(async () => {
  // @advjs/gui
  mountCssVarsRootStyle()

  consoleStore.info('ADVJS Context initialized.')
  if (await projectStore.connectLocalBridgeFromLaunch()) {
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}`)
    consoleStore.success('Local workspace connected')
  }
})

onBeforeUnmount(() => projectStore.disconnectLocalBridge())
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

  color: var(--agui-c-text-1);
  background: var(--agui-c-bg);
}
</style>
