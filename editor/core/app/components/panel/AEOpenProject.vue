<script setup lang="ts">
import type { FSDirItem } from '@advjs/gui'
import { PROJECT_TEMPLATES } from '~/composables/useCreateProject'

const { createAndLoadProject, isCreating } = useCreateProject()
const { recentProjects, addRecentProject, removeRecentProject } = useRecentProjects()
const projectStore = useProjectStore()
const fileStore = useFileStore()

const res = useFileSystemAccess({
  dataType: 'Text',
  types: [{
    description: 'ADV Project Entry',
    accept: {
      'application/json': ['.adv.json'],
    },
  }],
  excludeAcceptAllOption: true,
})

/**
 * create `*.adv.json` file
 */
async function createAdvJSONFile() {
  await res.create()
}

/**
 * open adv project
 * `<root>/index.adv.json` file is required
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

    projectStore.rootDir = {
      name: dirHandle.name,
      kind: 'directory',
      handle: dirHandle,
    } as FSDirItem

    // try to load adv.config.json
    try {
      const configHandle = await dirHandle.getFileHandle('adv.config.json')
      await projectStore.setAdvConfigFileHandle(configHandle)
    }
    catch {
      // no config file, skip
    }

    // try to load index.adv.json
    try {
      const entryHandle = await dirHandle.getFileHandle('index.adv.json')
      await projectStore.setEntryFileHandle(entryHandle)
    }
    catch {
      // no entry file, skip
    }

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
    return '刚刚'
  if (minutes < 60)
    return `${minutes} 分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24)
    return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  if (days < 30)
    return `${days} 天前`
  return new Date(timestamp).toLocaleDateString()
}

function getTemplateName(templateId: string): string {
  return PROJECT_TEMPLATES.find(t => t.id === templateId)?.name ?? templateId
}
</script>

<template>
  <div class="h-full w-full flex flex-col items-center justify-center gap-6 p-8">
    <!-- Header -->
    <div class="mb-2 flex items-center gap-2.5">
      <div class="i-ri-gamepad-line text-xl op-50" />
      <span class="text-xl font-semibold tracking-wide op-80">ADV.JS Editor</span>
    </div>

    <!-- New Project Templates -->
    <div class="max-w-lg w-full">
      <div class="section-label">
        新建项目
      </div>
      <div class="grid grid-cols-3 gap-3">
        <button
          v-for="tpl in PROJECT_TEMPLATES"
          :key="tpl.id"
          :disabled="isCreating"
          class="card-base group flex flex-col items-center justify-center gap-2.5 px-4 py-5"
          @click="createAndLoadProject(tpl.id)"
        >
          <div class="card-icon" :class="{ 'animate-pulse': isCreating }">
            <div :class="tpl.icon" />
          </div>
          <div class="text-xs font-medium op-90 transition-opacity group-hover:op-100">
            {{ tpl.name }}
          </div>
          <div class="text-center text-11px leading-snug op-40 transition-opacity group-hover:op-55">
            {{ tpl.desc }}
          </div>
        </button>
      </div>
    </div>

    <!-- Recent Projects -->
    <div v-if="recentProjects.length > 0" class="max-w-lg w-full">
      <div class="section-label">
        最近项目
      </div>
      <div class="flex flex-col gap-1.5">
        <div
          v-for="project in recentProjects"
          :key="project.name + project.lastOpenedAt"
          class="card-base group flex cursor-pointer items-center gap-3 px-3.5 py-2.5"
          @click="reopenRecentProject(project)"
        >
          <div class="i-ri-folder-3-line text-sm op-35 transition-opacity group-hover:op-70" />
          <div class="flex-1 truncate text-xs font-medium op-80">
            {{ project.name }}
          </div>
          <div class="text-11px op-30">
            {{ getTemplateName(project.templateId) }}
          </div>
          <div class="text-11px op-25">
            {{ formatTimeAgo(project.lastOpenedAt) }}
          </div>
          <button
            class="i-ri-close-line text-xs op-0 transition-opacity group-hover:op-30 hover:!op-70"
            title="移除"
            @click.stop="removeRecentProject(project.name)"
          />
        </div>
      </div>
    </div>

    <!-- Action Buttons -->
    <div class="max-w-lg w-full">
      <div class="section-label">
        打开项目
      </div>
      <div class="grid grid-cols-2 gap-3">
        <button
          class="card-base group flex items-center gap-2.5 px-4 py-3"
          @click="openAdvProject"
        >
          <div class="card-icon-sm">
            <div class="i-ri-folder-open-line" />
          </div>
          <div class="text-left">
            <div class="text-xs font-medium op-80 transition-opacity group-hover:op-100">
              打开本地项目
            </div>
            <div class="text-11px op-35 transition-opacity group-hover:op-50">
              选择项目文件夹
            </div>
          </div>
        </button>
        <button
          class="card-base group flex items-center gap-2.5 px-4 py-3"
          @click="createAdvJSONFile"
        >
          <div class="card-icon-sm">
            <div class="i-ri-file-add-line" />
          </div>
          <div class="text-left">
            <div class="text-xs font-medium op-80 transition-opacity group-hover:op-100">
              新建 ADV 文件
            </div>
            <div class="text-11px op-35 transition-opacity group-hover:op-50">
              创建 .adv.json 文件
            </div>
          </div>
        </button>
        <button
          class="card-base group flex items-center gap-2.5 px-4 py-3"
          @click="fileStore.openAdvConfigFile"
        >
          <div class="card-icon-sm">
            <div class="i-ri-settings-3-line" />
          </div>
          <div class="text-left">
            <div class="text-xs font-medium op-80 transition-opacity group-hover:op-100">
              本地配置文件
            </div>
            <div class="text-11px op-35 transition-opacity group-hover:op-50">
              打开 adv.config.json
            </div>
          </div>
        </button>
        <button
          class="card-base group flex items-center gap-2.5 px-4 py-3"
          @click="fileStore.onlineAdvConfigFileDialogOpen = true"
        >
          <div class="card-icon-sm">
            <div class="i-ri-cloud-line" />
          </div>
          <div class="text-left">
            <div class="text-xs font-medium op-80 transition-opacity group-hover:op-100">
              在线配置文件
            </div>
            <div class="text-11px op-35 transition-opacity group-hover:op-50">
              加载远程 adv.config
            </div>
          </div>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.section-label {
  margin-bottom: 8px;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.04em;
  opacity: 0.4;
  text-transform: uppercase;
}

.card-base {
  position: relative;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
  cursor: pointer;
  transition:
    border-color 200ms ease,
    background-color 200ms ease,
    box-shadow 200ms ease,
    transform 150ms ease;
}

.card-base:hover {
  border-color: rgba(71, 114, 179, 0.5);
  background: rgba(71, 114, 179, 0.06);
  box-shadow:
    0 0 0 1px rgba(71, 114, 179, 0.1),
    0 2px 8px rgba(0, 0, 0, 0.2);
}

.card-base:active {
  transform: scale(0.98);
  border-color: rgba(71, 114, 179, 0.6);
  background: rgba(71, 114, 179, 0.1);
}

.card-base:disabled {
  opacity: 0.45;
  cursor: wait;
  pointer-events: none;
}

.card-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  font-size: 18px;
  color: #7ba4d9;
  background: rgba(71, 114, 179, 0.12);
  border: 1px solid rgba(71, 114, 179, 0.15);
  transition:
    background-color 200ms ease,
    border-color 200ms ease,
    transform 200ms ease;
}

.card-base:hover .card-icon {
  background: rgba(71, 114, 179, 0.2);
  border-color: rgba(71, 114, 179, 0.3);
  transform: translateY(-1px);
}

.card-icon-sm {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 6px;
  font-size: 14px;
  color: #7ba4d9;
  background: rgba(71, 114, 179, 0.12);
  border: 1px solid rgba(71, 114, 179, 0.15);
  flex-shrink: 0;
  transition:
    background-color 200ms ease,
    border-color 200ms ease;
}

.card-base:hover .card-icon-sm {
  background: rgba(71, 114, 179, 0.2);
  border-color: rgba(71, 114, 179, 0.3);
}
</style>
