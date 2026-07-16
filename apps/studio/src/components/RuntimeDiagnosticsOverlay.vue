<script setup lang="ts">
import type { CompileDiagnostic } from '@advjs/core'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  diagnostics: CompileDiagnostic[]
  error?: string
}>()

defineEmits<{
  retry: []
}>()

const { t } = useI18n()
const hasDiagnostics = computed(() => props.diagnostics.length > 0)

function sourceLabel(diagnostic: CompileDiagnostic): string {
  const source = diagnostic.source
  if (!source)
    return ''

  return [source.file, source.line, source.column]
    .filter(value => value !== undefined)
    .join(':')
}
</script>

<template>
  <section role="alert" aria-live="assertive" class="runtime-diagnostics-overlay">
    <div class="runtime-diagnostics-overlay__panel">
      <h2>
        {{ t(hasDiagnostics ? 'runtimeInspector.compileFailed' : 'runtimeInspector.genericError') }}
      </h2>

      <ul v-if="hasDiagnostics" class="runtime-diagnostics-overlay__list">
        <li
          v-for="diagnostic in diagnostics"
          :key="`${diagnostic.code}:${sourceLabel(diagnostic)}:${diagnostic.message}`"
          :class="`runtime-diagnostics-overlay__item--${diagnostic.severity}`"
        >
          <div class="runtime-diagnostics-overlay__code">
            <code>{{ diagnostic.code }}</code>
            <span v-if="sourceLabel(diagnostic)">{{ sourceLabel(diagnostic) }}</span>
          </div>
          <p>{{ diagnostic.message }}</p>
        </li>
      </ul>

      <pre v-else>{{ error }}</pre>

      <button type="button" @click="$emit('retry')">
        {{ t('runtimeInspector.retry') }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.runtime-diagnostics-overlay {
  position: absolute;
  z-index: 15;
  inset: 0;
  display: grid;
  overflow: auto;
  padding: clamp(1rem, 4vw, 3rem);
  background: radial-gradient(circle at top, rgb(69 10 10 / 72%), rgb(2 6 23 / 96%) 60%);
  color: #e2e8f0;
  place-items: center;
}

.runtime-diagnostics-overlay__panel {
  width: min(44rem, 100%);
  padding: 1.25rem;
  border: 1px solid #7f1d1d;
  border-radius: 0.75rem;
  background: rgb(15 23 42 / 92%);
  box-shadow: 0 1.5rem 4rem rgb(0 0 0 / 45%);
}

.runtime-diagnostics-overlay__panel h2 {
  margin: 0 0 1rem;
  font-size: 1.1rem;
}

.runtime-diagnostics-overlay__panel pre {
  overflow: auto;
  white-space: pre-wrap;
}

.runtime-diagnostics-overlay__list {
  display: grid;
  max-height: 55vh;
  gap: 0.75rem;
  padding: 0;
  overflow: auto;
  list-style: none;
}

.runtime-diagnostics-overlay__list li {
  padding: 0.75rem;
  border-left: 3px solid #f87171;
  border-radius: 0.25rem;
  background: rgb(127 29 29 / 20%);
}

.runtime-diagnostics-overlay__item--warning {
  border-left-color: #facc15 !important;
  background: rgb(113 63 18 / 20%) !important;
}

.runtime-diagnostics-overlay__code {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0.5rem;
  color: #fca5a5;
  font-size: 0.75rem;
}

.runtime-diagnostics-overlay__list p {
  margin: 0.5rem 0 0;
}

.runtime-diagnostics-overlay__panel button {
  padding: 0.55rem 0.9rem;
  border: 1px solid #64748b;
  border-radius: 0.4rem;
  background: #1e293b;
  color: inherit;
  cursor: pointer;
}
</style>
