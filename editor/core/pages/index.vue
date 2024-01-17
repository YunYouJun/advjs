<script setup lang="ts">
import { useAppStore } from '~/composables'

definePageMeta({
  layout: 'editor',
})

const app = useAppStore()
</script>

<template>
  <main class="h-screen w-screen flex flex-col">
    <AGUIMenubar />
    <EditorToolbar />

    <AGUILayout v-model:layout="app.layout" class="flex">
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
  </main>
</template>
