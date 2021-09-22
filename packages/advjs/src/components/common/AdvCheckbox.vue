<template>
  <span>
    <AdvIcon v-if="props.check"><i-ri-checkbox-line /></AdvIcon>
    <AdvIcon v-else><i-ri-checkbox-blank-line /></AdvIcon>
  </span>
</template>

<script setup lang="ts">
const props = defineProps<{
  /**
   * 是否选中
   */
  check: boolean
}>()
</script>
