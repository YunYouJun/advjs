<script setup lang="ts">
import type { RecentProject } from '../../workspaces/browser-session'
import AGUIButton from '@advjs/gui/components/button/AGUIButton.vue'
import { computed } from 'vue'
import AECopyErrorButton from '../error/AECopyErrorButton.vue'
import ProjectAction from '../panel/ProjectAction.vue'

const props = defineProps<{
  projects: readonly RecentProject[]
  disabled?: boolean
  error?: string
  openedPaths?: readonly string[]
}>()
defineEmits<{
  reopen: [id: string]
  remove: [id: string]
}>()

const { locale } = useI18n()
const zh = computed(() => locale.value === 'zh-CN')
const title = computed(() => zh.value ? '最近打开的项目' : 'Recent projects')
const query = shallowRef('')
const templateNames = computed<Record<string, string>>(() => ({
  'adv-md': zh.value ? 'Markdown 冒险' : 'Markdown adventure',
  'flow': zh.value ? '流程图' : 'Flow graph',
  'blank': zh.value ? '空白项目' : 'Blank project',
}))
const entries = computed(() => props.projects.filter(project => `${project.name} ${project.path ?? ''}`.toLocaleLowerCase().includes(query.value.trim().toLocaleLowerCase())).map(project => ({
  ...project,
  location: project.path || templateNames.value[project.templateId] || (zh.value ? '目录项目' : 'Folder project'),
  openedAt: project.lastOpenedAt > 0 ? new Date(project.lastOpenedAt).toLocaleString(locale.value) : '',
  dateTime: project.lastOpenedAt > 0 ? new Date(project.lastOpenedAt).toISOString() : undefined,
  opened: !!project.path && props.openedPaths?.includes(project.path),
})))
</script>

<template>
  <section class="recent-projects" :aria-label="title" :aria-busy="disabled || undefined">
    <h3 class="recent-projects-title">
      {{ title }}
    </h3>
    <AGUIInput v-if="projects.length" v-model="query" class="recent-project-search" :aria-label="zh ? '搜索最近项目' : 'Search recent projects'" :placeholder="zh ? '搜索项目…' : 'Search projects…'" />
    <ul v-if="entries.length" class="recent-projects-list">
      <li v-for="project in entries" :key="project.id" class="recent-project">
        <ProjectAction :label="project.name" :title="project.path || project.name" icon="i-ri-folder-3-line" :disabled="disabled" @click="$emit('reopen', project.id)">
          <template #description>
            <span v-if="project.opened" class="recent-project-opened">{{ zh ? '已打开 · 点击切换窗口' : 'Open · Switch to window' }}</span>
            <span class="recent-project-location">{{ project.location }}</span>
            <time v-if="project.openedAt" class="recent-project-time" :datetime="project.dateTime">{{ project.openedAt }}</time>
          </template>
        </ProjectAction>
        <AGUIButton variant="text" icon="i-ri-close-line" :disabled="disabled" :aria-label="`${zh ? '移除' : 'Remove'} ${project.name}`" :title="zh ? '从最近项目中移除' : 'Remove from recent projects'" @click="$emit('remove', project.id)" />
      </li>
    </ul>
    <p v-else class="recent-projects-empty" role="status">
      {{ projects.length ? (zh ? '没有匹配的项目' : 'No matching projects') : (zh ? '暂无最近项目。打开项目后会显示在这里。' : 'No recent projects. Open a project to add it here.') }}
    </p>
    <div v-if="error" class="recent-projects-error" role="alert">
      <p>{{ error }}</p>
      <AECopyErrorButton source="Recent projects" :error="error" />
    </div>
  </section>
</template>

<style scoped>
.recent-projects {
  min-width: 0;
}
.recent-projects-title {
  margin: 16px 0 4px;
  padding-bottom: 4px;
  border-bottom: 1px solid var(--agui-c-divider);
  font-size: 12px;
  font-weight: 600;
}
.recent-project-search {
  width: 100%;
  margin-block: 4px;
}
.recent-project-opened {
  display: block;
  color: var(--agui-c-link);
}
.recent-projects-list {
  padding: 0;
  margin: 0;
  list-style: none;
}
.recent-project {
  display: flex;
  align-items: center;
  gap: 4px;
}
.recent-project > :first-child {
  flex: 1;
}
.recent-project-location {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.recent-project-time {
  display: block;
}
.recent-projects-empty,
.recent-projects-error {
  margin: 8px;
  font-size: 12px;
  overflow-wrap: anywhere;
  color: var(--agui-c-text-2);
}
.recent-projects-error {
  color: var(--agui-c-danger-text);
}
</style>
