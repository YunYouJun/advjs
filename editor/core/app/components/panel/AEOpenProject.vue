<script setup lang="ts">
import AGUIButton from '@advjs/gui/components/button/AGUIButton.vue'
import { PROJECT_TEMPLATES } from '~/composables/useCreateProject'
import AEOpenAdvConfigFile from './AEOpenAdvConfigFile.vue'
import ProjectAction from './ProjectAction.vue'

const { locale } = useI18n()
const zh = computed(() => locale.value === 'zh-CN')
const templateLabels: Record<string, [string, string]> = {
  'adv-md': ['Markdown adventure', 'Write with ADV Markdown'],
  'flow': ['Flow graph', 'Visual JSON nodes'],
  'blank': ['Blank project', 'Basic configuration'],
}
const templates = computed(() => PROJECT_TEMPLATES.map(item => ({ ...item, name: zh.value ? item.name : templateLabels[item.id]?.[0] ?? item.name, desc: zh.value ? item.desc : templateLabels[item.id]?.[1] ?? item.desc })))

const { createAndLoadProject, isCreating } = useCreateProject()
const { recentProjects, addRecentProject, removeRecentProject } = useRecentProjects()
const projectStore = useProjectStore()

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

/**
 * open adv project
 * Opens a standard Markdown project directory.
 */
function openAdvProject() {
  // trigger open directory dialog
  const advExplorerDom = document.querySelector('#adv-explorer')
  const openDirBtn = advExplorerDom?.querySelector('.agui-open-directory') as HTMLElement
  if (openDirBtn) {
    openDirBtn.click()
  }
}

/**
 * re-open a recent project (user must re-select directory for permission)
 */
async function reopenRecentProject(project: { name: string, templateId: string }) {
  try {
    const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' })

    await projectStore.openBrowserProject(dirHandle)

    addRecentProject({
      name: dirHandle.name,
      templateId: project.templateId,
    })
  }
  catch {
    // user cancelled directory picker
  }
}

function formatTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1)
    return zh.value ? '刚刚' : 'Just now'
  if (minutes < 60)
    return zh.value ? `${minutes} 分钟前` : `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24)
    return zh.value ? `${hours} 小时前` : `${hours} h ago`
  const days = Math.floor(hours / 24)
  if (days < 30)
    return zh.value ? `${days} 天前` : `${days} d ago`
  return new Date(timestamp).toLocaleDateString()
}

function getTemplateName(templateId: string): string {
  return templates.value.find(t => t.id === templateId)?.name ?? templateId
}
</script>

<template>
  <section class="project-start">
    <header><h2>ADV.JS Editor</h2><p>{{ zh ? '创建或打开一个项目，开始创作。' : 'Create or open a project to start writing.' }}</p></header>
    <section>
      <h3>{{ zh ? '新建项目' : 'New project' }}</h3>
      <div class="project-actions">
        <ProjectAction v-for="tpl in templates" :key="tpl.id" :label="tpl.name" :description="tpl.desc" :icon="tpl.icon" :disabled="isCreating" @click="createAndLoadProject(tpl.id)" />
      </div>
    </section>
    <section v-if="recentProjects.length">
      <h3>{{ zh ? '最近项目' : 'Recent projects' }}</h3>
      <div v-for="project in recentProjects" :key="project.name + project.lastOpenedAt" class="recent-project">
        <ProjectAction :label="project.name" :description="`${getTemplateName(project.templateId)} · ${formatTimeAgo(project.lastOpenedAt)}`" icon="i-ri-folder-3-line" @click="reopenRecentProject(project)" />
        <AGUIButton variant="text" icon="i-ri-close-line" :aria-label="`${zh ? '移除' : 'Remove'} ${project.name}`" :title="zh ? '移除' : 'Remove'" @click="removeRecentProject(project.name)" />
      </div>
    </section>
    <section>
      <h3>{{ zh ? '打开项目' : 'Open project' }}</h3>
      <div class="project-actions">
        <ProjectAction :label="zh ? '打开本地项目' : 'Open local project'" :description="zh ? '选择项目文件夹' : 'Choose a project folder'" icon="i-ri-folder-open-line" @click="openAdvProject" />
        <ProjectAction :label="zh ? '新建 ADV Markdown' : 'New ADV Markdown'" :description="zh ? '创建 .adv.md 剧本文件' : 'Create an .adv.md script'" icon="i-ri-file-add-line" @click="createAdvMarkdownFile" />
      </div>
      <AEOpenAdvConfigFile />
    </section>
  </section>
</template>

<style scoped>
.project-start {
  width: 100%;
  max-width: 720px;
  max-height: 100%;
  overflow: auto;
  padding: 16px;
  margin: auto;
  font-size: 13px;
  color: var(--agui-c-text-1);
}
h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}
header p {
  color: var(--agui-c-text-2);
  margin: 4px 0 16px;
}
h3 {
  margin: 16px 0 4px;
  padding-bottom: 4px;
  border-bottom: 1px solid var(--agui-c-divider);
  font-size: 12px;
  font-weight: 600;
}
.project-actions {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(220px, 100%), 1fr));
  gap: 4px;
}
.recent-project {
  display: flex;
  align-items: center;
  gap: 4px;
}
.recent-project > :first-child {
  flex: 1;
}
</style>
