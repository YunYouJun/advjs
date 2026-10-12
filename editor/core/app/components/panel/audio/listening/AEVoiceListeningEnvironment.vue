<script setup lang="ts">
import type { VoiceListeningSession } from '@advjs/audio'
import AGUIDetails from '@advjs/gui/client/components/AGUIDetails.vue'
import AGUIProperty from '@advjs/gui/client/components/AGUIProperty.vue'
import AGUIInput from '@advjs/gui/client/components/input/AGUIInput.vue'
import AGUITextarea from '@advjs/gui/client/components/textarea/AGUITextarea.vue'
import { useId } from 'vue'

const props = defineProps<{ environment: VoiceListeningSession['environment'] }>()
const emit = defineEmits<{ update: [environment: VoiceListeningSession['environment']] }>()
const id = useId()
const fields = [{ key: 'reviewerId', label: '听审者（化名）', max: 80 }, { key: 'device', label: '设备与浏览器', max: 160 }, { key: 'outputMode', label: '耳机 / 扬声器', max: 160 }, { key: 'systemVolume', label: '系统音量', max: 160 }, { key: 'language', label: '听审语言', max: 80 }] as const
</script>

<template>
  <AGUIDetails title="听审环境（必填）" open>
    <div class="ae-listening-environment">
      <AGUIProperty v-for="field in fields" :key="field.key" :for="`${id}-${field.key}`" :label="field.label">
        <AGUIInput :id="`${id}-${field.key}`" :model-value="environment[field.key]" :maxlength="field.max" @update:model-value="emit('update', { ...props.environment, [field.key]: String($event) })" />
      </AGUIProperty>
      <AGUIProperty :for="`${id}-notes`" label="环境备注">
        <AGUITextarea :id="`${id}-notes`" :model-value="environment.notes" :rows="2" @update:model-value="emit('update', { ...props.environment, notes: String($event) })" />
      </AGUIProperty>
    </div>
  </AGUIDetails>
</template>

<style scoped>
.ae-listening-environment {
  display: grid;
  gap: 4px;
  min-width: 0;
}
</style>
