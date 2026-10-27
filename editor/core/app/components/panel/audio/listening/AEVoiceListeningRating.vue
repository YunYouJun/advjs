<script setup lang="ts">
import type { VoiceListeningSession } from '@advjs/audio'
import AGUIProperty from '@advjs/gui/client/components/AGUIProperty.vue'
import AGUIForm from '@advjs/gui/client/components/form/AGUIForm.vue'
import AGUIFormItem from '@advjs/gui/client/components/form/AGUIFormItem.vue'
import AGUISelect from '@advjs/gui/client/components/select/AGUISelect.vue'
import AGUITextarea from '@advjs/gui/client/components/textarea/AGUITextarea.vue'
import { useId } from 'vue'

type Sample = VoiceListeningSession['samples'][number]
const props = defineProps<{ sample: Sample }>()
const emit = defineEmits<{ update: [review: { scores?: Sample['scores'], notes?: string }] }>()
const id = useId()
const fields = [{ key: 'naturalness', label: '自然度' }, { key: 'clarity', label: '清晰度' }, { key: 'textAccuracy', label: '文本准确度' }, { key: 'styleFit', label: '风格契合度' }, { key: 'edges', label: '首尾与衔接' }, { key: 'referenceConsistency', label: '参考一致性' }] as const
const options = [{ value: 'pending', label: '尚未评分' }, ...[1, 2, 3, 4, 5].map(value => ({ value: String(value), label: `${value} 分` })), { value: 'na', label: '不适用（NA）' }]
function score(key: keyof Sample['scores'], value: string | number) {
  const parsed = value === 'pending' ? null : value === 'na' ? 'na' : ([1, 2, 3, 4, 5] as const).find(score => String(score) === String(value))
  if (parsed === undefined)
    return
  emit('update', { scores: { ...props.sample.scores, [key]: parsed } })
}
</script>

<template>
  <AGUIForm class="ae-listening-rating" :aria-label="`${sample.id} 六维评分`">
    <AGUIProperty v-for="field in fields" :key="field.key" :label="field.label">
      <AGUISelect :model-value="sample.scores[field.key] === null ? 'pending' : String(sample.scores[field.key])" :options="options" :label="`${sample.id} ${field.label}`" @update:model-value="score(field.key, $event)" />
    </AGUIProperty>
    <AGUIFormItem :for="`${id}-notes`" label="听审备注" label-align="top">
      <AGUITextarea :id="`${id}-notes`" :model-value="sample.notes" :rows="3" @update:model-value="emit('update', { notes: String($event) })" />
    </AGUIFormItem>
  </AGUIForm>
</template>
