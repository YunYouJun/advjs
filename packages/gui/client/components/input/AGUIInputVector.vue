<script lang="ts" setup>
import type { Vector, VectorKey } from '../../types'
import { useId } from 'vue'
import AGUINumberField from '../AGUINumberField.vue'

const props = defineProps<{ modelValue?: Vector, disabled?: boolean, label?: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: Vector] }>()
const uid = useId()
function updateModelValue(value: number, key: VectorKey) {
  if (!props.disabled && props.modelValue)
    emit('update:modelValue', { ...props.modelValue, [key]: value })
}
</script>

<template>
  <div class="agui-input-vector" role="group" :aria-label="label">
    <div v-for="(value, key) in modelValue" :key="key" class="agui-vector-axis" :data-axis="key">
      <label :for="`${uid}-${key}`">{{ key }}</label>
      <AGUINumberField :id="`${uid}-${key}`" :label="`${label || ''} ${key}`.trim()" :model-value="value" :disabled="disabled" @update:model-value="updateModelValue($event, key as VectorKey)" />
    </div>
  </div>
</template>

<style lang="scss">
.agui-input-vector {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(88px, 1fr));
  gap: 4px;
  min-width: 0;
  width: 100%;
  .agui-vector-axis {
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
    label {
      font-size: 12px;
      text-transform: uppercase;
      color: var(--agui-c-text-2);
    }
    &:focus-within label {
      color: var(--agui-c-link);
    }
    .agui-number-field {
      flex: 1;
      border-inline-start: 2px solid var(--agui-axis-color, var(--agui-c-control-border));
    }
    &[data-axis='x'] {
      --agui-axis-color: var(--agui-c-axis-x);
    }
    &[data-axis='y'] {
      --agui-axis-color: var(--agui-c-axis-y);
    }
    &[data-axis='z'] {
      --agui-axis-color: var(--agui-c-axis-z);
    }
    &[data-axis='w'] {
      --agui-axis-color: var(--agui-c-axis-w);
    }
  }
}
</style>
