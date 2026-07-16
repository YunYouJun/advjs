<script setup lang="ts">
import type { RuntimeCommandName, RuntimeTraceEntry } from '@advjs/types'
import { computed, shallowRef } from 'vue'

const props = withDefaults(defineProps<{
  entries: RuntimeTraceEntry[]
  selectedSequence?: number
  emptyLabel?: string
}>(), {
  emptyLabel: 'No trace entries',
})

const emit = defineEmits<{
  select: [entry: RuntimeTraceEntry]
}>()

const command = shallowRef<'all' | RuntimeCommandName>('all')
const commands: Array<'all' | RuntimeCommandName> = [
  'all',
  'start',
  'next',
  'choose',
  'go',
  'back',
  'restore',
  'complete-activity',
]
const filtered = computed(() => command.value === 'all'
  ? props.entries
  : props.entries.filter(entry => entry.command === command.value))

function address(value: RuntimeTraceEntry['from']) {
  return `${value.chapterId}#${value.nodeId}`
}
</script>

<template>
  <div class="runtime-trace-list">
    <label class="runtime-trace-list__filter">
      <span>Command</span>
      <select v-model="command" aria-label="Filter trace command">
        <option v-for="item in commands" :key="item" :value="item">
          {{ item }}
        </option>
      </select>
    </label>

    <div class="runtime-trace-list__entries">
      <button
        v-for="entry in filtered"
        :key="entry.sequence"
        type="button"
        data-trace-entry
        :aria-pressed="selectedSequence === entry.sequence"
        @click="emit('select', entry)"
      >
        <strong>#{{ entry.sequence }} {{ entry.command }}</strong>
        <span>{{ entry.status }}</span>
        <small>{{ address(entry.from) }} → {{ address(entry.to) }}</small>
        <small>{{ entry.effects.length }} effects · {{ entry.variableChanges.length }} diffs</small>
      </button>
      <p v-if="filtered.length === 0">
        {{ emptyLabel }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.runtime-trace-list,
.runtime-trace-list__entries,
.runtime-trace-list__entries button {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.runtime-trace-list__filter {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.runtime-trace-list__entries button {
  padding: 0.75rem;
  border: 1px solid #334155;
  border-radius: 0.5rem;
  background: #0f172a;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.runtime-trace-list__entries button[aria-pressed='true'] {
  border-color: #38bdf8;
  background: #0c4a6e;
}
</style>
