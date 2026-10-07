<script setup lang="ts">
import { useAssetBrowserStore } from '../../../stores/useAssetBrowserStore'
import FilePropertiesView from './FilePropertiesView.vue'

const app = useAppStore()
const assets = useAssetBrowserStore()
</script>

<template>
  <FilePropertiesView
    v-if="app.activeInspector === 'file' || app.activeInspector === 'asset'"
    :asset="app.activeInspector === 'asset'" :path="assets.selectedPath"
  />
  <AEInspectorCharacter v-else-if="app.activeInspector === 'character' || app.activeInspector === 'character-create'" />
  <InspectorView v-else />
</template>
