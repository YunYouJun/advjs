<script setup lang="ts">
import type { CharacterVoiceProfile } from '@advjs/types'
import AGUIProperty from '@advjs/gui/client/components/AGUIProperty.vue'
import AGUIInput from '@advjs/gui/client/components/input/AGUIInput.vue'
import AGUISelect from '@advjs/gui/client/components/select/AGUISelect.vue'

const props = defineProps<{ modelValue: CharacterVoiceProfile['intent'], idPrefix: string }>()
const emit = defineEmits<{ 'update:modelValue': [intent: CharacterVoiceProfile['intent']] }>()

function update(field: keyof CharacterVoiceProfile['intent'], value: string) {
  const next = { ...props.modelValue }
  if (!value.trim() || ((field === 'pitch' || field === 'pace') && value === 'unspecified'))
    delete next[field]
  else if (field === 'temperament')
    next.temperament = value.split(',').map(item => item.trim()).filter(Boolean)
  else Object.assign(next, { [field]: value.trim() })
  emit('update:modelValue', next)
}
</script>

<template>
  <div class="voice-intent-fields">
    <AGUIProperty :for="`${idPrefix}-voice-style`" label="说话风格">
      <AGUIInput :id="`${idPrefix}-voice-style`" :model-value="modelValue.speakingStyle ?? ''" @update:model-value="update('speakingStyle', String($event))" />
    </AGUIProperty>
    <AGUIProperty :for="`${idPrefix}-voice-age`" label="年龄印象">
      <AGUIInput :id="`${idPrefix}-voice-age`" :model-value="modelValue.ageImpression ?? ''" @update:model-value="update('ageImpression', String($event))" />
    </AGUIProperty>
    <AGUIProperty :for="`${idPrefix}-voice-gender`" label="性别表达">
      <AGUIInput :id="`${idPrefix}-voice-gender`" :model-value="modelValue.genderExpression ?? ''" @update:model-value="update('genderExpression', String($event))" />
    </AGUIProperty>
    <AGUIProperty :for="`${idPrefix}-voice-temperament`" label="气质">
      <AGUIInput :id="`${idPrefix}-voice-temperament`" :model-value="modelValue.temperament?.join(', ') ?? ''" placeholder="以逗号分隔" @update:model-value="update('temperament', String($event))" />
    </AGUIProperty>
    <AGUIProperty :for="`${idPrefix}-voice-pitch`" label="音高">
      <AGUISelect :id="`${idPrefix}-voice-pitch`" label="音高" :model-value="modelValue.pitch ?? 'unspecified'" :options="[{ value: 'unspecified', label: '未指定' }, 'low', 'medium', 'high']" @update:model-value="update('pitch', String($event))" />
    </AGUIProperty>
    <AGUIProperty :for="`${idPrefix}-voice-pace`" label="语速">
      <AGUISelect :id="`${idPrefix}-voice-pace`" label="语速" :model-value="modelValue.pace ?? 'unspecified'" :options="[{ value: 'unspecified', label: '未指定' }, 'slow', 'medium', 'fast']" @update:model-value="update('pace', String($event))" />
    </AGUIProperty>
  </div>
</template>

<style scoped>
.voice-intent-fields {
  min-width: 0;
}
</style>
