<script setup lang="ts">
import type { AdvCheckboxProps } from '@advjs/theme-default'

withDefaults(defineProps<{ props: AdvCheckboxProps }>(), {
  props: () => ({ checked: false }),
})

// do not need emit update:checked, because it is controlled by parent
</script>

<template>
  <span class="inline-flex cursor-pointer" @click="props.onClick">
    <AdvIcon v-if="props.checked">
      <i-ri-checkbox-line />
    </AdvIcon>
    <AdvIcon v-else>
      <i-ri-checkbox-blank-line />
    </AdvIcon>
  </span>
</template>
