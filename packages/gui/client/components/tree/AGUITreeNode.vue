<script lang="ts" setup>
import { onMounted, ref } from 'vue'

import Toggle from '../button/AGUIIcon.vue'
import type { TreeNode } from './types'

withDefaults(defineProps<{
  currentNode: TreeNode
  node: TreeNode
  depth?: number
  visible?: boolean
}>(), {
  depth: 0,
  visible: true,
})

const emit = defineEmits([
  'log',

  'node-activate',
  'node-collapse',
  'node-expand',
  'node-selected',
  'node-unselected',
  'node-show',
  'node-hide',
])

const el = ref<HTMLDivElement>()

onMounted(() => {
  // Assign outlineRow or any other initialization logic
})

function log() {
  emit('log')
}

function collapse(nodes: TreeNode[]) {
  // eslint-disable-next-line vue/custom-event-name-casing
  emit('node-collapse', nodes)
}
function expand(nodes: TreeNode[]) {
  // eslint-disable-next-line vue/custom-event-name-casing
  emit('node-expand', nodes)
}

function hide(nodes: TreeNode[]) {
  // eslint-disable-next-line vue/custom-event-name-casing
  emit('node-hide', nodes)
}
function show(nodes: TreeNode[]) {
  // eslint-disable-next-line vue/custom-event-name-casing
  emit('node-show', nodes)
}

function onNodeSelected(nodes: TreeNode[]) {
  // eslint-disable-next-line vue/custom-event-name-casing
  emit('node-selected', nodes)
}
function onNodeUnselected(nodes: TreeNode[]) {
  // eslint-disable-next-line vue/custom-event-name-casing
  emit('node-unselected', nodes)
}

function onKeyDown(_event: KeyboardEvent) {
  // The keyboard navigation logic goes here
  // You'll need to handle focus and sibling element traversal in Vue 3 terms
}

function onNodeActivated(node: TreeNode) {
  // eslint-disable-next-line vue/custom-event-name-casing
  emit('node-activate', node)
}
</script>

<template>
  <div
    v-if="node"
    ref="el"
    class="agui-tree-node"
    :class="[{ active: node === currentNode, muted: node.muted, match: node.match }]"
    :style="{ '--depth': `${depth}` }"
    tabindex="0"
    :title="node.name || `[${node.type}]`"
    @click="onNodeActivated(node)"
    @dblclick="log"
    @keydown="onKeyDown"
  >
    <div class="content" :class="{ invisible: node.visible === false || visible === false }">
      <template v-if="node.children && node.children.length > 0">
        <Toggle
          :icon="node.expanded ? 'expanded' : 'collapsed'"
          @click="node.expanded ? collapse([node]) : expand([node])"
        />
      </template>
      <template v-else>
        <span class="toggle-spacer" />
      </template>
      <span class="title">{{ node.name || `[${node.type}]` }}</span>
    </div>

    <template v-if="(typeof node.selectable === 'boolean')">
      <template v-if="node.selectable">
        <Toggle
          icon="selectable"
          hint="Disable right-click selection"
          :muted="node.parentUnselectable"
          @click="onNodeUnselected([node])"
        />
      </template>
      <template v-else>
        <Toggle
          icon="unselectable"
          hint="Enable right-click selection"
          :muted="node.parentUnselectable"
          @click="onNodeSelected([node])"
        />
      </template>
    </template>
    <template v-if="typeof node.visible === 'boolean'">
      <Toggle
        :icon="node.visible ? 'eye-opened' : 'eye-closed'"
        :hint="node.visible ? 'Hide (h)' : 'Show (h)'"
        @click="node.visible ? hide([node]) : show([node])"
      />
    </template>
  </div>

  <template v-if="node.expanded">
    <template v-for="(child, _i) in node.children" :key="child.id || _i">
      <AGUITreeNode
        :current-node="currentNode"
        :node="child"
        :depth="depth + 1"

        :visible="typeof node.visible === 'boolean' ? visible && node.visible : visible"

        @node-activate="onNodeActivated"
        @node-collapse="collapse"
        @node-expand="expand"
        @node-hide="hide"
        @node-show="show"
        @node-selected="onNodeSelected"
        @node-unselected="onNodeUnselected"
      />
    </template>
  </template>
</template>

<style lang="scss">
.agui-tree-node {
  display: flex;
  align-items: center;
  background: #282828;
  color: #c2c2c2;
  height: 20px;
  padding-left: calc(var(--depth) * 15px);
  outline: none;
  padding-right: 4px;

  &:nth-child(even) {
    background-color: #2b2b2b;
  }
  &:focus {
    background-color: #334d80;
  }

  &.match {
    background-color: #2f552f;
    &:focus {
      background-color: #336659;
    }
  }
  &.active {
    color: #ffaf29;
  }

  > .content {
    flex: 1;

    display: flex;
    align-items: center;

    &.invisible {
      visibility: visible;
      opacity: 0.5;
    }
  }

  .title {
    flex: 1;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    user-select: none;
    position: default;

    width: 0px;

    font-size: small;

    .muted & {
      opacity: 0.5;
    }
  }

  .toggle-spacer {
    width: 20px;
  }
}
</style>
