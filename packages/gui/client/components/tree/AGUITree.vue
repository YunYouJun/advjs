<!-- eslint-disable vue/custom-event-name-casing -->
<script setup lang="ts">
import type { TreeNode, Trees } from './types'
import { computed } from 'vue'
import AGUITreeNode from './AGUITreeNode.vue'

const props = withDefaults(defineProps<{
  currentNode?: TreeNode
  data: Trees | TreeNode
  depth?: number
}>(), {
  depth: 0,
})

const emit = defineEmits([
  'node-activate',
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

const currentNode = computed(() => props.currentNode || {
  name: 'root',
})

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
  node.active = true
  emit('node-activate', node)
  emit('update:currentNode', node)
}
</script>

<template>
  <div class="agui-tree">
    <template v-if="Array.isArray(data)">
      <template v-for="(tree, _i) in data" :key="tree.id || tree.name || _i">
        <AGUITreeNode
          :current-node="currentNode"
          :node="tree"
          :depth="depth || 0"

          @node-activate="activate"
          @node-collapse="collapse"
          @node-expand="expand"
          @node-show="show"
          @node-hide="hide"
          @node-selected="onSelected"
          @node-unselected="onUnselected"
        />
      </template>
    </template>
    <template v-else>
      <AGUITreeNode
        :current-node="currentNode"
        :node="data"
        :depth="depth || 0"

        @node-activate="activate"
        @node-collapse="collapse"
        @node-expand="expand"
        @node-show="show"
        @node-hide="hide"
        @node-selected="onSelected"
        @node-unselected="onUnselected"
      />
    </template>
  </div>
</template>
