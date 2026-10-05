<script setup lang="ts">
import { configureAudioAssets } from '@advjs/client'
import { initAdvContext, initAdvData } from '@advjs/client/compiler'
import { advConfigSymbol, gameConfigSymbol, themeConfigSymbol } from '@advjs/core'
import { Toast } from '@advjs/gui'
import { mountCssVarsRootStyle } from '@advjs/gui/client'
import { useEventListener } from '@vueuse/core'
import { appName } from '~/constants'
import { injectionAdvContext } from '../../../packages/client/constants'

import { useEditorLocale } from './composables/useEditorLocale'
import { useLocalWorkspaceView } from './composables/useLocalWorkspaceView'
import './styles'

const { locale, savedLocale, initLocale } = useEditorLocale()
useHead(() => ({
  title: appName,
  htmlAttrs: { lang: locale.value },
}))
watch(savedLocale, () => void initLocale())
useEventListener('languagechange', () => void initLocale())

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
const workspaceView = useLocalWorkspaceView()
const { t } = useI18n()

onMounted(async () => {
  await initLocale()
  // @advjs/gui
  mountCssVarsRootStyle()

  consoleStore.info('ADVJS Context initialized.')
  try {
    if (await projectStore.connectLocalBridgeFromLaunch()) {
      window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}`)
      await workspaceView.restore()
      consoleStore.success('Local workspace connected')
    }
  }
  catch (error) {
    consoleStore.error('Local workspace connection failed', { error: String(error) })
    Toast({ title: t('workspace.openFailed'), description: t('workspace.reconnectLocal'), type: 'error' })
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

  color: white;
  background: var(--agui-c-bg);
}
</style>
