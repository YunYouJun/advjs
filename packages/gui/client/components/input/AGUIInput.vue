<script lang="ts" setup>
defineProps<{
  className?: string
  prefixIcon?: string
  modelValue?: string
  placeholder?: string
}>()

const emit = defineEmits(['update:modelValue'])

function updateModelValue(event: any) {
  const val = event.target?.value || ''
  emit('update:modelValue', val)
}
</script>

<template>
  <div v-if="prefixIcon" class="relative flex">
    <div v-if="$slots.prefix" class="absolute">
      <slot name="prefix" />
    </div>
    <div class="absolute left-1 h-full flex items-center justify-center text-xs op-60">
      <div v-if="prefixIcon" :class="prefixIcon" />
    </div>
    <input
      class="agui-input w-full px-1 shadow shadow-inset"
      :class="{
        'pl-5': prefixIcon,
      }"
      :value="modelValue"
      :placeholder="placeholder"
      @input="updateModelValue"
    >
  </div>
  <input
    v-else
    class="agui-input w-full px-1 shadow shadow-inset"
    :value="modelValue"
    :placeholder="placeholder"
    @input="updateModelValue"
  >
</template>

<style lang="scss">
.agui-input {
  --agui-input-c-bg: rgba(42, 42, 42, 1);

  color: var(--agui-c-label);
  background-color: var(--agui-input-c-bg, rgba(42, 42, 42, 1));
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
