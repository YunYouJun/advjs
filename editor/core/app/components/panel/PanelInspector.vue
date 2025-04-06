<script lang="ts" setup>
import { ref } from 'vue'
import InspectorFileView from './view/InspectorFileView.vue'

const tabList = ref([
  { title: 'Inspector', key: 'inspector', icon: 'i-ri-information-fill' },
])

const app = useAppStore()

const fileStore = useFileStore()
</script>

<template>
  <AGUIPanel h="full" w="full">
    <AGUITabs :list="tabList">
      <AGUITabPanel overflow="auto">
        <InspectorFileView
          v-if="app.activeInspector === 'file' && fileStore.openedFileHandle"
          :file-handle="fileStore.openedFileHandle"
        />
        <AEInspectorCharacter v-else-if="app.activeInspector === 'character'" />
        <InspectorView v-else />
      </AGUITabPanel>
    </AGUITabs>
  </AGUIPanel>
</template>
