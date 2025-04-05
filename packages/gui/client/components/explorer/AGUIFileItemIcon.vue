<script setup lang="ts">
defineProps<{
  fileIcon?: string
}>()
</script>

<template>
  <div class="agui-file-icon">
    <div
      v-if="fileIcon?.startsWith('i-')"
      class="icon"
      :class="fileIcon || 'i-ri-file-2-fill'"
    />
    <img
      v-else
      class="icon h-full w-full object-contain"
      :src="fileIcon"
    >
  </div>
</template>
