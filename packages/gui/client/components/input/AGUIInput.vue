<script lang="ts" setup>
defineProps<{
  prefixIcon?: string
  modelValue?: string
}>()

const emit = defineEmits(['update:modelValue'])

function updateModelValue(event: any) {
  const val = event.target?.value || ''
  emit('update:modelValue', val)
}
</script>

<template>
  <div class="relative flex">
    <div v-if="$slots.prefix" class="absolute">
      <slot name="prefix" />
    </div>
    <div class="absolute left-1 h-full flex items-center justify-center text-xs op-60">
      <div v-if="prefixIcon" :class="prefixIcon" />
    </div>
    <input
      :class="{
        'pl-5': prefixIcon,
      }"
      class="agui-input px-1 shadow shadow-inset"
      :value="modelValue"
      @input="updateModelValue"
    >
  </div>
</template>

<style lang="scss">
.agui-input {
  color: var(--agui-c-label);
  background-color: rgba(42, 42, 42, 1);
  border: 1px solid var(--agui-c-border);

  border-radius: 3px;
  font-size: 13px;

  height: 20px;

  box-sizing: border-box;
  transition: border-color 0.2s ease-in-out;

  &:focus {
    outline: none;
    border-color: var(--agui-c-active);
  }

  &:disabled {
    opacity: 0.5;

    color: var(--agui-c-text-3);
    border-color: var(--agui-c-border);
  }
}
</style>
