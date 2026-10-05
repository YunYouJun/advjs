<script lang="ts" setup>
import { onMounted, ref } from 'vue'
import './fields.scss'

defineOptions({ inheritAttrs: false })

const props = defineProps<{
  autofocus?: boolean
  className?: string
  prefixIcon?: string
  modelValue?: string
  placeholder?: string
}>()

const emit = defineEmits(['update:modelValue'])

function updateModelValue(event: Event) {
  const val = (event.target as HTMLInputElement).value
  emit('update:modelValue', val)
}
const inputRef = ref<HTMLInputElement | null>()

onMounted(async () => {
  if (props.autofocus) {
    setTimeout(() => {
      inputRef.value?.focus()
    }, 1)
  }
})
</script>

<template>
  <div v-if="prefixIcon" class="flex relative">
    <div v-if="$slots.prefix" class="absolute">
      <slot name="prefix" />
    </div>
    <div class="text-xs op-60 flex h-full items-center left-1 justify-center absolute">
      <div v-if="prefixIcon" :class="prefixIcon" />
    </div>
    <input
      ref="inputRef"
      class="agui-input"
      v-bind="$attrs"
      :class="{
        'agui-input-has-prefix': prefixIcon,
        [className || '']: true,
      }"
      :value="modelValue"
      :placeholder="placeholder"
      :autofocus="autofocus"
      @input="updateModelValue"
    >
  </div>
  <input
    v-else
    ref="inputRef"
    :class="className"
    :autofocus="autofocus"
    class="agui-input"
    v-bind="$attrs"
    :value="modelValue"
    :placeholder="placeholder"
    @input="updateModelValue"
  >
</template>
