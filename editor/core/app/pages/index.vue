<script setup lang="ts">
import { AGUIToast, Toast, toastRef } from '@advjs/gui'
import { useStorage } from '@vueuse/core'

definePageMeta({
  layout: 'editor',
})

const app = useAppStore()
const { initLocale } = useEditorLocale()

const showSplash = ref(true)
const showOnboarding = ref(false)
const onboarded = useStorage('advjs:editor:onboarded', false)

// Restore saved locale on load
initLocale()

function onSplashComplete() {
  showSplash.value = false

  if (!onboarded.value) {
    showOnboarding.value = true
  }
  else {
    Toast({
      title: 'Hello!',
      description: 'Welcome to preview ADV.JS Editor!',
      duration: 3000,
    })
  }
}
</script>

<template>
  <main class="h-screen w-screen flex flex-col">
    <AEEditorSplash :show="showSplash" @complete="onSplashComplete" />

    <EditorMenubar />
    <EditorToolbar />

    <AGUILayout v-model:layout="app.layout" class="advjs-editor-layout flex">
      <template #right>
        <PanelInspector />
      </template>

      <template #hierarchy>
        <PanelHierarchy />
      </template>

      <template #scene>
        <PanelScene />
      </template>

      <template #project>
        <PanelProject />
      </template>
    </AGUILayout>

    <AEOnboardingDialog v-model:open="showOnboarding" />
    <AGUIToast ref="toastRef" />
  </main>
</template>

<style lang="scss">
.advjs-editor-layout {
  --agui-menu-bar-height: 26px;
  --agui-toolbar-height: 28px;

  height: calc(100% - var(--agui-menu-bar-height) - var(--agui-toolbar-height));
}
</style>
