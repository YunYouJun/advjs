<script lang="ts" setup>
import type { FSDirItem, FSFileItem, FSItem } from '@advjs/gui'
import { Toast } from '@advjs/gui'
import { parseCharacterMd } from '@advjs/parser'
import consola from 'consola'
import { ref } from 'vue'

const { t } = useI18n()
const tabList = computed(() => [
  { title: t('panels.project'), key: 'project', icon: 'i-ri-folder-fill' },
  { title: t('panels.console'), key: 'console', icon: 'i-ri-terminal-box-fill' },
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
const openingLocalFile = shallowRef(false)

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
  app.inspectorTab = 'inspector'

  if (fileStore.isDirty) {
    if (fileStore.openedFilePath === projectPath) {
      app.activeInspector = 'file'
      return
    }
    Toast({ title: t('workspace.unsaved'), description: t('workspace.saveBeforeOpening'), type: 'warning' })
    return
  }

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
        title: t('common.error'),
        description: t('workspace.parseCharacterFailed'),
        type: 'error',
      })
      return
    }
  }

  if (item.handle) {
    await fileStore.setOpenedFileHandle(item.handle, projectPath)
  }
  else {
    Toast({
      title: t('common.warning'),
      description: t('workspace.unsupportedFile'),
      type: 'warning',
    })
  }
}

async function onLocalFileClick(path: string) {
  if (openingLocalFile.value)
    return
  openingLocalFile.value = true
  try {
    const handle = await projectStore.getLocalFileHandle(path)
    await onFileDblClick({
      name: handle.name,
      kind: 'file',
      handle: handle as unknown as FileSystemFileHandle,
    }, path)
  }
  catch (error) {
    Toast({ title: t('workspace.openFailed'), description: error instanceof Error ? error.message : String(error), type: 'error' })
  }
  finally {
    openingLocalFile.value = false
  }
}

/**
 * 校验项目目录内容
 */
async function beforeOpenRootDir(dirHandle: FileSystemDirectoryHandle) {
  try {
    const project = await projectStore.openBrowserProject(dirHandle)
    if (project.mode === 'legacy-json') {
      Toast({
        title: t('workspace.migrationRequired'),
        description: project.migrationNotice,
        type: 'warning',
      })
      return false
    }
    return !project.compilation.diagnostics.some(item => item.severity === 'error')
  }
  catch (error) {
    Toast({
      title: t('common.error'),
      description: error instanceof Error ? error.message : t('workspace.openProjectFailed'),
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
            <span>{{ projectStore.workspaceMode === 'local' ? t('workspace.liveLocal') : t('workspace.browser') }}</span>
            <span>{{ t('workspace.chapterCount', { count: projectStore.chapters.length }) }}</span>
            <span>{{ t('workspace.characterCount', { count: projectStore.characters.length }) }}</span>
            <span>{{ t('workspace.sceneCount', { count: projectStore.scenes.length }) }}</span>
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
            :disabled="openingLocalFile"
            @click="onLocalFileClick(path)"
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
