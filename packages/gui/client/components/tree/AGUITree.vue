<!-- eslint-disable vue/custom-event-name-casing -->
<script setup lang="ts">
import type { AGUIContextMenuItemType } from '../context-menu/types'
import type { TreeNode, Trees } from './types'
import { computed, provide, shallowRef } from 'vue'
import AGUITreeNode from './AGUITreeNode.vue'
import { treeContextKey } from './context'

const props = withDefaults(defineProps<{
  currentNode?: TreeNode
  data: Trees | TreeNode
  label?: string
  depth?: number
  contextMenu?: (node: TreeNode) => AGUIContextMenuItemType[]
}>(), {
  depth: 0,
  label: 'Tree',
})

const emit = defineEmits([
  'node-activate',
  'node-dblclick',
  'node-collapse',
  'node-expand',
  'node-selected',
  'node-unselected',
  'node-show',
  'node-hide',

  'log',

  'update:currentNode',
],
)

const selectedNode = shallowRef<TreeNode>()
const focusedNode = shallowRef<TreeNode>()
const currentNode = computed(() => props.currentNode ?? selectedNode.value)
const roots = computed(() => Array.isArray(props.data) ? props.data : [props.data])
const visibleNodes = computed(() => {
  const nodes: TreeNode[] = []
  function visit(items: TreeNode[]) {
    for (const node of items) {
      nodes.push(node)
      if (node.expanded && node.children)
        visit(node.children)
    }
  }
  visit(roots.value)
  return nodes
})
const tabStop = computed(() => {
  const nodes = visibleNodes.value
  return [focusedNode.value, currentNode.value].find(node => node && nodes.includes(node)) ?? nodes[0]
})
provide(treeContextKey, { tabStop, focus: node => focusedNode.value = node })

function expand(nodes: TreeNode[]) {
  nodes.forEach((node) => {
    node.expanded = true
  })
  emit('node-expand', nodes)
}

function collapse(nodes: TreeNode[]) {
  nodes.forEach((node) => {
    node.expanded = false
  })
  emit('node-collapse', nodes)
}

function onSelected(nodes: Trees) {
  nodes.forEach((node) => {
    node.selectable = true
  })
  emit('node-selected', nodes)
}

function onUnselected(nodes: Trees) {
  nodes.forEach((node) => {
    node.selectable = false
  })
  emit('node-unselected', nodes)
}

function show(nodes: Trees) {
  nodes.forEach((node) => {
    node.visible = true
  })
  emit('node-show', nodes)
}

function hide(nodes: Trees) {
  nodes.forEach((node) => {
    node.visible = false
  })
  emit('node-hide', nodes)
}

function activate(node: TreeNode) {
  selectedNode.value = node
  node.active = true
  emit('node-activate', node)
  emit('update:currentNode', node)
}

function onDblClick(node: TreeNode) {
  emit('node-dblclick', node)
}
</script>

<template>
  <div class="agui-tree" role="tree" :aria-label="label">
    <AGUITreeNode
      v-for="(node, index) in roots" :key="node.id || node.name || index"
      :current-node="currentNode"
      :node="node"
      :depth="depth"
      :context-menu="contextMenu"
      @node-activate="activate"
      @node-dblclick="onDblClick"
      @node-collapse="collapse"
      @node-expand="expand"
      @node-show="show"
      @node-hide="hide"
      @node-selected="onSelected"
      @node-unselected="onUnselected"
    />
  </div>
</template>
