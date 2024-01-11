<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import { computedAsync, onClickOutside, useEventListener } from '@vueuse/core'
import { getFiletypeFromPath, getIconFromFileType, isImage } from '../../utils/fs'
import { curDirHandle, curFileList, listFilesInDirectory } from '../../composables'

import type { FileItem } from './types'

const props = withDefaults(defineProps<{
  item: FileItem
  icon?: string
  size?: number
}>(), {
  size: 32,
})

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
  const handle = props.item.handle
  if (!handle)
    return

  if (handle.kind === 'directory') {
    const list = await listFilesInDirectory(handle, {
      showFiles: true,
    })
    curDirHandle.value = handle

    console.log(list)
    curFileList.value = list
  }
})

const fileIcon = computedAsync(async () => {
  if (props.icon)
    return props.icon

  const handle = props.item.handle
  if (!handle)
    return ''
  if (handle.kind === 'directory')
    return 'i-vscode-icons-default-folder'

  const name = props.item.filename || props.item.name || ''
  if (isImage(name)) {
    // 从 handle 读取缩略图
    const file = await handle.getFile()
    const imageUrl = URL.createObjectURL(file)
    return imageUrl
  }

  const ext = getFiletypeFromPath(name)
  const icon = getIconFromFileType(ext)
  return icon
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
      {{ item.filename || item.name }}
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
