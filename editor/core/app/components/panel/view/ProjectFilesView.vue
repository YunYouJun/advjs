<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import { useProjectAssetActions } from '../../../composables/useProjectAssetActions'
import { useProjectFileActions } from '../../../composables/useProjectFileActions'
import { useAssetBrowserStore } from '../../../stores/useAssetBrowserStore'
import { isProjectAsset } from '../../../utils/asset-browser'
import ProjectFileTree from '../../project/ProjectFileTree.vue'

const project = useProjectStore()
const app = useAppStore()
const desktop = import.meta.client && !!window.advDesktop
const file = useFileStore()
const assets = useAssetBrowserStore()
const { open } = useProjectFileActions()
const { showInAssets } = useProjectAssetActions()
const { locale } = useEditorLocale()
const zh = computed(() => locale.value === 'zh-CN')
const query = shallowRef('')
const selectedPath = shallowRef(assets.projectRevealPath || file.openedFilePath)
const revealVersion = shallowRef(assets.projectRevealVersion)
watch(() => file.openVersion, () => selectedPath.value = file.openedFilePath)
watch(() => assets.projectRevealVersion, () => {
  query.value = ''
  selectedPath.value = assets.projectRevealPath
  revealVersion.value++
})
watch(() => project.workspace, () => selectedPath.value = '')
const noMatches = computed(() => !project.localFilePaths.some(path => path.toLocaleLowerCase().includes(query.value.trim().toLocaleLowerCase())))
</script>

<template>
  <section class="project-files">
    <template v-if="project.project">
      <header class="project-summary">
        <span v-if="!desktop" class="project-name" :title="project.rootDir?.name">{{ project.rootDir?.name }}</span>
        <span class="project-status">{{ zh ? (project.workspaceMode === 'local' ? '本地工作区 · 实时同步' : '浏览器工作区') : (project.workspaceMode === 'local' ? 'Live local workspace' : 'Browser workspace') }}</span>
        <div class="project-counts">
          <span>{{ project.chapters.length }} {{ zh ? '个章节' : 'chapters' }}</span>
          <span>{{ project.characters.length }} {{ zh ? '位人物' : 'characters' }}</span>
          <span>{{ project.scenes.length }} {{ zh ? '个场景' : 'scenes' }}</span>
        </div>
      </header>
      <AGUIToolbar :items="[]" :label="zh ? '项目文件' : 'Project files'">
        <template #before-toolbar>
          <AGUIInput v-model="query" class="project-search" :aria-label="zh ? '搜索项目文件' : 'Search project files'" :placeholder="zh ? '搜索文件…' : 'Search files…'" />
        </template>
        <template #after-toolbar>
          <AGUIIconButton icon="i-ri-gallery-line" :title="zh ? '在素材中显示' : 'Show in Assets'" :disabled="!isProjectAsset(selectedPath)" @click="showInAssets(selectedPath)" />
        </template>
      </AGUIToolbar>
      <div class="project-tree">
        <ProjectFileTree :paths="project.localFilePaths" :selected="selectedPath" :reveal-version="revealVersion" :query="query" :label="zh ? '项目文件' : 'Project files'" @open="open" />
        <p v-if="noMatches" class="project-empty" role="status">
          {{ zh ? '没有匹配的文件' : 'No matching files' }}
        </p>
      </div>
    </template>
    <div v-else-if="desktop" class="project-empty">
      <p>{{ zh ? '未打开项目' : 'No open project' }}</p>
      <AGUIButton icon="i-ri-home-line" @click="app.showEmptyWorkspace = false">
        {{ zh ? '打开欢迎页' : 'Open welcome page' }}
      </AGUIButton>
    </div>
    <AEOpenProject v-else />
  </section>
</template>

<style scoped>
.project-files {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  font-size: 12px;
}
.project-summary {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
  border-bottom: 1px solid var(--agui-c-divider);
}
.project-name {
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.project-status {
  color: var(--agui-c-text-2);
  overflow-wrap: anywhere;
}
.project-counts {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  color: var(--agui-c-text-2);
}
.project-search {
  flex: 1;
  min-width: 100px;
}
.project-tree {
  flex: 1;
  min-height: 0;
  overflow: auto;
}
.project-empty {
  padding: 8px;
  color: var(--agui-c-text-2);
}
</style>
