<script setup lang="ts">
import type { ProjectFlowGraph } from '../../../utils/project-flow'
import type { ProjectFlowView, ProjectFlowViewSelection } from '../../../utils/project-flow-view'
import AGUIBreadcrumb from '@advjs/gui/components/breadcrumb/AGUIBreadcrumb.vue'
import AGUIIconButton from '@advjs/gui/components/button/AGUIIconButton.vue'
import AGUISelect from '@advjs/gui/components/select/AGUISelect.vue'
import AGUIToolbar from '@advjs/gui/components/toolbar/AGUIToolbar.vue'
import { computed } from 'vue'

const props = defineProps<{
  graph?: ProjectFlowGraph
  view?: ProjectFlowView
  direction: 'LR' | 'TB'
  zh: boolean
  busy: boolean
  available: boolean
}>()
const emit = defineEmits<{
  navigate: [selection: ProjectFlowViewSelection]
  back: []
  refresh: []
  layout: [direction: 'LR' | 'TB', force: boolean]
  details: [chapterId?: string]
  page: [page: number]
}>()
const options = computed(() => [
  { value: 'all', label: props.zh ? '项目概览' : 'Project overview' },
  ...(props.graph?.chapters.map(chapter => ({ value: `chapter:${chapter.id}`, label: chapter.title })) ?? []),
])
const chapter = computed({
  get: () => props.view?.selection.chapterId ? `chapter:${props.view.selection.chapterId}` : 'all',
  set: (value: string | number) => emit('navigate', String(value).startsWith('chapter:')
    ? { level: 'sections', chapterId: String(value).slice(8) }
    : { level: 'chapters' }),
})
const breadcrumbs = computed(() => props.view?.breadcrumbs.map(item => ({
  label: item.selection.level === 'chapters'
    ? (props.zh ? '章节概览' : 'Chapters')
    : item.selection.level === 'all'
      ? (props.zh ? '全部剧情' : 'All story nodes')
      : item.selection.level === 'details' && !item.selection.sectionId
        ? (props.zh ? '剧情详情' : 'Story details')
        : item.label,
  onClick: () => emit('navigate', item.selection),
})) ?? [])
</script>

<template>
  <AGUIToolbar :items="[]" :label="zh ? '流程图操作' : 'Story graph tools'">
    <template #before-toolbar>
      <AGUIIconButton icon="i-ri-arrow-left-line" :title="zh ? '返回上一层' : 'Back one level'" :disabled="busy || !view || view.selection.level === 'chapters'" @click="emit('back')" />
      <div class="flow-chapter-filter">
        <AGUISelect v-model="chapter" :options="options" :label="zh ? '流程图章节' : 'Graph chapter'" :disabled="!graph?.chapters.length || busy" />
      </div>
    </template>
    <template #after-toolbar>
      <AGUIIconButton icon="i-ri-node-tree" :title="view?.selection.chapterId ? (zh ? '本章剧情详情' : 'Chapter story details') : (zh ? '全部剧情详情' : 'All story details')" :disabled="!view?.nodes.length || busy" @click="emit('details', view?.selection.chapterId)" />
      <AGUIIconButton icon="i-ri-refresh-line" :title="zh ? '刷新' : 'Refresh'" :disabled="!available || busy" @click="emit('refresh')" />
      <AGUIIconButton icon="i-ri-layout-masonry-line" :title="zh ? '自动排版' : 'Auto layout'" :disabled="!view?.nodes.length || busy" @click="emit('layout', direction, true)" />
      <AGUIIconButton icon="i-ri-arrow-right-line" :title="zh ? '水平布局' : 'Horizontal layout'" :active="direction === 'LR'" :disabled="!view?.nodes.length || busy" @click="emit('layout', 'LR', false)" />
      <AGUIIconButton icon="i-ri-arrow-down-line" :title="zh ? '垂直布局' : 'Vertical layout'" :active="direction === 'TB'" :disabled="!view?.nodes.length || busy" @click="emit('layout', 'TB', false)" />
    </template>
  </AGUIToolbar>
  <div v-if="view" class="flow-navigation">
    <AGUIBreadcrumb class="flow-breadcrumb" :items="breadcrumbs" />
    <div v-if="view.pageCount > 1" class="flow-pagination" :aria-label="zh ? '流程图分页' : 'Graph pages'">
      <AGUIIconButton icon="i-ri-arrow-left-s-line" :title="zh ? '上一页' : 'Previous page'" :disabled="busy || !view.page" @click="emit('page', view.page - 1)" />
      <span data-flow-page>{{ view.page + 1 }} / {{ view.pageCount }}</span>
      <AGUIIconButton icon="i-ri-arrow-right-s-line" :title="zh ? '下一页' : 'Next page'" :disabled="busy || view.page + 1 >= view.pageCount" @click="emit('page', view.page + 1)" />
    </div>
  </div>
</template>

<style scoped>
.flow-chapter-filter {
  flex: 1;
  min-width: 100px;
  max-width: 260px;
}
.flow-navigation {
  display: flex;
  align-items: center;
  min-width: 0;
  border-bottom: 1px solid var(--agui-c-divider);
}
.flow-breadcrumb {
  flex: 1;
  min-width: 0;
}
.flow-pagination {
  display: flex;
  flex: none;
  align-items: center;
  gap: 2px;
  padding-right: 4px;
  font-size: 12px;
  color: var(--agui-c-text-2);
}
</style>
