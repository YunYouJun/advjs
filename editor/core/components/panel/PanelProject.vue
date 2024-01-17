<script lang="ts" setup>
import { type FSFileItem, curDir, saveFile } from '@advjs/gui/client'
import { ref } from 'vue'

const tabList = ref([
  { title: 'Project', key: 'project', icon: 'i-ri-folder-fill' },
  { title: 'Console', key: 'console', icon: 'i-ri-terminal-box-fill' },
])

async function onFileDrop(files: FSFileItem[]) {
  for (const file of files) {
    if (file.file)
      await saveFile(file.file, curDir.value?.handle)
  }
}
</script>

<template>
  <AGUIPanel w="full" h="full">
    <AGUITabs :list="tabList">
      <AGUITabPanel>
        <AGUIAssetsExplorer :on-file-drop="onFileDrop" />
        <slot name="project" />
      </AGUITabPanel>
      <AGUITabPanel>
        <slot name="console" />
      </AGUITabPanel>
      <slot />
    </AGUITabs>
  </AGUIPanel>
</template>
