<script setup lang="ts">
defineProps<{
  label?: string
  labelClass?: string
  description?: string
}>()
</script>

<template>
  <div
    class="agui-form-item flex gap-1"
    items-center justify-center
  >
    <slot name="label">
      <label
        class="agui-label w-1/3 text-$agui-c-label"
        :class="labelClass"
        :title="description"
      >
        {{ label }}
      </label>
    </slot>
    <div class="w-2/3 flex flex-1" items-center>
      <slot />
    </div>
  </div>
</template>

<style lang="scss">
.agui-label {
  font-size: 12px;
}
</style>
