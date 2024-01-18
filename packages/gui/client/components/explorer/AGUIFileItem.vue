<script lang="ts" setup>
import { computed, ref, watch, watchEffect } from 'vue'
import { onClickOutside, useEventListener } from '@vueuse/core'
import { listFilesInDir, useAGUIAssetsExplorerState } from '../../composables'
import { getIconFromFSItem } from './utils'

import type { FSDirItem, FSFileItem, FSItem } from './types'

const props = withDefaults(defineProps<{
  item: FSItem
  size?: number
}>(), {
  size: 32,
})

const state = useAGUIAssetsExplorerState()
const active = ref(false)
watch(() => props.item, () => {
  active.value = false
})

const fileItemRef = ref<HTMLElement>()
onClickOutside(fileItemRef, () => {
  active.value = false
})

const fontSize = computed(() => {
  const min = 12
  const max = 120
  const percentage = (props.size - min) / (max - min)
  return percentage * 6 + 8
})

const cssVars = computed(() => ({
  '--icon-size': `${props.size}px`,
  '--font-size': `${fontSize.value}px`,
}))

function onDragStart(e: DragEvent) {
  e.dataTransfer?.clearData()
  e.dataTransfer?.setData('item', JSON.stringify(props.item))
}

useEventListener(fileItemRef, 'dragstart', onDragStart)
useEventListener(fileItemRef, 'dblclick', async () => {
  const item = props.item
  if (!item.handle)
    return

  // custom dblclick handler
  // global
  if (state?.onDblClick) {
    await state.onDblClick(item)
    return
  }
  // local
  if (item.onDblClick) {
    await item.onDblClick(item)
    return
  }

  if (item.handle.kind === 'directory') {
    const dir = item as FSDirItem
    if (state.onDirDblClick) {
      await state.onDirDblClick?.(dir)
    }
    else {
      const list = await listFilesInDir(dir, {
        showFiles: true,
      })
      state.setCurDir(dir)
      state.setCurFileList(list)
    }
  }
  else if (item.handle.kind === 'file') {
    const fileItem = item as FSFileItem
    if (state.onFileDblClick) {
      await state.onFileDblClick?.(fileItem)
    }
    else {
      // open
      const file = await fileItem.handle?.getFile()
      if (!file)
        return

      const url = URL.createObjectURL(file)
      // model
      if (file.name.endsWith('gltf') || file.name.endsWith('glb')) {
        const params = new URLSearchParams()
        params.set('fileUrl', url)
        params.set('type', 'gltf')
        window.open(`/preview?${params.toString()}`)
      }
      else {
        window.open(url)
      }
    }
  }
})

const fileIcon = ref(props.item.icon)
watchEffect(async () => {
  fileIcon.value = await getIconFromFSItem(props.item)
})
</script>

<template>
  <div
    ref="fileItemRef"
    class="agui-file-item"
    :class="{
      active,
    }"
    :style="cssVars"
    draggable="true"
    @click="active = true"
    @blur="active = false"
  >
    <div class="agui-file-icon">
      <div
        v-if="fileIcon?.startsWith('i-')"
        class="icon"
        :class="fileIcon"
      />
      <img
        v-else
        class="icon h-full w-full object-contain"
        :src="fileIcon"
      >
    </div>

    <div class="agui-file-name">
      {{ item.name }}
    </div>
  </div>
</template>

<style lang="scss">
.with-thumbnail {
  .agui-file-item {
    display: flex;
    flex-direction: column;
    align-items: center;

    .agui-file-name {
      display: block;
      text-align: center;
      font-size: var(--font-size, 12px);
    }

    &.active {
      background-color: rgba(255, 255, 255, 0.1);
      .agui-file-name {
        color: white;
        background-color: var(--agui-c-active);
      }
    }

    .agui-file-icon {
      width: var(--icon-size, 32px);
      height: var(--icon-size, 32px);

      font-size: calc(var(--icon-size, 32px) * 0.8);
    }
  }
}

.agui-file-item {
  display: flex;
  flex-direction: row;
  align-items: center;
  height: 100%;

  cursor: pointer;

  font-size: 14px;

  .agui-file-icon {
    display: flex;
    align-items: center;
    justify-content: center;

    padding: 2px;

    font-size: 12px;

    width: var(--icon-size, 32px);
    height: var(--icon-size, 32px);
  }

  .agui-file-name {
    font-size: 12px;

    display: flex;

    line-height: 1;

    width: 100%;

    padding: 2px;
    border-radius: 2px;

    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &.active {
    border-radius: 4px;
    background-color: var(--agui-c-active);
  }
}
</style>
