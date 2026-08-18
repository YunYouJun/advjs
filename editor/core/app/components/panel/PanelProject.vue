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
  if (projectStore.workspaceMode === 'local')
    return false
  consola.info('onRename', item.name, '->', newName)
}

function onDelete(items: FSItem[]) {
  if (projectStore.workspaceMode === 'local')
    return false
  consola.info('onDelete', items.map(i => i.name))
}

function onCreate(parentDir: FSDirItem, name: string, kind: 'file' | 'directory') {
  if (projectStore.workspaceMode === 'local')
    return false
  consola.info('onCreate', kind, name, 'in', parentDir.name)
}

function getProjectRelativePath(item: FSFileItem) {
  const segments = [item.name]
  let parent = item.parent
  while (parent?.parent) {
    segments.unshift(parent.name)
    parent = parent.parent
  }
  return segments.join('/')
}

async function onFileDblClick(item: FSFileItem, projectPath = getProjectRelativePath(item)) {
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
    fileStore.setOpenedFileHandle(item.handle, projectPath)
  }
  else {
    Toast({
      title: 'Warning',
      description: 'This file is not supported',
      type: 'warning',
    })
  }
}

async function onLocalFileDblClick(path: string) {
  const handle = await projectStore.getLocalFileHandle(path)
  await onFileDblClick({
    name: handle.name,
    kind: 'file',
    handle: handle as unknown as FileSystemFileHandle,
  }, path)
}

/**
 * 校验项目目录内容
 */
async function beforeOpenRootDir(dirHandle: FileSystemDirectoryHandle) {
  try {
    const project = await projectStore.openBrowserProject(dirHandle)
    if (project.mode === 'legacy-json') {
      Toast({
        title: 'Migration required',
        description: project.migrationNotice,
        type: 'warning',
      })
      return false
    }
    return !project.compilation.diagnostics.some(item => item.severity === 'error')
  }
  catch (error) {
    Toast({
      title: 'Error',
      description: error instanceof Error ? error.message : 'Failed to open Markdown project',
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
        <div v-if="projectStore.project" class="text-xs p-2 border-b border-white/8">
          <div class="mb-1 op-70 flex gap-3">
            <span>{{ projectStore.workspaceMode === 'local' ? 'Live local workspace' : 'Browser workspace' }}</span>
            <span>{{ projectStore.chapters.length }} chapters</span>
            <span>{{ projectStore.characters.length }} characters</span>
            <span>{{ projectStore.scenes.length }} scenes</span>
          </div>
          <div
            v-for="diagnostic in projectStore.diagnostics"
            :key="`${diagnostic.code}:${diagnostic.path}:${diagnostic.line}`"
            class="truncate"
            :class="diagnostic.severity === 'error' ? 'text-red-400' : 'text-amber-400'"
            :title="diagnostic.message"
          >
            {{ diagnostic.code }} · {{ diagnostic.path || 'project' }} · {{ diagnostic.message }}
          </div>
        </div>
        <div v-if="projectStore.workspaceMode === 'local'" class="p-2 h-full overflow-auto">
          <button
            v-for="path in projectStore.localFilePaths"
            :key="path"
            class="text-xs px-2 py-1 text-left rounded w-full block truncate hover:bg-white/8"
            :title="path"
            @dblclick="onLocalFileDblClick(path)"
          >
            <span i-ri-file-text-line class="mr-1 inline-block" />
            {{ path }}
          </button>
        </div>
        <AGUIAssetsExplorer
          v-else
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
