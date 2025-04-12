<script lang="ts" setup>
import type { FSDirItem, FSFileItem, FSItem } from '@advjs/gui'
import { Toast } from '@advjs/gui'
import consola from 'consola'
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

const curDir = shallowRef<FSDirItem>()
const rootDir = shallowRef<FSDirItem>()

// eslint-disable-next-line unused-imports/no-unused-vars
function onFSItemChange(item: FSItem) {
  // item.icon = 'i-ri-folder-fill'
}

function onFileClick(item: FSFileItem) {
  consola.info('onFileClick', item)
}

const app = useAppStore()
const fileStore = useFileStore()
function onFileDblClick(item: FSFileItem) {
  consola.info('onFileDblClick', item)
  if (item.name.endsWith('.json')) {
    app.activeInspector = 'file'
    fileStore.openedFileHandle = item.handle
  }
  else {
    Toast({
      title: 'Warning',
      description: 'This file is not supported',
      type: 'warning',
    })
  }
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
          :on-file-click="onFileClick"
          :on-file-dbl-click="onFileDblClick"
        />
        <slot name="project" />
      </AGUITabPanel>
      <AGUITabPanel>
        <slot name="console">
          <AEViewConsole />
        </slot>
      </AGUITabPanel>
      <slot />
    </AGUITabs>
  </AGUIPanel>
</template>
