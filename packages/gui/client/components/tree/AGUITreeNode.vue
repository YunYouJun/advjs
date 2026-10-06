<!-- eslint-disable vue/custom-event-name-casing -->
<script lang="ts" setup>
import type { AGUIContextMenuItemType } from '../context-menu/types'
import type { TreeNode } from './types'
import { createReusableTemplate } from '@vueuse/core'
import { computed, inject, onBeforeUnmount, shallowRef, useId } from 'vue'
import Toggle from '../button/AGUIToggleIcon.vue'
import AGUIContextMenu from '../context-menu/AGUIContextMenu.vue'
import { treeContextKey } from './context'

const props = withDefaults(defineProps<{
  currentNode?: TreeNode
  node: TreeNode
  depth?: number
  visible?: boolean
  contextMenu?: (node: TreeNode) => AGUIContextMenuItemType[]
}>(), { depth: 0, visible: true })
const emit = defineEmits<{
  'log': [value: unknown]
  'node-activate': [node: TreeNode]
  'node-dblclick': [node: TreeNode]
  'node-collapse': [nodes: TreeNode[]]
  'node-expand': [nodes: TreeNode[]]
  'node-selected': [nodes: TreeNode[]]
  'node-unselected': [nodes: TreeNode[]]
  'node-show': [nodes: TreeNode[]]
  'node-hide': [nodes: TreeNode[]]
}>()
const context = inject(treeContextKey, undefined)
const item = shallowRef<HTMLElement>()
const uid = useId()
const name = computed(() => props.node.name || `[${props.node.type || 'Node'}]`)
const hasChildren = computed(() => !!props.node.children?.length)
const [DefineRow, ReuseRow] = createReusableTemplate()
let toggleTimer: ReturnType<typeof setTimeout> | undefined
function clearToggle() {
  clearTimeout(toggleTimer)
  toggleTimer = undefined
}
onBeforeUnmount(clearToggle)
function toggle() {
  clearToggle()
  if (props.node.expanded)
    emit('node-collapse', [props.node])
  else
    emit('node-expand', [props.node])
}
function toggleClick(event: MouseEvent) {
  clearToggle()
  // Keyboard activation has no double-click gesture to disambiguate.
  if (event.detail === 0)
    toggle()
  else
    toggleTimer = setTimeout(toggle, 200)
}
function doubleClick() {
  clearToggle()
  if (hasChildren.value && !props.node.expanded)
    emit('node-expand', [props.node])
  emit('node-dblclick', props.node)
}
function toggleSelection() {
  if (props.node.selectable)
    emit('node-unselected', [props.node])
  else
    emit('node-selected', [props.node])
}
function toggleVisibility() {
  if (props.node.visible)
    emit('node-hide', [props.node])
  else
    emit('node-show', [props.node])
}
function activate() {
  item.value?.focus()
  emit('node-activate', props.node)
}
function onKeydown(event: KeyboardEvent) {
  if (event.target !== item.value || event.altKey || event.ctrlKey || event.metaKey)
    return
  const root = item.value?.closest('[role="tree"]')
  const rows = Array.from(root?.querySelectorAll<HTMLElement>('[role="treeitem"]') ?? [])
  const index = rows.indexOf(item.value!)
  let target: HTMLElement | undefined
  switch (event.key) {
    case 'ArrowDown': target = rows[index + 1]
      break
    case 'ArrowUp': target = rows[index - 1]
      break
    case 'Home': target = rows[0]
      break
    case 'End': target = rows.at(-1)
      break
    case 'ArrowRight':
      if (hasChildren.value && !props.node.expanded)
        emit('node-expand', [props.node])
      else if (hasChildren.value)
        target = rows[index + 1]
      break
    case 'ArrowLeft':
      if (hasChildren.value && props.node.expanded)
        emit('node-collapse', [props.node])
      else
        target = item.value?.parentElement?.closest<HTMLElement>('[role="treeitem"]') ?? undefined
      break
    case 'Enter':
      activate()
      doubleClick()
      break
    case ' ':
      activate()
      break
    default: return
  }
  event.preventDefault()
  event.stopPropagation()
  target?.focus()
}
</script>

