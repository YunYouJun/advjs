<script lang="ts" setup>
import type { FSDirItem, FSFileItem, FSItem } from '@advjs/gui'
import { Toast } from '@advjs/gui'
import consola from 'consola'
import { ref } from 'vue'

const tabList = ref([
  { title: 'Project', key: 'project', icon: 'i-ri-folder-fill' },
  { title: 'Console', key: 'console', icon: 'i-ri-terminal-box-fill' },
])

const curTab = ref('project')

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
const projectStore = useProjectStore()

// eslint-disable-next-line unused-imports/no-unused-vars
function onFSItemChange(item: FSItem) {
  // item.icon = 'i-ri-folder-fill'
}

function onFileClick(item: FSFileItem) {
  consola.info('onFileClick', item)
}

const fileStore = useFileStore()
function onFileDblClick(item: FSFileItem) {
  consola.info('onFileDblClick', item)
  if (item.handle) {
    fileStore.setOpenedFileHandle(item.handle)
  }
  else {
    Toast({
      title: 'Warning',
      description: 'This file is not supported',
      type: 'warning',
    })
  }
}

/**
 * 校验项目目录内容
 */
async function beforeOpenRootDir(dirHandle: FileSystemDirectoryHandle) {
  const files = dirHandle.values()
  // valid adv project
  type ProjectFileName = 'adv.config.json' | 'index.adv.json'
  const projectFiles: Record<ProjectFileName, FileSystemFileHandle> = {
    'adv.config.json': undefined!,
    'index.adv.json': undefined!,
  }
  for await (const file of files) {
    if (file.kind === 'file') {
      const fileName = file.name
      switch (fileName) {
        case 'adv.config.json':
        case 'index.adv.json':
          projectFiles[fileName] = file
          break
        default:
          break
      }
    }
  }

  if (projectFiles['index.adv.json'] && projectFiles['adv.config.json']) {
    // set config firstly
    await projectStore.setAdvConfigFileHandle(projectFiles['adv.config.json'])
    await projectStore.setEntryFileHandle(projectFiles['index.adv.json'])
    return true
  }
  else {
    Toast({
      title: 'Error',
      description: 'This is not a valid adv project. `index.adv.json` is required',
      type: 'error',
    })
    return false
  }
}

/**
 * open adv project root dir
 */
function onOpenRootDir(dir?: FSDirItem) {
  consola.debug('onOpenRootDir', dir)
  // console.log('onOpenRootDir', dir)
  // cache
}
</script>

<template>
  <AGUIPanel w="full" h="full">
    <AGUITabs v-model="curTab" :list="tabList">
      <AGUITabPanel value="project">
        <AGUIAssetsExplorer
          id="adv-explorer"
          v-model:cur-dir="curDir"
          v-model:root-dir="projectStore.rootDir"
          :before-open-root-dir="beforeOpenRootDir"
          :on-file-drop="onFileDrop"
          :on-f-s-item-change="onFSItemChange"
          :on-file-click="onFileClick"
          :on-file-dbl-click="onFileDblClick"
          :on-open-root-dir="onOpenRootDir"
        />
        <slot name="project" />
      </AGUITabPanel>
      <AGUITabPanel value="console">
        <slot name="console">
          <AEViewConsole />
        </slot>
      </AGUITabPanel>
      <slot />
    </AGUITabs>
  </AGUIPanel>
</template>
