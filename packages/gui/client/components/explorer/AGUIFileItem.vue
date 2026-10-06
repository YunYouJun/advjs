<script lang="ts" setup>
import type { FSDirItem, FSFileItem, FSItem } from './types'
import { useEventListener } from '@vueuse/core'
import { computed, nextTick, onBeforeUnmount, ref, watch, watchEffect } from 'vue'
import { listFilesInDir, useAGUIAssetsExplorerState } from '../../composables'
import AGUIFileItemIcon from './AGUIFileItemIcon.vue'

import { getIconFromFSItem } from './utils'

const props = withDefaults(defineProps<{
  item: FSItem
  size?: number
  selectableItems?: FSItem[]
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

onBeforeUnmount(() => clearTimeout(slowClickTimer))
const cssVars = computed(() => ({ '--icon-size': `${props.size}px` }))

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

  fileItemRef.value?.focus()
  const wasSelected = isSelected.value

  if (e.ctrlKey || e.metaKey) {
    selection.toggleSelect(props.item)
  }
  else if (e.shiftKey) {
    selection.rangeSelect(props.item, props.selectableItems ?? state.curFileList.value)
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
  if (!isRenaming.value)
    return
  const newName = renameValue.value.trim()
  if (newName && newName !== props.item.name) {
    const event = new CustomEvent('agui-rename', {
      detail: { item: props.item, newName },
      bubbles: true,
    })
    fileItemRef.value?.dispatchEvent(event)
  }
  selection.stopRenaming()
  nextTick(() => fileItemRef.value?.focus())
}

function cancelRename() {
  selection.stopRenaming()
  nextTick(() => fileItemRef.value?.focus())
}

function onRenameKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault()
    e.stopPropagation()
    confirmRename()
  }
  else if (e.key === 'Escape') {
    e.preventDefault()
    e.stopPropagation()
    cancelRename()
  }
}
</script>

<template>
  <div
    ref="fileItemRef"
    class="agui-file-item"
    role="option"
    :aria-selected="isSelected"
    :aria-label="item.name"
    :title="item.name"
    :class="{
      'selected': isSelected,
      'active': isSelected,
      'is-cut': isCut,
      'is-renaming': isRenaming,
    }"
    :style="cssVars"
    draggable="true"
    @click="onClick"
  >
    <AGUIFileItemIcon :file-icon="fileIcon || ''" />

    <div v-if="isRenaming" class="agui-file-name agui-file-name-editing">
      <input
        ref="renameInputRef"
        v-model="renameValue"
        class="agui-rename-input"
        :aria-label="`Rename ${item.name}`"
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
.agui-file-item {
  display: flex;
  align-items: center;
  min-width: 0;
  min-height: var(--agui-control-height);
  color: var(--agui-c-text-1);
  border-radius: 2px;
  font-size: 12px;
  cursor: pointer;
  &:hover {
    background: var(--agui-c-bg-hover);
  }
  &.active {
    color: var(--agui-c-selection-text);
    background: var(--agui-c-selection);
  }
  &:focus-visible {
    outline: 2px solid var(--agui-c-focus);
    outline-offset: -2px;
  }
  &.is-cut {
    opacity: 0.5;
  }
  .agui-file-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 24px;
    height: 24px;
    font-size: 16px;
  }
  .agui-file-name {
    min-width: 0;
    flex: 1;
    padding: 2px 4px;
    line-height: 20px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .agui-rename-input {
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    padding: 0 2px;
    font: inherit;
    line-height: 20px;
    border: 1px solid var(--agui-c-control-border);
    border-radius: 2px;
    color: var(--agui-c-text-1);
    background: var(--agui-c-field);
    outline: 2px solid var(--agui-c-focus);
    outline-offset: -2px;
  }
}
.agui-file-list.with-thumbnail .agui-file-item {
  flex-direction: column;
  padding: 4px;
  .agui-file-icon {
    width: var(--icon-size);
    height: var(--icon-size);
    font-size: calc(var(--icon-size) * 0.8);
  }
  .agui-file-name {
    box-sizing: border-box;
    width: 100%;
    text-align: center;
  }
}
</style>
