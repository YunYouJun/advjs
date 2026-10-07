<script setup lang="ts">
import { configureAudioAssets } from '@advjs/client'
import { initAdvContext, initAdvData } from '@advjs/client/compiler'
import { advConfigSymbol, gameConfigSymbol, themeConfigSymbol } from '@advjs/core'
import { mountCssVarsRootStyle } from '@advjs/gui/client'
import { useDesktopHost } from '~/composables/useDesktopHost'
import { useDesktopWorkspaceState } from '~/composables/useDesktopWorkspaceState'
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
const desktop = import.meta.client && !!window.advDesktop
const workspaceState = useDesktopWorkspaceState(extensions)
useDesktopHost({ ...extensions, captureState: workspaceState.capture, selectGame: () => extensions.layout.select('main', 'advjs.core/game') })
const removeRouteListener = useRouter().afterEach(() => projectStore.retainLocalBridgeSession())

// Register setup-bound composables before running asynchronous startup tasks.
const { initLocale } = useEditorLocale()
const { state: startupState, start: startEditor, dispose: disposeStartup } = createEditorStartup([
  { id: 'preferences', run: initLocale },
  { id: 'extensions', run: extensions.start },
  { id: 'workspace', run: async () => {
    await projectStore.restoreProjectWorkspace()
    if (projectStore.recoveryStatus === 'local-unavailable')
      throw projectStore.recoveryError ?? new Error('Project service unavailable. Check the service and retry.')
    await workspaceState.restore()
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
  removeRouteListener()
  projectStore.disconnectLocalBridge()
})
</script>

<template>
  <VitePwaManifest />
  <AEEditorSplash :show="startupState.status !== 'ready'" :state="startupState" @retry="startEditor" />
  <!-- Keep Nuxt's routing shell mounted while gating the actual workspace. -->
  <div class="editor-app-shell" :class="{ 'editor-app-desktop': desktop }">
    <div class="editor-app-content">
      <NuxtLayout :name="startupState.status === 'ready' ? undefined : false">
        <NuxtPage v-slot="{ Component }">
          <component :is="Component" v-if="startupState.status === 'ready'" />
        </NuxtPage>
      </NuxtLayout>
    </div>
    <AEStatusBar v-if="desktop && startupState.status === 'ready'" />
  </div>
  <AEGlobalNotifications />
  <AEProjectSwitcher v-if="desktop && startupState.status === 'ready'" />
  <AECreateProjectDialog v-if="desktop && startupState.status === 'ready'" />
  <AEGlobalDialogs v-if="startupState.status === 'ready'" />
</template>

<style>
.editor-app-shell {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}
.editor-app-content {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.editor-app-desktop {
  --agui-status-bar-height: 26px;
}
html:has(.editor-app-desktop) {
  --agui-status-bar-height: 26px;
}
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
