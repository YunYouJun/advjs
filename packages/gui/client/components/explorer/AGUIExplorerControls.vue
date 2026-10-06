<script lang="ts" setup>
import { vscodeFolderIcon } from '../../../unocss'
import { AGUIIconButton, AGUIInput } from '../../components'
import { openDir, useAGUIAssetsExplorerState } from '../../composables'

defineProps<{ search?: string }>()
const emit = defineEmits<{ 'update:search': [value: string] }>()
const state = useAGUIAssetsExplorerState()
</script>

<template>
  <div class="agui-explorer-controls">
    <AGUIIconButton
      size="mini"
      :icon="vscodeFolderIcon"
      title="Open Directory"
      @click="openDir(state)"
    />
    <div class="flex-grow" />
    <slot />
    <AGUIInput class="search-files-input" aria-label="Filter current folder" placeholder="Filter files…" :model-value="search" @update:model-value="emit('update:search', $event)" />
  </div>
</template>

<style lang="scss">
.agui-explorer-controls {
  display: flex;
  align-items: center;
  padding: 0 4px;
  min-height: var(--agui-explorer-controls-height, 30px);
  gap: 4px;
  flex-shrink: 0;
  background: var(--agui-c-bg-panel-title);

  border-bottom: 1px solid var(--agui-c-divider);

  .search-files-input {
    width: 160px;
    max-width: calc(100% - 32px);
  }
}
</style>
