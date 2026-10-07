<script setup lang="ts">
import { computed, ref } from 'vue'
import JsonCode from './JsonCode.vue'

const props = defineProps<{ title: string, value: unknown, open?: boolean, meta?: string }>()
const expanded = ref(props.open ?? false)
const code = computed(() => JSON.stringify(props.value, null, 2) ?? 'null')
function onToggle(event: Event) {
  expanded.value = (event.currentTarget as HTMLDetailsElement).open
}
</script>

<template>
  <details class="json-details" :open="expanded" @toggle="onToggle">
    <summary>
      <svg class="disclosure-chevron" width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m6 4 4 4-4 4" stroke="currentColor" stroke-width="1.5" /></svg>
      <span class="json-summary">
        <slot name="summary">
          <span class="json-title">{{ title }}</span><span v-if="meta" class="json-meta">{{ meta }}</span>
        </slot>
      </span>
    </summary>
    <div class="json-content">
      <JsonCode :code="code" :enabled="expanded" />
    </div>
  </details>
</template>
