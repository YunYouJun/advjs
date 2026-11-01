<script setup lang="ts" generic="Diagnostic extends AuthoringDiagnostic">
import type { AuthoringDiagnostic } from './types'
import { computed, shallowRef, watch } from 'vue'

const props = withDefaults(defineProps<{
  diagnostics: readonly Diagnostic[]
  pageSize?: number
  disabled?: boolean
  labels?: { pages?: string, previous?: string, next?: string, empty?: string }
}>(), { pageSize: 80 })
const emit = defineEmits<{ navigate: [diagnostic: Diagnostic] }>()
const page = shallowRef(0)
const size = computed(() => Number.isFinite(props.pageSize) ? Math.max(1, Math.floor(props.pageSize)) : 80)
const pageCount = computed(() => Math.ceil(props.diagnostics.length / size.value))
const visible = computed(() => props.diagnostics.slice(page.value * size.value, (page.value + 1) * size.value))
watch(() => [props.diagnostics, props.diagnostics.length, size.value], () => {
  page.value = 0
})
function previous() {
  page.value = Math.max(0, page.value - 1)
}
function next() {
  page.value = Math.max(0, Math.min(pageCount.value - 1, page.value + 1))
}
function navigate(diagnostic: Diagnostic) {
  if (!props.disabled)
    emit('navigate', diagnostic)
}
</script>

<template>
  <div class="adv-diagnostics-panel" data-adv-authoring="diagnostics">
    <slot v-if="pageCount > 1" name="pagination" :page="page" :page-count="pageCount" :previous="previous" :next="next">
      <nav :aria-label="labels?.pages ?? 'Diagnostic pages'">
        <button :disabled="disabled || page === 0" @click="previous">
          {{ labels?.previous ?? 'Previous' }}
        </button><span>{{ page + 1 }} / {{ pageCount }}</span><button :disabled="disabled || page + 1 >= pageCount" @click="next">
          {{ labels?.next ?? 'Next' }}
        </button>
      </nav>
    </slot>
    <ul v-if="diagnostics.length" class="diagnostic-list">
      <li v-for="(diagnostic, index) in visible" :key="`${diagnostic.code}:${page}:${index}`" :data-severity="diagnostic.severity" :data-diagnostic-code="diagnostic.code">
        <slot name="diagnostic" :diagnostic="diagnostic" :navigate="() => navigate(diagnostic)">
          <button v-if="diagnostic.path" :disabled="disabled" :data-source-path="diagnostic.path" @click="navigate(diagnostic)">
            <code>{{ diagnostic.path }}{{ diagnostic.line ? `:${diagnostic.line}` : '' }}</code><span>{{ diagnostic.message }}</span>
          </button><span v-else>{{ diagnostic.message }}</span>
        </slot>
      </li>
    </ul>
    <slot v-else name="empty">
      {{ labels?.empty ?? 'No diagnostics' }}
    </slot>
  </div>
</template>

<style scoped>
.adv-diagnostics-panel {
  min-width: 0;
}
.diagnostic-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.diagnostic-list > li {
  overflow-wrap: anywhere;
}
.diagnostic-list button {
  max-width: 100%;
  white-space: normal;
  text-align: left;
  overflow-wrap: anywhere;
}
</style>
