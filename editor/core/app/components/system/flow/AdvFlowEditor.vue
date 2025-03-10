<script setup>
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { VueFlow } from '@vue-flow/core'
import { MiniMap } from '@vue-flow/minimap'
import { ref } from 'vue'

import './styles'

const flowStore = useFlowStore()

// our dark mode toggle flag
const dark = ref(true)
</script>

<template>
  <VueFlow
    v-model:nodes="flowStore.curItem.data.nodes"
    v-model:edges="flowStore.curItem.data.edges"
    :default-viewport="flowStore.curItem.data.viewport"
    :class="{ dark }"
    class="advjs-flow-editor"
    :min-zoom="0.2"
    :max-zoom="4"
  >
    <Background pattern-color="#aaa" :gap="16" />

    <MiniMap />

    <Controls position="top-left" />
  </VueFlow>
</template>
