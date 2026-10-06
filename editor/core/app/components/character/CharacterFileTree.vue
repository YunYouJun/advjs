<script setup lang="ts">
import type { FileTreeNode } from '~/stores/useCharacterStore'
import { computed, ref, watch } from 'vue'

interface CharacterTreeNode {
  id: string
  name: string
  expanded: boolean
  source: FileTreeNode
  children?: CharacterTreeNode[]
}
const props = defineProps<{ nodes: FileTreeNode[], selected?: string }>()
const emit = defineEmits<{ select: [node: FileTreeNode] }>()
const tree = ref<CharacterTreeNode[]>([])
const byPath = computed(() => {
  const map = new Map<string, CharacterTreeNode>()
  function visit(nodes: CharacterTreeNode[]) {
    for (const node of nodes) {
      map.set(node.id, node)
      if (node.children)
        visit(node.children)
    }
  }
  visit(tree.value)
  return map
})
watch(() => props.nodes, (nodes) => {
  const previous = byPath.value
  function adapt(items: FileTreeNode[]): CharacterTreeNode[] {
    return items.map(source => ({
      id: source.path,
      name: source.name.replace(/\.character\.md$/, ''),
      expanded: previous.get(source.path)?.expanded ?? false,
      source,
      children: source.kind === 'directory' ? adapt(source.children ?? []) : undefined,
    }))
  }
  tree.value = adapt(nodes)
}, { immediate: true, deep: true })
function activate(node: CharacterTreeNode) {
  if (node.source.kind === 'file')
    emit('select', node.source)
}
</script>

<template>
  <AGUITree :data="tree" :current-node="selected ? byPath.get(selected) : undefined" :label="$t('characters.title')" @node-activate="activate" />
</template>
