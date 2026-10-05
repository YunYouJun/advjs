<script setup lang="ts">
import InspectorFileView from './InspectorFileView.vue'

const app = useAppStore()
const fileStore = useFileStore()
</script>

<template>
  <InspectorFileView
    v-if="app.activeInspector === 'file'"
    :file-handle="fileStore.openedFileHandle"
  />
  <AEInspectorCharacter v-else-if="app.activeInspector === 'character' || app.activeInspector === 'character-create'" />
  <InspectorView v-else />
</template>
