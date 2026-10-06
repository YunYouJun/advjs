<script setup lang="ts">
import { configureAudioAssets } from '@advjs/client'
import { initAdvContext, initAdvData } from '@advjs/client/compiler'
import { advConfigSymbol, gameConfigSymbol, themeConfigSymbol } from '@advjs/core'
import { mountCssVarsRootStyle } from '@advjs/gui/client'
import { useDesktopHost } from '~/composables/useDesktopHost'
import { appName } from '~/constants'
import { injectionAdvContext } from '../../../packages/client/constants'

import { useEditorExtensions } from './composables/useEditorExtensions'
import { createEditorStartup } from './startup'
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
const extensions = useEditorExtensions()
useDesktopHost(extensions)

// Register setup-bound composables before running asynchronous startup tasks.
const { initLocale } = useEditorLocale()
const { state: startupState, start: startEditor, dispose: disposeStartup } = createEditorStartup([
  { id: 'preferences', run: initLocale },
  { id: 'extensions', run: extensions.start },
  { id: 'workspace', run: async () => {
    if (await projectStore.connectLocalBridgeFromLaunch()) {
      window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}`)
      consoleStore.success('Local workspace connected')
    }
  } },
])

onMounted(() => {
  // @advjs/gui
  mountCssVarsRootStyle()

  consoleStore.info('ADVJS Context initialized.')
  void startEditor()
})

onBeforeUnmount(() => {
  disposeStartup()
  projectStore.disconnectLocalBridge()
})
</script>

<template>
  <VitePwaManifest />
  <AEEditorSplash :show="startupState.status !== 'ready'" :state="startupState" @retry="startEditor" />
  <NuxtLayout v-if="startupState.status === 'ready'">
    <NuxtPage />
  </NuxtLayout>
  <AEGlobalDialogs v-if="startupState.status === 'ready'" />
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
