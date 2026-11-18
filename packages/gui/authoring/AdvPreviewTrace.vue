<script setup lang="ts">
import type { PreviewCursor, PreviewTraceItem } from './preview-types'
import { computed } from 'vue'

const props = defineProps<{
  entries: readonly PreviewTraceItem[]
  steps: number
  cursors?: readonly PreviewCursor[]
  disabled?: boolean
  limit?: number
  labels?: { cursors?: string, trace?: string, steps?: (count: number) => string, active?: string, inactive?: string, empty?: string, changes?: (count: number) => string, unset?: string, retained?: (count: number) => string }
}>()
const emit = defineEmits<{ locate: [cursor: PreviewCursor] }>()
defineSlots<{ cursor?: (props: { cursor: PreviewCursor, disabled: boolean, locate: () => void }) => any }>()
const limit = computed(() => Number.isFinite(props.limit) ? Math.max(1, Math.min(2000, Math.floor(props.limit!))) : 200)
const entries = computed(() => props.entries.slice(-limit.value).reverse())
const omitted = computed(() => props.steps > entries.value.length)
function value(input: unknown) {
  return input === undefined ? props.labels?.unset ?? 'Unset' : JSON.stringify(input)
}
function locate(cursor: PreviewCursor) {
  if (!props.disabled)
    emit('locate', cursor)
}
</script>

<template>
  <aside class="adv-preview-trace">
    <template v-if="cursors?.length">
      <h3>{{ labels?.cursors ?? 'Flow cursors' }}</h3>
      <div class="cursors">
        <template v-for="cursor in cursors" :key="cursor.id">
          <slot name="cursor" :cursor="cursor" :disabled="!!disabled" :locate="() => locate(cursor)">
            <button type="button" :disabled="disabled" :data-active="cursor.active" @click="locate(cursor)">
              <span>{{ cursor.label }} · {{ cursor.active ? labels?.active ?? 'Active' : labels?.inactive ?? 'Inactive' }}</span><code>{{ cursor.node }}</code>
            </button>
          </slot>
        </template>
      </div>
    </template>
    <h3>{{ labels?.trace ?? 'Execution trace' }} <span>{{ labels?.steps?.(steps) ?? `${steps} steps` }}</span></h3>
    <p v-if="!entries.length">
      {{ labels?.empty ?? 'Start the preview to record inputs and state changes.' }}
    </p>
    <ol class="entries">
      <li v-for="entry in entries" :key="entry.sequence" :data-trace-sequence="entry.sequence">
        <strong>{{ String(entry.sequence).padStart(2, '0') }} · {{ entry.label }}</strong>
        <p v-for="(message, index) in entry.messages" :key="index">
          {{ message }}
        </p>
        <details v-if="entry.changes.length">
          <summary>{{ labels?.changes?.(entry.changes.length) ?? `${entry.changes.length} state changes` }}</summary><dl>
            <div v-for="change in entry.changes" :key="change.key">
              <dt>{{ change.key }}</dt><dd>{{ value(change.before) }} → {{ value(change.after) }}</dd>
            </div>
          </dl>
        </details>
      </li>
    </ol>
    <p v-if="omitted">
      {{ labels?.retained?.(entries.length) ?? `Showing the latest ${entries.length} entries. Replay history is managed by the host.` }}
    </p>
  </aside>
</template>

<style scoped>
.adv-preview-trace {
  min-width: 0;
}
.cursors {
  display: flex;
  flex-direction: column;
}
.entries {
  padding: 0;
  margin: 0;
  list-style: none;
}
p,
dt,
dd,
code {
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}
</style>
