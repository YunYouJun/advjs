<script setup lang="ts">
import { AGUIToast, Toast, toastRef } from '@advjs/gui'

definePageMeta({
  layout: 'editor',
})

const app = useAppStore()
const nativeMenu = import.meta.client && window.advDesktop?.nativeMenu === true
const { onboarded } = useEditorLocale()

const showOnboarding = ref(false)

// The root mounts this page only after preferences and workspace are ready.
onMounted(() => {
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
})
</script>

<template>
  <main class="flex flex-col h-screen w-screen" :class="{ 'has-native-menu': nativeMenu }">
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
.has-native-menu .advjs-editor-layout {
  --agui-menu-bar-height: 0px;
}

.advjs-editor-layout {
  --agui-menu-bar-height: 26px;
  --agui-toolbar-height: 28px;

  flex: 1;
  min-height: 0;
}
</style>
