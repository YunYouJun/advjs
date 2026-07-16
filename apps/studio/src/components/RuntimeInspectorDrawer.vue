<script setup lang="ts">
import type { JsonValue, RuntimeNode, RuntimeSnapshot, RuntimeTraceEntry } from '@advjs/types'
import RuntimeInspectorPanel from '@advjs/client/components/devtools/RuntimeInspectorPanel.vue'
import { createRuntimeDebugReport, projectRuntimeInspector } from '@advjs/client/runtime'
import { computed, onBeforeUnmount, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { createRuntimeReportPayload } from '../utils/runtimeReport'

const props = withDefaults(defineProps<{
  open: boolean
  snapshot: RuntimeSnapshot
  current?: RuntimeNode
  trace?: RuntimeTraceEntry[]
  diagnostics?: JsonValue[]
}>(), {
  trace: () => [],
  diagnostics: () => [],
})

const emit = defineEmits<{
  close: []
}>()

const { t } = useI18n()
const copied = shallowRef(false)
let copiedTimer: ReturnType<typeof setTimeout> | undefined

const model = computed(() => projectRuntimeInspector(
  props.snapshot,
  props.current,
  props.trace,
))
const report = computed(() => createRuntimeDebugReport({
  snapshot: props.snapshot,
  trace: props.trace,
  diagnostics: props.diagnostics,
}))

async function copyReport() {
  const payload = createRuntimeReportPayload(report.value)
  await navigator.clipboard.writeText(payload.text)
  copied.value = true
  clearTimeout(copiedTimer)
  copiedTimer = setTimeout(() => {
    copied.value = false
  }, 2000)
}

function downloadReport() {
  const payload = createRuntimeReportPayload(report.value)
  const url = URL.createObjectURL(payload.blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = payload.filename
  anchor.click()
  URL.revokeObjectURL(url)
}

onBeforeUnmount(() => clearTimeout(copiedTimer))
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="runtime-inspector-drawer__backdrop"
      @click.self="emit('close')"
    >
      <aside
        role="dialog"
        aria-modal="true"
        :aria-label="t('runtimeInspector.title')"
        class="runtime-inspector-drawer"
      >
        <header class="runtime-inspector-drawer__toolbar">
          <p>{{ t('runtimeInspector.reviewNotice') }}</p>
          <div class="runtime-inspector-drawer__actions">
            <button type="button" @click="copyReport">
              {{ copied ? t('runtimeInspector.copied') : t('runtimeInspector.copy') }}
            </button>
            <button type="button" @click="downloadReport">
              {{ t('runtimeInspector.download') }}
            </button>
            <button type="button" :aria-label="t('runtimeInspector.close')" @click="emit('close')">
              {{ t('runtimeInspector.close') }}
            </button>
          </div>
        </header>

        <RuntimeInspectorPanel
          :model="model"
          :show-export="false"
          :empty-trace-label="t('runtimeInspector.emptyTrace')"
        />
      </aside>
    </div>
  </Teleport>
</template>

<style scoped>
.runtime-inspector-drawer__backdrop {
  position: fixed;
  z-index: 10000;
  inset: 0;
  display: flex;
  justify-content: flex-end;
  background: rgb(2 6 23 / 62%);
}

.runtime-inspector-drawer {
  width: min(52rem, 92vw);
  height: 100%;
  padding: 1rem;
  overflow: auto;
  border-left: 1px solid #334155;
  background: #020617;
  box-shadow: -1rem 0 3rem rgb(0 0 0 / 35%);
}

.runtime-inspector-drawer__toolbar,
.runtime-inspector-drawer__actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.runtime-inspector-drawer__toolbar {
  justify-content: space-between;
  margin-bottom: 1rem;
}

.runtime-inspector-drawer__toolbar p {
  max-width: 36rem;
  margin: 0;
  color: #94a3b8;
  font-size: 0.8rem;
}

.runtime-inspector-drawer__actions {
  flex: none;
}

.runtime-inspector-drawer__actions button {
  padding: 0.5rem 0.75rem;
  border: 1px solid #475569;
  border-radius: 0.4rem;
  background: #0f172a;
  color: #e2e8f0;
  cursor: pointer;
}

@media (width <= 640px) {
  .runtime-inspector-drawer {
    width: 100%;
  }

  .runtime-inspector-drawer__toolbar {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
