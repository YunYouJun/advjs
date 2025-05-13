<script lang="ts" setup>
import { vscodeFolderIcon } from '../../../unocss'
import { AGUIIconButton, AGUIInput } from '../../components'
import { openDir, useAGUIAssetsExplorerState } from '../../composables'

const state = useAGUIAssetsExplorerState()
</script>

<template>
  <div class="agui-explorer-controls">
    <div />
    <AGUIIconButton
      size="mini"
      :icon="vscodeFolderIcon"
      title="Open Directory"
      @click="openDir(state)"
    />
    <div class="flex-grow" />
    <slot />
    <AGUIInput class="search-files-input" />
  </div>
</template>

<style lang="scss">
.agui-explorer-controls {
  display: flex;
  align-items: center;
  padding: 0 4px;
  height: var(--agui-explorer-controls-height, 32px);

  border-bottom: 1px solid var(--agui-c-border, #222);

  .search-files-input {
    width: 7.5rem;
  }
}
</style>
