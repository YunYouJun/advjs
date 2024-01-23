<script lang="ts" setup>
import type { FSDirItem, FSFileItem, FSItem } from '@advjs/gui'
import { ref } from 'vue'

const tabList = ref([
  { title: 'Project', key: 'project', icon: 'i-ri-folder-fill' },
  { title: 'Console', key: 'console', icon: 'i-ri-terminal-box-fill' },
])

async function onFileDrop(files: FSFileItem[]) {
  // const curDir = explorerRef.value?.curDir
  // console.log(curDir)
  // console.log(curDir.value?.handle)

  // for (const file of files) {
  //   if (file.file)
  //     await saveFile(file.file, curDir.value.handle)
  // }
  return files
}

const curDir = ref<FSDirItem>()
const rootDir = ref<FSDirItem>()

// eslint-disable-next-line unused-imports/no-unused-vars
function onFSItemChange(item: FSItem) {
  // item.icon = 'i-ri-folder-fill'
}
</script>

<template>
  <AGUIPanel w="full" h="full">
    <AGUITabs :list="tabList">
      <AGUITabPanel>
        <AGUIAssetsExplorer
          v-model:cur-dir="curDir"
          v-model:root-dir="rootDir"
          :on-file-drop="onFileDrop"
          :on-f-s-item-change="onFSItemChange"
        />
        <slot name="project" />
      </AGUITabPanel>
      <AGUITabPanel>
        <slot name="console" />
      </AGUITabPanel>
      <slot />
    </AGUITabs>
  </AGUIPanel>
</template>
