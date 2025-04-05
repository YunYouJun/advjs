<script lang="ts" setup>
import { ref } from 'vue'
import InspectorFileView from './view/InspectorFileView.vue'

const tabList = ref([
  { title: 'Inspector', key: 'inspector', icon: 'i-ri-information-fill' },
])

const fileStore = useFileStore()
</script>

<template>
  <AGUIPanel h="full" w="full">
    <AGUITabs :list="tabList">
      <AGUITabPanel overflow="auto">
        <InspectorView v-if="!fileStore.openedFile" />
        <InspectorFileView v-if="fileStore.openedFile" :file="fileStore.openedFile" />
      </AGUITabPanel>
    </AGUITabs>
  </AGUIPanel>
</template>
