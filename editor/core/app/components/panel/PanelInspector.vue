<script lang="ts" setup>
import { ref } from 'vue'
import InspectorFileView from './view/InspectorFileView.vue'

const tabList = ref([
  { title: 'Inspector', key: 'inspector', icon: 'i-ri-information-fill' },
  { title: 'Context', key: 'context', icon: 'i-ri-earth-line' },
])

const app = useAppStore()

const fileStore = useFileStore()
</script>

<template>
  <AGUIPanel h="full" w="full">
    <AGUITabs v-model="app.inspectorTab" :list="tabList" default-value="inspector">
      <AGUITabPanel overflow="auto" value="inspector">
        <InspectorFileView
          v-if="app.activeInspector === 'file'"
          :key="fileStore.openedFilePath"
          :file-handle="fileStore.openedFileHandle"
        />
        <AEInspectorCharacter v-else-if="app.activeInspector === 'character' || app.activeInspector === 'character-create'" />
        <InspectorView v-else />
      </AGUITabPanel>

      <AGUITabPanel overflow="auto" value="context">
        <ProjectContextView />
      </AGUITabPanel>
    </AGUITabs>
  </AGUIPanel>
</template>
