<script setup lang="ts">
import type { JsonValue, RuntimeTraceEntry } from '@advjs/types'
import type { RuntimeInspectorModel } from '../../runtime/inspector'
import { computed, shallowRef } from 'vue'
import RuntimeJsonTree from './RuntimeJsonTree.vue'
import RuntimeTraceList from './RuntimeTraceList.vue'

const props = withDefaults(defineProps<{
  model: RuntimeInspectorModel
  showExport?: boolean
  emptyTraceLabel?: string
}>(), {
  showExport: true,
  emptyTraceLabel: 'No trace entries',
})

defineEmits<{
  export: []
}>()

type Tab = 'overview' | 'variables' | 'stage' | 'trace'
const tabs: Array<{ id: Tab, label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'variables', label: 'Variables' },
  { id: 'stage', label: 'Stage' },
  { id: 'trace', label: 'Trace' },
]
const currentTab = shallowRef<Tab>('overview')
const selectedSequence = shallowRef<number>()
const selected = computed(() => props.model.trace.find(entry => entry.sequence === selectedSequence.value))
const stage = computed(() => structuredClone(props.model.stage) as unknown as JsonValue)

function address(value: RuntimeTraceEntry['from']) {
  return `${value.chapterId}#${value.nodeId}`
}

function value(value: JsonValue | undefined) {
  return value === undefined ? '∅' : typeof value === 'string' ? value : JSON.stringify(value)
}
</script>

<template>
  <section class="runtime-inspector-panel">
    <header class="runtime-inspector-panel__header">
      <div>
        <h2>Runtime Inspector</h2>
        <p>{{ model.address.chapterId }}#{{ model.address.nodeId }}</p>
      </div>
      <button v-if="showExport" type="button" aria-label="Export runtime report" @click="$emit('export')">
        Export
      </button>
    </header>

    <div role="tablist" aria-label="Runtime inspector sections" class="runtime-inspector-panel__tabs">
      <button
        v-for="tab in tabs"
        :id="`runtime-${tab.id}-tab`"
        :key="tab.id"
        type="button"
        role="tab"
        :aria-selected="currentTab === tab.id"
        :aria-controls="`runtime-${tab.id}`"
        @click="currentTab = tab.id"
      >
        {{ tab.label }}
      </button>
    </div>

    <div
      v-if="currentTab === 'overview'"
      id="runtime-overview"
      role="tabpanel"
      aria-labelledby="runtime-overview-tab"
      class="runtime-inspector-panel__content"
    >
      <dl class="runtime-inspector-panel__overview">
        <dt>Address</dt><dd>{{ model.address.chapterId }}#{{ model.address.nodeId }}</dd>
        <dt>Status</dt><dd>{{ model.status }}</dd>
        <dt>Node</dt><dd>{{ model.current?.kind ?? 'none' }} · {{ model.current?.id ?? 'none' }}</dd>
        <dt>History</dt><dd>{{ model.checkpointCount }} checkpoints · {{ model.visited.length }} visited</dd>
        <dt>Pending activity</dt><dd>{{ model.pendingActivity?.type ?? 'none' }}</dd>
      </dl>
    </div>

    <div
      v-else-if="currentTab === 'variables'"
      id="runtime-variables"
      role="tabpanel"
      aria-labelledby="runtime-variables-tab"
      class="runtime-inspector-panel__content"
    >
      <RuntimeJsonTree :value="model.variables" />
    </div>

    <div
      v-else-if="currentTab === 'stage'"
      id="runtime-stage"
      role="tabpanel"
      aria-labelledby="runtime-stage-tab"
      class="runtime-inspector-panel__content"
    >
      <RuntimeJsonTree :value="stage" />
    </div>

    <div
      v-else
      id="runtime-trace"
      role="tabpanel"
      aria-labelledby="runtime-trace-tab"
      class="runtime-inspector-panel__content runtime-inspector-panel__trace"
    >
      <RuntimeTraceList
        :entries="model.trace"
        :selected-sequence="selectedSequence"
        :empty-label="emptyTraceLabel"
        @select="selectedSequence = $event.sequence"
      />
      <article v-if="selected" class="runtime-inspector-panel__trace-detail" aria-label="Selected trace details">
        <h3>#{{ selected.sequence }} {{ selected.command }}</h3>
        <p>{{ address(selected.from) }} → {{ address(selected.to) }}</p>
        <p>Effects: {{ selected.effects.map(effect => effect.type).join(', ') || 'none' }}</p>
        <ul>
          <li v-for="change in selected.variableChanges" :key="change.path">
            <strong>{{ change.path }}</strong>: {{ value(change.before) }} → {{ value(change.after) }}
          </li>
        </ul>
      </article>
    </div>
  </section>
</template>

<style scoped>
.runtime-inspector-panel {
  display: flex;
  min-height: 100%;
  flex-direction: column;
  gap: 1rem;
  color: #e2e8f0;
}

.runtime-inspector-panel__header,
.runtime-inspector-panel__tabs {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.runtime-inspector-panel__header h2,
.runtime-inspector-panel__header p {
  margin: 0;
}

.runtime-inspector-panel__tabs {
  justify-content: flex-start;
  overflow-x: auto;
}

.runtime-inspector-panel button {
  padding: 0.5rem 0.75rem;
  border: 1px solid #475569;
  border-radius: 0.4rem;
  background: #0f172a;
  color: inherit;
}

.runtime-inspector-panel [role='tab'][aria-selected='true'] {
  border-color: #38bdf8;
  color: #7dd3fc;
}

.runtime-inspector-panel__content {
  min-height: 12rem;
}

.runtime-inspector-panel__overview {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 0.65rem 1rem;
}

.runtime-inspector-panel__overview dd {
  margin: 0;
}

.runtime-inspector-panel__trace {
  display: grid;
  grid-template-columns: minmax(15rem, 1fr) minmax(15rem, 1fr);
  gap: 1rem;
}

.runtime-inspector-panel__trace-detail {
  padding: 1rem;
  border: 1px solid #334155;
  border-radius: 0.5rem;
  background: #020617;
}

@media (width <= 720px) {
  .runtime-inspector-panel__trace {
    grid-template-columns: 1fr;
  }
}
</style>
