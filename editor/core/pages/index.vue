<script setup lang="ts">
import { useAppStore } from '~/composables'

definePageMeta({
  layout: 'editor',
})

const app = useAppStore()
</script>

<template>
  <main class="h-screen w-screen">
    <div>
      <AGUIMenubar />
    </div>

    <EditorToolbar />

    <AGUILayout v-model:layout="app.layout">
      <template #right>
        <PanelInspector />
      </template>

      <template #hierarchy>
        <PanelHierarchy />
      </template>

      <template #scene>
        <PanelScene />
      </template>

      <template #left-bottom>
        <PanelProject />
      </template>
    </AGUILayout>
  </main>
</template>
