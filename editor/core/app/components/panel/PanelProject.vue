<script lang="ts" setup>
import type { FSDirItem, FSFileItem, FSItem } from '@advjs/gui'
import { Toast } from '@advjs/gui'
import { parseCharacterMd } from '@advjs/parser'
import consola from 'consola'
import { ref } from 'vue'

const tabList = ref([
  { title: 'Project', key: 'project', icon: 'i-ri-folder-fill' },
  { title: 'Console', key: 'console', icon: 'i-ri-terminal-box-fill' },
])

const curTab = ref('project')

async function onFileDrop(files: FSFileItem[]) {
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
const characterStore = useCharacterStore()
const app = useAppStore()

function onRename(item: FSItem, newName: string) {
  consola.info('onRename', item.name, '->', newName)
}

function onDelete(items: FSItem[]) {
  consola.info('onDelete', items.map(i => i.name))
}

function onCreate(parentDir: FSDirItem, name: string, kind: 'file' | 'directory') {
  consola.info('onCreate', kind, name, 'in', parentDir.name)
}

async function onFileDblClick(item: FSFileItem) {
  consola.info('onFileDblClick', item)

  // Handle .character.md files → open in Inspector with CharacterForm
  if (item.name.endsWith('.character.md') && item.handle) {
    try {
      const file = await (item.handle as FileSystemFileHandle).getFile()
      const content = await file.text()
      const character = parseCharacterMd(content)
      characterStore.selectedCharacter = character
      characterStore.selectedCharacterHandle = item.handle as FileSystemFileHandle
      app.activeInspector = 'character'
      return
    }
    catch (e) {
      consola.error('Failed to parse character file:', e)
      Toast({
        title: 'Error',
        description: 'Failed to parse character file',
        type: 'error',
      })
      return
    }
  }

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
  for await (const entry of files) {
    if (entry.kind === 'file') {
      const fileName = entry.name
      switch (fileName) {
        case 'adv.config.json':
        case 'index.adv.json':
          projectFiles[fileName] = entry
          break
        default:
          break
      }
    }
    else if (entry.kind === 'directory' && entry.name === 'adv') {
      // index.adv.json moved to adv/index.adv.json
      for await (const subEntry of (entry as FileSystemDirectoryHandle).values()) {
        if (subEntry.kind === 'file' && subEntry.name === 'index.adv.json') {
          projectFiles['index.adv.json'] = subEntry
        }
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
      description: 'This is not a valid adv project. `adv.config.json` and `adv/index.adv.json` are required',
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
          :on-rename="onRename"
          :on-delete="onDelete"
          :on-create="onCreate"
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
