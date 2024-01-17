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
  'grid-template-columns': `repeat(${length.value}, minmax(0, 1fr))`,
}))

function updateModelValue(val: number, key: keyof Vector) {
  const modelValue: Vector = props.modelValue || { x: 0, y: 0 }
  modelValue[key] = val
  emit('update:modelValue', modelValue)
}
</script>

<template>
  <div class="agui-input-vector grid" :style="styles" items-center justify-center>
    <div
      v-for="(_, key) in modelValue" :key="key"
      class="axis inline-flex text-left"
    >
      <label
        :for="key"
        class="ml-3px w-1rem text-xs text-$agui-c-text-1"
        inline-flex items-center justify-start uppercase
      >{{ key }}
      </label>
      <AGUIInputNumber
        class="flex-grow"
        style="width:calc(100% - 30px)"
        :name="key"
        :label="`${key}`"
        :model-value="modelValue![key]"
        @update:model-value="updateModelValue($event, key)"
      />
    </div>
  </div>
</template>

<style lang="scss">
.agui-input-vector {
  .axis {
    .agui-input {
      margin-right: 4px;
    }
    &:last-child {
      .agui-input {
        margin-right: 0;
      }
    }
  }
}
</style>
