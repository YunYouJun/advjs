<script setup lang="ts">
definePageMeta({
  layout: 'editor',
})
</script>

<template>
  <main class="h-screen w-screen">
    <div>
      <AGUIMenuBar />
    </div>
    <AGUILayout>
      <template #right>
        <PanelInspector />
      </template>

      <template #left-top>
        <PanelHierarchy />
      </template>

      <PanelScene />

      <template #left-bottom>
        <PanelProject />
      </template>
    </AGUILayout>
  </main>
</template>
