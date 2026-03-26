<script lang="ts" setup>
import type { FSDirItem, FSFileItem, FSItem } from './types'
import { onClickOutside, useEventListener } from '@vueuse/core'
import { computed, nextTick, ref, watch, watchEffect } from 'vue'
import { listFilesInDir, useAGUIAssetsExplorerState } from '../../composables'
import AGUIFileItemIcon from './AGUIFileItemIcon.vue'

import { getIconFromFSItem } from './utils'

const props = withDefaults(defineProps<{
  item: FSItem
  size?: number
}>(), {
  size: 32,
})

const state = useAGUIAssetsExplorerState()
const { selection } = state

const isSelected = computed(() => selection.isSelected(props.item))
const isRenaming = computed(() => selection.renamingItem.value === props.item)
const isCut = computed(() => {
  const cb = selection.clipboard.value
  return cb?.mode === 'cut' && cb.items.includes(props.item)
})

const fileItemRef = ref<HTMLElement>()

// Keep original onClickOutside behavior: clear selection when clicking outside
onClickOutside(fileItemRef, () => {
  // only clear this item from selection if it's the only one selected
  if (selection.selectedItems.size <= 1 && isSelected.value)
    selection.clearSelection()
})

// Inline rename
const renameInputRef = ref<HTMLInputElement>()
const renameValue = ref('')

// Slow double-click tracking
let lastClickTime = 0
let slowClickTimer: ReturnType<typeof setTimeout> | undefined

watch(isRenaming, async (val) => {
  if (val) {
    renameValue.value = props.item.name
    await nextTick()
    if (renameInputRef.value) {
      renameInputRef.value.focus()
      const dotIndex = props.item.name.lastIndexOf('.')
      if (dotIndex > 0 && props.item.kind === 'file')
        renameInputRef.value.setSelectionRange(0, dotIndex)
      else
        renameInputRef.value.select()
    }
  }
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
  const fileUUID = crypto.randomUUID()
  e.dataTransfer?.setData('fileUUID', fileUUID)
  window.AGUI_DRAGGING_ITEM_MAP.set(
    fileUUID,
    props.item,
  )
}

useEventListener(fileItemRef, 'dragstart', onDragStart)

// Keep dblclick as useEventListener — exactly like the original
useEventListener(fileItemRef, 'dblclick', async () => {
  // Clear slow click timer on real dblclick
  if (slowClickTimer) {
    clearTimeout(slowClickTimer)
    slowClickTimer = undefined
  }

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
  if (state.onFSItemChange)
    await state.onFSItemChange?.(props.item)
})

/**
 * Click to select file, supporting multi-select modifiers
 */
function onClick(e: MouseEvent) {
  if (isRenaming.value)
    return

  const wasSelected = isSelected.value

  if (e.ctrlKey || e.metaKey) {
    selection.toggleSelect(props.item)
  }
  else if (e.shiftKey) {
    selection.rangeSelect(props.item, state.curFileList.value)
  }
  else {
    selection.select(props.item)
  }

  // Slow double-click: if item was already selected and we click it again
  // after 500ms-1500ms, trigger rename
  const now = Date.now()
  const elapsed = now - lastClickTime
  lastClickTime = now

  if (wasSelected && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
    if (elapsed >= 500 && elapsed <= 1500) {
      slowClickTimer = setTimeout(() => {
        selection.startRenaming(props.item)
        slowClickTimer = undefined
      }, 300)
    }
  }
}

/**
 * Confirm rename
 */
function confirmRename() {
  const newName = renameValue.value.trim()
  if (newName && newName !== props.item.name) {
    const event = new CustomEvent('agui-rename', {
      detail: { item: props.item, newName },
      bubbles: true,
    })
    fileItemRef.value?.dispatchEvent(event)
  }
  selection.stopRenaming()
}

function cancelRename() {
  selection.stopRenaming()
}

function onRenameKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault()
    confirmRename()
  }
  else if (e.key === 'Escape') {
    e.preventDefault()
    cancelRename()
  }
}
</script>

<template>
  <div
    ref="fileItemRef"
    class="agui-file-item"
    :class="{
      'selected': isSelected,
      'active': isSelected,
      'is-cut': isCut,
      'is-renaming': isRenaming,
    }"
    :style="cssVars"
    draggable="true"
    @click="onClick"
    @blur="selection.clearSelection()"
  >
    <AGUIFileItemIcon :file-icon="fileIcon || ''" />

    <div v-if="isRenaming" class="agui-file-name agui-file-name-editing">
      <input
        ref="renameInputRef"
        v-model="renameValue"
        class="agui-rename-input"
        @keydown="onRenameKeydown"
        @blur="confirmRename"
        @click.stop
        @dblclick.stop
      >
    </div>
    <div v-else class="agui-file-name">
      {{ item.name }}
    </div>
  </div>
</template>

<style lang="scss">
.with-thumbnail {
  .agui-file-item {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    // icon + file name label, add some padding room
    height: calc(var(--icon-size, 32px) + var(--font-size, 12px) + 8px);

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
  height: var(--icon-size, 32px);

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

  .agui-file-name-editing {
    overflow: visible;
  }

  .agui-rename-input {
    width: 100%;
    font-size: inherit;
    padding: 1px 2px;
    border: 1px solid var(--agui-c-active);
    border-radius: 2px;
    background: var(--agui-c-bg-panel);
    color: var(--agui-c-text);
    outline: none;

    &:focus {
      border-color: var(--agui-c-active);
      box-shadow: 0 0 0 1px var(--agui-c-active);
    }
  }

  &.active {
    border-radius: 4px;
    background-color: var(--agui-c-active);
  }

  &.is-cut {
    opacity: 0.5;
  }
}
</style>
