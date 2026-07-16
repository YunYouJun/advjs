<script setup lang="ts">
import type { JsonObject, JsonValue } from '@advjs/types'
import { computed, shallowRef } from 'vue'

defineOptions({ name: 'RuntimeJsonTree' })

const props = withDefaults(defineProps<{
  value: JsonValue
  label?: string
  path?: string
  depth?: number
}>(), {
  label: '',
  path: 'root',
  depth: 0,
})

const expanded = shallowRef(props.depth === 0)
const objectValue = computed(() => (
  props.value && typeof props.value === 'object' && !Array.isArray(props.value)
    ? props.value as JsonObject
    : undefined
))
const isContainer = computed(() => Array.isArray(props.value) || Boolean(objectValue.value))
const entries = computed(() => {
  if (Array.isArray(props.value))
    return props.value.map((value, index) => [String(index), value] as const)
  if (objectValue.value)
    return Object.entries(objectValue.value).sort(([left], [right]) => left.localeCompare(right))
  return []
})

function display(value: JsonValue): string {
  return typeof value === 'string' ? value : JSON.stringify(value)
}
</script>

<template>
  <div class="runtime-json-tree">
    <div v-if="label" class="runtime-json-tree__row" :style="{ paddingLeft: `${depth * 0.8}rem` }">
      <button
        v-if="isContainer"
        type="button"
        class="runtime-json-tree__toggle"
        :aria-label="`${expanded ? 'Collapse' : 'Expand'} ${label}`"
        :aria-expanded="expanded"
        @click="expanded = !expanded"
      >
        {{ expanded ? '▾' : '▸' }} <strong>{{ label }}</strong>
      </button>
      <template v-else>
        <strong>{{ label }}</strong>
        <span aria-hidden="true">:</span>
        <span>{{ display(value) }}</span>
      </template>
    </div>

    <div v-if="(!label || expanded) && isContainer" class="runtime-json-tree__children">
      <RuntimeJsonTree
        v-for="([key, child]) in entries"
        :key="`${path}.${key}`"
        :value="child"
        :label="key"
        :path="`${path}.${key}`"
        :depth="depth + 1"
      />
      <p v-if="entries.length === 0" class="runtime-json-tree__empty">
        Empty
      </p>
    </div>
  </div>
</template>

<style scoped>
.runtime-json-tree__row {
  display: flex;
  min-height: 1.8rem;
  align-items: center;
  gap: 0.4rem;
  overflow-wrap: anywhere;
}

.runtime-json-tree__toggle {
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
}

.runtime-json-tree__empty {
  margin: 0.2rem 0;
  color: #94a3b8;
  font-style: italic;
}
</style>
