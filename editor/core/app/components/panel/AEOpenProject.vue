<script setup lang="ts">
import { PROJECT_TEMPLATES } from '~/composables/useCreateProject'
import { useDesktopStore } from '../../stores/useDesktopStore'
import AEProjectTemplates from '../project/AEProjectTemplates.vue'
import AERecentProjects from '../project/AERecentProjects.vue'
import AEOpenAdvConfigFile from './AEOpenAdvConfigFile.vue'
import AEProjectRecovery from './AEProjectRecovery.vue'
import ProjectAction from './ProjectAction.vue'

defineProps<{ fullPage?: boolean }>()
const { locale } = useI18n()
const zh = computed(() => locale.value === 'zh-CN')
const desktop = import.meta.client && !!window.advDesktop
const desktopStore = useDesktopStore()
const legacyTemplates = computed(() => PROJECT_TEMPLATES.filter(item => item.category === 'legacy'))
const openedPaths = computed(() => desktopStore.projects.opened.map(item => item.path))
const opening = shallowRef(false)

const { createAndLoadProject, isCreating } = useCreateProject()
const { recentProjects, reopenRecentProject, removeRecentProject } = useRecentProjects()
const projectStore = useProjectStore()
const dialogs = useDialogStore()
const disabled = computed(() => opening.value || isCreating.value || projectStore.isRestoringProject)

const res = useFileSystemAccess({
  dataType: 'Text',
  types: [{
    description: 'ADV Markdown Chapter',
    accept: {
      'text/markdown': ['.adv.md'],
    },
  }],
  excludeAcceptAllOption: true,
})

/**
 * Create an `*.adv.md` chapter file.
 */
async function createAdvMarkdownFile() {
  await res.create()
}
function openDocumentation(event: MouseEvent) {
  if (window.advDesktop) {
    event.preventDefault()
    void window.advDesktop.openDocumentation().catch(error => useConsoleStore().error('无法打开文档', { error }))
  }
}

/**
 * open adv project
 * Opens a standard Markdown project directory.
 */
async function openAdvProject() {
  if (disabled.value)
    return
  opening.value = true
  try {
    if (window.advDesktop)
      return await window.advDesktop.openProject()
    const directory = await window.showDirectoryPicker({ mode: 'readwrite' })
    await projectStore.openBrowserProject(directory)
  }
  catch (error) {
    if (!(error instanceof DOMException) || error.name !== 'AbortError')
      useConsoleStore().error('Could not open project', { error })
  }
  finally {
    opening.value = false
  }
}
</script>

<template>
  <section class="project-welcome" :class="{ 'is-full-page': fullPage }" :aria-label="zh ? '欢迎页' : 'Welcome'">
    <div class="project-start">
      <header class="welcome-header">
        <span class="welcome-brand"><span class="i-ri-book-open-line" aria-hidden="true" /> ADV.JS Editor</span>
        <h1 class="welcome-title">
          {{ zh ? '开始你的故事' : 'Start your story' }}
        </h1>
        <p class="welcome-description">
          {{ zh ? '从示例开始，或为你的下一部作品创建项目。' : 'Explore an example, or start your next adventure.' }}
        </p>
        <div class="welcome-actions">
          <AGUIButton icon="i-ri-folder-open-line" :disabled="disabled" :loading="opening" @click="openAdvProject">
            {{ zh ? '打开本地项目' : 'Open local project' }}
          </AGUIButton>
          <AGUIButton v-if="desktop && desktopStore.projects.opened.length" variant="text" :disabled="disabled" icon="i-ri-window-line" @click="desktopStore.switcherOpen = true">
            {{ zh ? '切换已打开项目' : 'Switch open project' }}
          </AGUIButton>
        </div>
      </header>
      <AEProjectRecovery :status="projectStore.recoveryStatus" :project-name="projectStore.pendingProject" :error="projectStore.recoveryError" @retry="projectStore.retryProjectRecovery" />
      <div class="welcome-columns">
        <AEProjectTemplates :disabled="disabled" :creating="isCreating" @create="createAndLoadProject" />
        <AERecentProjects :projects="recentProjects" :disabled="disabled" :opened-paths="openedPaths" :error="projectStore.recentProjectError" @reopen="reopenRecentProject" @remove="removeRecentProject" />
      </div>
      <AGUIDetails :title="zh ? '更多打开方式' : 'More ways to start'" class="welcome-more">
        <div class="project-actions">
          <ProjectAction v-for="tpl in legacyTemplates" :key="tpl.id" :label="zh ? `${tpl.name}（旧格式）` : tpl.nameEn ?? tpl.name" :description="zh ? '用于已有 JSON 节点工程' : tpl.descEn" :icon="tpl.icon" :disabled="disabled" @click="createAndLoadProject(tpl.id)" />
          <ProjectAction v-if="!desktop" :label="zh ? '新建 ADV Markdown' : 'New ADV Markdown'" :description="zh ? '创建 .adv.md 剧本文件' : 'Create an .adv.md script'" icon="i-ri-file-add-line" @click="createAdvMarkdownFile" />
        </div>
        <AEOpenAdvConfigFile v-if="!desktop" />
      </AGUIDetails>
      <div class="welcome-footer">
        <a href="https://docs.advjs.org/guide/editor/desktop" target="_blank" rel="noopener noreferrer" @click="openDocumentation">{{ zh ? '使用文档' : 'Documentation' }}</a>
        <AGUIButton variant="text" icon="i-ri-settings-3-line" @click="dialogs.openStates.preferences = true">
          {{ zh ? '偏好设置' : 'Preferences' }}
        </AGUIButton>
      </div>
    </div>
  </section>
</template>

<style scoped>
.project-welcome {
  flex: 1;
  min-height: 0;
  overflow: auto;
  container-type: inline-size;
  color: var(--agui-c-text-1);
  font-size: 13px;
}
.project-start {
  width: 100%;
  max-width: 920px;
  box-sizing: border-box;
  padding: 16px;
  margin: auto;
}
.is-full-page {
  display: flex;
  background: var(--agui-c-bg-soft);
}
.is-full-page .project-start {
  padding: 32px;
}
.welcome-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--agui-c-text-2);
}
.welcome-brand > span {
  color: var(--agui-c-link);
  font-size: 20px;
}
.welcome-title {
  margin: 12px 0 4px;
  font-size: 24px;
  font-weight: 600;
}
.welcome-description {
  margin: 0 0 16px;
  color: var(--agui-c-text-2);
  line-height: 1.6;
}
.welcome-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 24px;
}
.welcome-columns {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
  gap: 32px;
}
.welcome-columns > :deep(.recent-projects) {
  padding-left: 24px;
  border-left: 1px solid var(--agui-c-divider-light);
}
.welcome-columns :deep(.recent-projects-title) {
  margin: 0;
  font-size: 13px;
  padding-bottom: 8px;
  border: 0;
}
.project-actions {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(220px, 100%), 1fr));
  gap: 4px;
}
.welcome-more {
  margin-top: 24px;
}
.welcome-footer {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 16px;
  font-size: 12px;
}
.welcome-footer a {
  color: var(--agui-c-link);
}
.welcome-footer a:focus-visible {
  outline: 2px solid var(--agui-c-focus);
}
@container (max-width: 640px) {
  .project-start,
  .is-full-page .project-start {
    padding: 16px;
  }
  .welcome-columns {
    grid-template-columns: minmax(0, 1fr);
    gap: 24px;
  }
  .welcome-columns > :deep(.recent-projects) {
    padding-left: 0;
    border-left: 0;
  }
}
</style>
