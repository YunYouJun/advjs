<!-- eslint-disable no-console -->
<script lang="ts" setup>
import type { TreeNode, Trees } from '@advjs/gui'
import type { AdvDialoguesNode } from '@advjs/types'
import { useAdvContext } from '@advjs/client'
import AGUITree from '@advjs/gui/client/components/tree/AGUITree.vue'
import { ref, watch } from 'vue'

const { $adv } = useAdvContext()

const treeData = ref<Trees>([])
watch(() => $adv.gameConfig.value.chapters, () => {
  const curChapter = $adv.gameConfig.value.chapters?.[0]
  if (!curChapter)
    return []

  if (typeof curChapter.data === 'string')
    return []

  const nodes = curChapter.data.nodes.map((node) => {
    const treeNode: TreeNode = {
      name: node.id,
      selectable: true,
      expanded: true,
    }

    if (node.type === 'dialogues') {
      treeNode.children = (node as unknown as AdvDialoguesNode).children.map(child => ({
        name: child.speaker,
        selectable: true,
        expanded: true,
        children: [],
      }))
    }
    return treeNode
  })
  treeData.value = nodes
}, { deep: true })

// const treeData = ref<Trees>([
//   {
//     name: 'Level one 1',
//     children: [
//       {
//         name: 'Level two 1-1',
//         children: [
//           {
//             name: 'Level three 1-1-1',
//           },
//         ],
//       },
//     ],
//   },
//   {
//     name: 'Level one 2',
//     visible: true,
//     children: [
//       {
//         name: 'Level two 2-1',
//         visible: true,
//         children: [
//           {
//             name: 'Level three 2-1-1',
//           },
//         ],
//       },
//       {
//         name: 'Level two 2-2',
//         children: [
//           {
//             name: 'Level three 2-2-1',
//           },
//         ],
//       },
//     ],
//   },
//   {
//     name: 'Level one 3',
//     expanded: true,
//     children: [
//       {
//         name: 'Level two 3-1',
//         expanded: true,
//         children: [
//           {
//             name: 'Level three 3-1-1',
//             selectable: true,
//           },
//           {
//             name: 'Level three 3-1-2 Long Name Long Name Long Name Long Name Long Name Long Name',
//             selectable: true,
//           },
//         ],
//       },
//       {
//         name: 'Level two 3-2',
//         visible: false,
//         children: [
//           {
//             name: 'Level three 3-2-1',
//           },
//         ],
//       },
//     ],
//   },
// ])

function onSelected(nodes: Trees) {
  console.log('onSelected', nodes)
}

function onUnselected(nodes: Trees) {
  console.log('onUnselected', nodes)
}

function hide(nodes: Trees) {
  console.log('hide', nodes)
}

function show(nodes: Trees) {
  console.log('show', nodes)
}

function collapse(nodes: Trees) {
  console.log('collapse', nodes)
}

function expand(nodes: Trees) {
  console.log('expand', nodes)
}

function activate(node: TreeNode) {
  console.log('activate', node)
}
</script>

<template>
  <AGUITree
    :data="treeData"
    @node-selected="onSelected"
    @node-unselected="onUnselected"
    @node-hide="hide"
    @node-show="show"
    @node-collapse="collapse"
    @node-expand="expand"
    @node-activate="activate"
  />
</template>
