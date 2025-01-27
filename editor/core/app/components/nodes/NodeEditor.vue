<script lang="ts" setup>
import { EditorComponent, useBaklava } from '@baklavajs/renderer-vue'

// import { OptionPlugin } from '@baklavajs/plugin-options-vue'
// import { Engine } from '@baklavajs/plugin-engine'

import MathNode from './MathNode'

const baklava = useBaklava()
baklava.editor.registerNodeType(MathNode)

onMounted(() => {
  // // register the nodes we have defined, so they can be
  // // added by the user as well as saved & loaded.
  // baklava.editor.registerNodeType(MathNode)
  // // baklava.editor.registerNodeType('DisplayNode', DisplayNode)

  // // add some nodes so the screen is not empty on startup
  // const node1 = addNodeWithCoordinates(MathNode, 100, 140)
  // // const node2 = addNodeWithCoordinates(DisplayNode, 400, 140)
  // // editor.addConnection(node1.getInterface('Result'), node2.getInterface('Value'))
  // // engine.calculate()

  // // typeof MathNode | typeof DisplayNode
  // function addNodeWithCoordinates(NodeType: any, x: number, y: number) {
  //   const n = new NodeType()
  //   // baklava.editor.addNode(n)
  //   // n.position.x = x
  //   // n.position.y = y
  //   return n
  // }
})
</script>

<template>
  <div class="relative h-full w-full">
    <!-- <HintOverlay /> -->
    <ClientOnly>
      <EditorComponent :view-model="baklava" />
    </ClientOnly>
  </div>
</template>
