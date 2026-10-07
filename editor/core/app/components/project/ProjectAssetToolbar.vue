<script setup lang="ts">
import type { ToolbarDropdown } from '@advjs/gui/client/components/toolbar/types.js'
import { computed } from 'vue'

const props = defineProps<{ folder: string, sidebarVisible: boolean, selectedPath: string, count: number, compact: boolean, narrow: boolean, zh: boolean }>()
const emit = defineEmits<{ browse: [folder: string], toggleSidebar: [], locate: [] }>()
const query = defineModel<string>('query', { required: true })
const type = defineModel<string>('type', { required: true })
const mode = defineModel<'grid' | 'list'>('mode', { required: true })
const scope = defineModel<'folder' | 'all'>('scope', { required: true })
const options = computed(() => [
  { value: 'all', label: props.zh ? '全部类型' : 'All types' },
  { value: 'image', label: props.zh ? '图片' : 'Images' },
  { value: 'audio', label: props.zh ? '音频' : 'Audio' },
  { value: 'video', label: props.zh ? '视频' : 'Video' },
  { value: 'model', label: props.zh ? '模型' : 'Models' },
])
const scopes = computed(() => [
  { value: 'folder', label: props.zh ? '当前目录及子目录' : 'Folder and descendants' },
  { value: 'all', label: props.zh ? '全部素材' : 'All assets' },
])
const scopeLabel = computed(() => scopes.value.find(item => item.value === scope.value)!.label)
const scopeMenu = computed<ToolbarDropdown>(() => ({
  type: 'dropdown',
  children: scopes.value.map(item => ({
    type: 'item',
    label: item.label,
    icon: item.value === scope.value ? 'i-ri-check-line' : undefined,
    onClick: () => scope.value = item.value as 'folder' | 'all',
  })),
}))
const breadcrumbs = computed(() => {
  const folders = props.folder ? props.folder.split('/') : []
  return [
    { label: props.zh ? '全部素材' : 'All assets', onClick: () => emit('browse', '') },
    ...folders.map((label, index) => ({ label, onClick: () => emit('browse', folders.slice(0, index + 1).join('/')) })),
  ]
})
const pathMenu = computed<ToolbarDropdown>(() => ({
  type: 'dropdown',
  children: breadcrumbs.value.map(item => ({ type: 'item', label: item.label, icon: 'i-ri-folder-line', onClick: item.onClick })),
}))
const viewMenu = computed<ToolbarDropdown>(() => ({
  type: 'dropdown',
  children: [
    { type: 'item', label: props.zh ? '缩略图视图' : 'Thumbnail view', icon: mode.value === 'grid' ? 'i-ri-check-line' : 'i-ri-grid-line', onClick: () => mode.value = 'grid' },
    { type: 'item', label: props.zh ? '列表视图' : 'List view', icon: mode.value === 'list' ? 'i-ri-check-line' : 'i-ri-list-check', onClick: () => mode.value = 'list' },
    { type: 'item', label: props.zh ? '在项目中定位' : 'Show in Project', icon: 'i-ri-focus-3-line', disabled: !props.selectedPath, onClick: () => emit('locate') },
  ],
}))
</script>

<template>
  <AGUIToolbar :items="[]" :wrap="false" :label="zh ? '项目素材' : 'Project assets'">
    <template #before-toolbar>
      <AGUIIconButton icon="i-ri-side-bar-line" :title="zh ? '目录侧栏' : 'Folder sidebar'" :active="sidebarVisible" @click="emit('toggleSidebar')" />
      <template v-if="folder">
        <AGUIDropdownMenu v-if="compact" :data="pathMenu">
          <template #trigger>
            <AGUIIconButton icon="i-ri-folder-line" :aria-label="zh ? '素材路径' : 'Asset path'" :title="folder" />
          </template>
        </AGUIDropdownMenu>
        <AGUIBreadcrumb v-else class="asset-breadcrumb" :items="breadcrumbs" :aria-label="zh ? '素材路径' : 'Asset path'" />
      </template>
      <div class="asset-filter" :class="{ compact }">
        <AGUISelect v-model="type" :options="options" :label="zh ? '素材类型' : 'Asset type'" />
      </div>
      <div class="asset-search">
        <AGUIInput v-model="query" :aria-label="zh ? '搜索素材' : 'Search assets'" :placeholder="zh ? '搜索素材…' : 'Search assets…'" />
        <AGUIDropdownMenu :data="scopeMenu">
          <template #trigger>
            <AGUIIconButton
              :icon="scope === 'all' ? 'i-ri-global-line' : 'i-ri-folder-open-line'"
              :aria-label="zh ? '浏览范围' : 'Browse scope'" :title="`${zh ? '浏览范围' : 'Browse scope'}: ${scopeLabel}`"
              :active="scope === 'all'"
            />
          </template>
        </AGUIDropdownMenu>
      </div>
    </template>
    <template #after-toolbar>
      <span v-if="!narrow" class="asset-count">{{ count }} {{ zh ? '项' : 'items' }}</span>
      <AGUIDropdownMenu v-if="compact" :data="viewMenu">
        <template #trigger>
          <AGUIIconButton icon="i-ri-more-2-fill" :title="zh ? '素材视图与操作' : 'Asset view and actions'" />
        </template>
      </AGUIDropdownMenu>
      <template v-else>
        <AGUIIconButton icon="i-ri-grid-line" :title="zh ? '缩略图视图' : 'Thumbnail view'" :active="mode === 'grid'" @click="mode = 'grid'" />
        <AGUIIconButton icon="i-ri-list-check" :title="zh ? '列表视图' : 'List view'" :active="mode === 'list'" @click="mode = 'list'" />
        <AGUIIconButton icon="i-ri-focus-3-line" :title="zh ? '在项目中定位' : 'Show in Project'" :disabled="!selectedPath" @click="emit('locate')" />
      </template>
    </template>
  </AGUIToolbar>
</template>

<style scoped>
.asset-filter {
  flex-shrink: 0;
  width: 100px;
}
.asset-filter.compact {
  width: 88px;
}
.asset-search {
  display: flex;
  gap: 2px;
  flex: 1;
  min-width: 0;
  max-width: 304px;
}
.asset-breadcrumb {
  flex: 0 1 auto;
  min-width: 80px;
  max-width: 240px;
}
.asset-count {
  color: var(--agui-c-text-2);
  white-space: nowrap;
}
</style>
