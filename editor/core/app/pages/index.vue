<script setup lang="ts">
import { AGUIToast, Toast, toastRef } from '@advjs/gui'
import { useAppStore } from '../composables'

definePageMeta({
  layout: 'editor',
})

const app = useAppStore()

onMounted(() => {
  Toast({
    title: 'Hello!',
    description: 'Welcome to preview ADV.JS Editor!',
    duration: 3000,
  })
})
</script>

<template>
  <main class="h-screen w-screen flex flex-col">
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
