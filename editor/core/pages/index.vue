<script setup lang="ts">
definePageMeta({
  layout: 'editor',
})
</script>

<template>
  <main>
    <PanelInspector absolute right-0 />
    <div absolute left-0 top-0 flex h="2/3" w="3/4">
      <PanelHierarchy />
      <PanelScene />
    </div>
    <PanelProject />
  </main>
</template>
