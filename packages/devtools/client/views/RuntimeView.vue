<script setup lang="ts">
import type { DevToolsSnapshot } from '../../src/types'
import RuntimeOverview from './RuntimeOverview.vue'
import RuntimeStateView from './RuntimeStateView.vue'
import RuntimeTraceView from './RuntimeTraceView.vue'

defineProps<{ snapshot: DevToolsSnapshot }>()
</script>

<template>
  <section class="runtime-view" aria-label="运行时状态">
    <RuntimeOverview :snapshot="snapshot" />
    <div class="runtime-workspace">
      <RuntimeStateView :state="snapshot.state" :current="snapshot.current" />
      <RuntimeTraceView :entries="snapshot.trace" />
    </div>
  </section>
</template>
