<template>
  <span class="inline-flex cursor-pointer">
    <AdvIcon v-if="checked">
      <i-ri-checkbox-line />
    </AdvIcon>
    <AdvIcon v-else>
      <i-ri-checkbox-blank-line />
    </AdvIcon>
  </span>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ checked?: boolean }>(), {
  checked: false,
})
</script>
