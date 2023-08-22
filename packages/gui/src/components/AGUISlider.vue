<script lang="ts" setup>
withDefaults(defineProps<{
  modelValue: number
  step?: number
  min?: number
  max?: number

  showInput?: boolean
}>(), {
  step: 1,
  min: 0,
  max: 360,

  showInput: false,
})

const emit = defineEmits(['update:modelValue', 'input'])

function updateModelValue(event: any) {
  const val = event.target?.valueAsNumber || 0
  emit('update:modelValue', val)
  emit('input', val)
}
</script>

<template>
  <div
    class="agui-slider-container"
    :class="!showInput ? 'pr-3px' : ''"
    flex justify-center items-center
  >
    <!-- eslint-disable-next-line vue/no-mutating-props -->
    <div :class="showInput ? 'w-4/5' : 'w-full'">
      <input
        :value="modelValue" class="agui-slider inline-flex"
        type="range" :min="min || 0" :max="max || 360" :step="step"
        text="black" @input="updateModelValue"
      >
    </div>

    <div v-if="showInput" class="w-1/5" pl-2>
      <input
        class="agui-slider-input agui-input w-full"
        type="number" :min="min || 0" :max="max || 360" :step="step"
        :value="modelValue"
        @input="updateModelValue"
      >
    </div>
  </div>
</template>
