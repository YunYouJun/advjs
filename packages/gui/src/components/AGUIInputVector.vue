<script lang="ts" setup>
import { computed } from 'vue'
import type { Vector } from '../types'

const props = defineProps<{
  modelValue?: Vector
}>()

const emit = defineEmits<{
  'update:modelValue': [value: Vector]
}>()

const length = computed(() => Object.keys(props.modelValue || {}).length)
const styles = computed(() => ({
  width: `${1 / length.value * 100}%`,
}))

function updateModelValue(val: number, key: keyof Vector) {
  const modelValue: Vector = props.modelValue || { x: 0, y: 0 }
  modelValue[key] = val
  emit('update:modelValue', modelValue)
}
</script>

<template>
  <div flex="~ 1" gap="2" justify-center items-center>
    <div
      v-for="(_, key) in modelValue" :key="key"
      class="axis inline-flex text-left"
      :style="styles"
    >
      <label
        inline-flex justify-start items-center :for="key"
        class="text-xs text-$agui-c-text-1" mr-2
        uppercase
      >{{ key }}
      </label>
      <AGUIInputNumber
        :name="key"
        :label="`${key}`"
        :model-value="modelValue![key]"
        @update:model-value="updateModelValue($event, key)"
      />
    </div>
  </div>
</template>
