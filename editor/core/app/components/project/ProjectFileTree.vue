<script setup lang="ts">
import type { TreeNode } from '@advjs/gui'
import AGUITree from '@advjs/gui/client/components/tree/AGUITree.vue'
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import { projectFileTree } from '../../utils/project-files'

const props = defineProps<{ paths: string[], selected?: string, query: string, label: string, revealVersion?: number }>()
const emit = defineEmits<{ open: [path: string] }>()
const expanded = new Set(['adv', 'adv/chapters', 'adv/characters', 'adv/scenes'])
const tree = ref<TreeNode[]>([])
const root = useTemplateRef<HTMLElement>('root')
watch(() => [props.paths, props.query, props.selected] as const, () => {
  const segments = props.selected?.split('/') ?? []
  for (let length = 1; length < segments.length; length++)
    expanded.add(segments.slice(0, length).join('/'))
  tree.value = projectFileTree(props.paths, expanded, props.query)
}, { immediate: true })
watch(() => props.revealVersion, async (version) => {
  if (!version)
    return
  await nextTick()
  const selected = root.value?.querySelector<HTMLElement>('[aria-selected="true"]')
  selected?.scrollIntoView({ block: 'nearest' })
  selected?.focus()
}, { immediate: true })
const current = computed(() => {
  function find(nodes: TreeNode[]): TreeNode | undefined {
    for (const node of nodes) {
      if (node.id === props.selected)
        return node
      const child = node.children && find(node.children)
      if (child)
        return child
    }
  }
  return find(tree.value)
})
function open(node: TreeNode) {
  if (node.kind === 'file' && node.id)
    emit('open', node.id)
}
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
  <div ref="root">
    <AGUITree
      :data="tree" :current-node="current" :label="label"
      @node-activate="open"
      @node-expand="remember($event, true)"
      @node-collapse="remember($event, false)"
    />
  </div>
</template>
