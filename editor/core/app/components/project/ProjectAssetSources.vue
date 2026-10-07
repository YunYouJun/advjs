<script setup lang="ts">
import type { TreeNode } from '@advjs/gui'
import AGUITree from '@advjs/gui/client/components/tree/AGUITree.vue'
import { computed, ref, watch } from 'vue'
import { assetDirectoryTree, assetParentFolder } from '../../utils/asset-browser'

const props = defineProps<{ paths: string[], folder: string, label: string, allLabel: string }>()
const emit = defineEmits<{ browse: [folder: string] }>()
const expanded = new Set(['adv', 'adv/assets'])
const tree = ref<TreeNode[]>([])
watch(() => [props.paths, props.folder, props.allLabel] as const, () => {
  let folder = props.folder
  while (folder) {
    expanded.add(folder)
    folder = assetParentFolder(folder)
  }
  tree.value = [{ id: '', name: props.allLabel, icon: 'i-ri-folders-line', expanded: true, children: assetDirectoryTree(props.paths, expanded) }]
}, { immediate: true })
const current = computed(() => {
  function find(nodes: TreeNode[]): TreeNode | undefined {
    for (const node of nodes) {
      if (node.id === props.folder)
        return node
      const match = node.children && find(node.children)
      if (match)
        return match
    }
  }
  return find(tree.value)
})
function remember(nodes: TreeNode[], open: boolean) {
  for (const node of nodes) {
    if (node.id) {
      if (open)
        expanded.add(node.id)
      else
        expanded.delete(node.id)
    }
  }
}
</script>

<template>
  <AGUITree
    :data="tree" :current-node="current" :label="label"
    @node-activate="emit('browse', $event.id ?? '')"
    @node-expand="remember($event, true)"
    @node-collapse="remember($event, false)"
  />
</template>
