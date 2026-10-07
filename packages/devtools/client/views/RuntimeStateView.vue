<script setup lang="ts">
import type { DevToolsSnapshot } from '../../src/types'
import { computed } from 'vue'
import DevToolsSection from './DevToolsSection.vue'
import JsonDetails from './JsonDetails.vue'

const props = defineProps<{ state: DevToolsSnapshot['state'], current?: DevToolsSnapshot['current'] }>()
const variableCount = computed(() => Object.keys(props.state.variables).length)
</script>

<template>
  <DevToolsSection title="状态数据">
    <JsonDetails title="变量" :meta="`${variableCount} 项`" :value="state.variables" :open="true" />
    <JsonDetails title="舞台" :value="state.stage" />
    <JsonDetails title="当前节点" :meta="current?.kind" :value="current ?? null" />
  </DevToolsSection>
</template>
