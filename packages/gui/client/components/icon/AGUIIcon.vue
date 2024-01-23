<script lang="ts" setup>
defineProps<{
  icon: string
}>()
</script>

<template>
  <div :class="icon" />
</template>
