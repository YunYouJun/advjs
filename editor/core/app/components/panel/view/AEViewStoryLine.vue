<script setup lang="ts">
import type { AdvDialoguesNode } from '@advjs/types'
import { useAdvContext, useDialogStore } from '@advjs/client'
import { TreeItem, TreeRoot } from 'radix-vue'

const { $adv } = useAdvContext()

export interface TreeNode {
  id?: string
  title: string
  icon?: string
  children?: TreeNode[]
}

const dialogStore = useDialogStore()

const items = computed(() => {
  const curChapter = $adv.gameConfig.value.chapters?.[0]
  if (!curChapter)
    return []

  if (typeof curChapter.data === 'string')
    return []

  const nodes = curChapter.data.nodes.map((node) => {
    const treeNode: TreeNode = {
      id: node.id,
      title: node.id,
      icon: 'lucide:file',
    }

    switch (node.type) {
      case 'background':
        treeNode.icon = 'i-ri:signpost-line'
        break
      case 'choices':
        treeNode.icon = 'i-ri:toggle-line'
        break
      case 'tachie':
        treeNode.icon = 'i-ri:user-line'
        break
      case 'narration':
        treeNode.icon = 'i-ri:chat-2-line'
        break
      default:
        break
    }

    if (node.type === 'dialogues') {
      const curNode = node as unknown as AdvDialoguesNode
      if (curNode.children.length > 0) {
        treeNode.children = curNode.children.map((child, i) => ({
          id: `${node.id}-${i}`,
          title: `${i}. ${child.speaker}`,
          icon: 'i-ri-message-2-line',
        }))
      }
    }
    return treeNode
  })

  return nodes
})

const expanded = ref<string[]>([])
watch(
  () => $adv.store.curFlowNode,
  (curNode) => {
    if (!curNode)
      return

    const curId = curNode.id
    expanded.value = [curId]
  },
  { immediate: true },
)
</script>

<template>
  <TreeRoot
    v-slot="{ flattenItems }"
    v-model:expanded="expanded"
    class="text-blackA11 select-none list-none rounded-lg text-sm font-medium"
    :items="items"
    :get-key="(item) => item.title"
  >
    <TreeItem
      v-for="item in flattenItems"
      v-slot="{ isExpanded }"
      :key="item._id"
      :style="{ 'padding-left': `${item.level - 0.5}rem` }"
      v-bind="item.bind"
      class="flex cursor-pointer items-center px-2 py-1 text-xs outline-none data-[selected]:bg-blue-600"
      :class="{
        'bg-dark-600': item.value.id === $adv.store.curFlowNode?.id,
        'bg-dark-700': item.value.id === `${$adv.store.curFlowNode?.id}-${dialogStore.iOrder}`,
      }"
    >
      <template v-if="item.hasChildren">
        <div
          v-if="!isExpanded"
          class="i-vscode-icons:folder-type-log size-4"
        />
        <div
          v-else
          class="i-vscode-icons:folder-type-log-opened size-4"
        />
      </template>
      <div
        v-else
        :class="item.value.icon || 'i-ri:file-3-line'"
        class="size-4"
      />
      <div class="pl-2 op-80">
        {{ item.value.title }}
      </div>
    </TreeItem>
  </TreeRoot>
</template>
