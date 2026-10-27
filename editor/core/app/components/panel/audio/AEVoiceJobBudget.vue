<script setup lang="ts">
import type { VoiceJobsDraft } from '../../../composables/useVoiceJobs'
import AGUICheckbox from '@advjs/gui/client/components/AGUICheckbox.vue'
import AGUIProperty from '@advjs/gui/client/components/AGUIProperty.vue'
import AGUIInput from '@advjs/gui/client/components/input/AGUIInput.vue'
import { useId } from 'vue'

const props = defineProps<{ modelValue: VoiceJobsDraft, disabled: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: VoiceJobsDraft] }>()
const id = useId()
function update<K extends keyof VoiceJobsDraft>(key: K, value: VoiceJobsDraft[K]) {
  emit('update:modelValue', { ...props.modelValue, [key]: value })
}
</script>

<template>
  <div class="ae-job-budget">
    <div class="ae-job-budget-fields">
      <AGUIProperty :for="`${id}-characters`" label="总字符预算上限" group>
        <AGUIInput :id="`${id}-characters`" :model-value="modelValue.maxCharacters" type="number" min="1" :disabled="disabled" data-testid="jobs-character-budget" @update:model-value="update('maxCharacters', $event)" />
      </AGUIProperty>
      <AGUIProperty :for="`${id}-concurrency`" label="任务并发上限" group>
        <AGUIInput :id="`${id}-concurrency`" :model-value="modelValue.concurrency" type="number" min="1" max="32" :disabled="disabled" @update:model-value="update('concurrency', $event)" />
      </AGUIProperty>
    </div>
    <p class="ae-job-budget-hint">
      所有批次共用这份总预算。本地模型的实际并发仍受宿主限制。
    </p>
    <AGUICheckbox class="ae-job-budget-approval" :checked="modelValue.allowUnknownCost" label="我同意费用无法估算，按上述字符预算执行" :disabled="disabled" data-testid="jobs-unknown-cost" @update:checked="update('allowUnknownCost', Boolean($event))" />
    <p class="ae-job-budget-hint">
      插件当前未提供费用估算，无法保证金额上限。使用已保存的本地化台词；未提供本地化文本时使用源文本，不自动翻译。
    </p>
  </div>
</template>

<style scoped>
.ae-job-budget {
  display: grid;
  gap: var(--agui-space-2);
  min-width: 0;
  container: agui-properties / inline-size;
}
.ae-job-budget-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--agui-space-3);
}
.ae-job-budget-hint {
  margin: 0;
  color: var(--agui-c-text-2);
  font-size: var(--agui-font-size-caption);
  line-height: var(--agui-line-height);
  overflow-wrap: anywhere;
}
.ae-job-budget-approval {
  margin: 0;
  line-height: var(--agui-line-height);
}
.ae-job-budget-approval :deep(.label) {
  line-height: var(--agui-line-height);
}
@container agui-properties (max-width: 520px) {
  .ae-job-budget-fields {
    grid-template-columns: minmax(0, 1fr);
    gap: var(--agui-space-2);
  }
}
</style>