<template>
  <DefineRow>
    <div
      class="agui-tree-node"
      :class="{ active: node === currentNode, muted: node.muted, match: node.match }"
      :style="{ '--depth': depth }"
      :title="name"
      @click="activate"
      @dblclick="doubleClick"
    >
      <Toggle v-if="hasChildren" :icon="node.expanded ? 'expanded' : 'collapsed'" :hint="`${node.expanded ? 'Collapse' : 'Expand'} ${name}`" tabindex="-1" @click="toggleClick" @dblclick="doubleClick" />
      <span v-else class="agui-tree-spacer" aria-hidden="true" />
      <span :id="`${uid}-name`" class="agui-tree-title" :class="{ 'is-hidden': node.visible === false || !visible }">{{ name }}</span>
      <Toggle v-if="typeof node.selectable === 'boolean'" :icon="node.selectable ? 'selectable' : 'unselectable'" :hint="`${node.selectable ? 'Disable' : 'Enable'} right-click selection: ${name}`" :muted="node.parentUnselectable" :tabindex="context?.tabStop.value === node ? 0 : -1" @click="toggleSelection" />
      <Toggle v-if="typeof node.visible === 'boolean'" :icon="node.visible ? 'eye-opened' : 'eye-closed'" :hint="`${node.visible ? 'Hide' : 'Show'} ${name}`" :tabindex="context?.tabStop.value === node ? 0 : -1" @click="toggleVisibility" />
    </div>
  </DefineRow>
  <div
    ref="item"
    class="agui-tree-item"
    role="treeitem"
    :aria-labelledby="`${uid}-name`"
    :aria-expanded="hasChildren ? !!node.expanded : undefined"
    :aria-selected="node === currentNode"
    :tabindex="!context || context.tabStop.value === node ? 0 : -1"
    @focus="context?.focus(node)"
    @keydown="onKeydown"
  >
    <AGUIContextMenu v-if="contextMenu" :context-menu="contextMenu(node)">
      <template #trigger>
        <ReuseRow />
      </template>
    </AGUIContextMenu>
    <ReuseRow v-else />
    <div v-if="hasChildren && node.expanded" role="group">
      <!-- eslint-disable vue/custom-event-name-casing -->
      <AGUITreeNode
        v-for="(child, index) in node.children" :key="child.id || index"
        :current-node="currentNode" :node="child" :depth="depth + 1" :context-menu="contextMenu"
        :visible="visible && node.visible !== false"
        @node-activate="emit('node-activate', $event)" @node-dblclick="emit('node-dblclick', $event)"
        @node-collapse="emit('node-collapse', $event)" @node-expand="emit('node-expand', $event)"
        @node-hide="emit('node-hide', $event)" @node-show="emit('node-show', $event)"
        @node-selected="emit('node-selected', $event)" @node-unselected="emit('node-unselected', $event)"
      />
    </div>
  </div>
</template>

<style lang="scss">
.agui-tree {
  min-width: 0;
  color: var(--agui-c-text-1);
  background: var(--agui-c-bg-panel);
}
.agui-tree-item {
  outline: none;
  &:focus-visible > .agui-tree-node {
    outline: 2px solid var(--agui-c-focus);
    outline-offset: -2px;
  }
}
.agui-tree-node {
  display: flex;
  align-items: center;
  min-width: 0;
  min-height: var(--agui-control-height);
  padding-inline: calc(var(--depth) * 12px) 4px;
  font-size: 12px;
  user-select: none;
  &:hover {
    background: var(--agui-c-bg-hover);
  }
  &.active {
    color: var(--agui-c-selection-text);
    background: var(--agui-c-selection);
  }
  &.match .agui-tree-title {
    font-weight: 600;
    text-decoration: underline;
  }
  .agui-tree-title {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  &.muted .agui-tree-title,
  .is-hidden {
    opacity: 0.65;
  }
  .agui-tree-spacer {
    width: 24px;
    flex-shrink: 0;
  }
}
</style>
