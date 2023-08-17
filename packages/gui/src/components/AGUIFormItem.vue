<script setup lang="ts">
defineProps<{ label: string }>()
</script>

<template>
  <div
    class="agui-form-item flex"
    justify-center items-center h="6"
    pr-1
  >
    <label
      class="agui-label w-1/3 text-$agui-c-label"
    >{{ label }}</label>
    <div class="flex flex-1" items-center>
      <slot />
    </div>
  </div>
</template>
