<script setup lang="ts">
import type { AdvProjectDiagnostic } from '@advjs/types'
import { AdvDiagnosticsPanel } from '@advjs/gui/authoring'
import AGUIDetails from '@advjs/gui/components/AGUIDetails.vue'
import AGUIButton from '@advjs/gui/components/button/AGUIButton.vue'
import AGUIIconButton from '@advjs/gui/components/button/AGUIIconButton.vue'

defineProps<{ diagnostics: readonly AdvProjectDiagnostic[], zh: boolean, busy: boolean }>()
const emit = defineEmits<{ open: [diagnostic: AdvProjectDiagnostic], toggle: [] }>()
</script>

<template>
  <AGUIDetails v-if="diagnostics.length" class="flow-diagnostics" :title="`${zh ? '项目诊断' : 'Project diagnostics'} · ${diagnostics.length}`" @toggle="emit('toggle')">
    <AdvDiagnosticsPanel :diagnostics="diagnostics" :page-size="50" :disabled="busy" @navigate="emit('open', $event)">
      <template #pagination="{ page, pageCount, previous, next }">
        <div class="diagnostic-pagination" :aria-label="zh ? '诊断分页' : 'Diagnostic pages'">
          <AGUIIconButton icon="i-ri-arrow-left-s-line" :title="zh ? '上一组诊断' : 'Previous diagnostics'" :disabled="busy || !page" @click="previous" />
          <span>{{ page + 1 }} / {{ pageCount }}</span>
          <AGUIIconButton icon="i-ri-arrow-right-s-line" :title="zh ? '下一组诊断' : 'Next diagnostics'" :disabled="busy || page + 1 >= pageCount" @click="next" />
        </div>
      </template>
      <template #diagnostic="{ diagnostic: item, navigate }">
        <div class="diagnostic" :data-severity="item.severity">
          <div class="diagnostic-heading">
            <span>{{ item.severity === 'error' ? (zh ? '错误' : 'Error') : (zh ? '警告' : 'Warning') }} · {{ item.code }}</span>
            <AGUIButton v-if="item.path" variant="text" :disabled="busy" :data-flow-diagnostic="item.code" @click="navigate">
              {{ item.path }}{{ item.line ? `:${item.line}` : '' }}
            </AGUIButton>
          </div>
          <p class="diagnostic-message">
            {{ item.message }}
          </p>
        </div>
      </template>
    </AdvDiagnosticsPanel>
  </AGUIDetails>
</template>

<style scoped lang="scss">
.flow-diagnostics {
  flex: 0 0 auto;
  max-height: 35%;
  overflow: auto;
  border-top: 1px solid var(--agui-c-divider);
  font-size: 12px;
  color: var(--agui-c-text-2);
}
.flow-diagnostics > summary {
  cursor: pointer;
  min-height: 24px;
}
.flow-diagnostics > summary:focus-visible {
  outline: 2px solid var(--agui-c-focus);
}
:deep(.diagnostic-list) {
  list-style: none;
  padding: 0;
  margin: 4px 0;
}
.diagnostic-pagination {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 4px;
}
.diagnostic {
  padding: 4px 0;
  border-top: 1px solid var(--agui-c-divider);
}
.diagnostic-heading {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  overflow-wrap: anywhere;
}
.diagnostic[data-severity='error'] .diagnostic-heading {
  color: var(--agui-c-danger-text);
}
.diagnostic[data-severity='warning'] .diagnostic-heading {
  color: var(--agui-c-warning-text);
}
.diagnostic-heading :deep(.agui-button) {
  white-space: normal;
  text-align: left;
  overflow-wrap: anywhere;
}
.diagnostic-message {
  margin: 4px 0;
  overflow-wrap: anywhere;
}
</style>
