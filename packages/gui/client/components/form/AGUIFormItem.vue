<script setup lang="ts">
defineProps<{
  label: string
  description?: string
}>()
</script>

<template>
  <div
    class="agui-form-item flex"
    items-center justify-center h="6"
  >
    <label
      class="agui-label w-1/3 text-$agui-c-label"
      :title="description"
    >
      {{ label }}
    </label>
    <div class="flex flex-1" items-center>
      <slot />
    </div>
  </div>
</template>
