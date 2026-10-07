<script setup lang="ts">
import type { RuntimeTraceEntry } from '@advjs/types'
import { computed } from 'vue'
import DevToolsSection from './DevToolsSection.vue'
import JsonDetails from './JsonDetails.vue'

const props = defineProps<{ entries: RuntimeTraceEntry[] }>()
const trace = computed(() => [...props.entries].reverse())
</script>

<template>
  <DevToolsSection title="剧情追踪" :meta="`${trace.length} 条 · 最新在前`" class="trace-section">
    <p v-if="!trace.length" class="section-empty">
      尚未执行剧情操作。
    </p>
    <JsonDetails v-for="entry in trace" :key="entry.sequence" :title="entry.command" :value="entry">
      <template #summary>
        <span class="trace-summary">
          <span class="trace-heading"><code>#{{ entry.sequence }} {{ entry.command }}</code><span class="trace-status">{{ entry.status }}</span></span>
          <span class="trace-address"><code>{{ entry.from.chapterId || '—' }} / {{ entry.from.nodeId || '—' }}</code><span aria-label="到">→</span><code>{{ entry.to.chapterId || '—' }} / {{ entry.to.nodeId || '—' }}</code></span>
        </span>
      </template>
    </JsonDetails>
  </DevToolsSection>
</template>
