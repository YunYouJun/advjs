<template>
  <span class="inline-flex cursor-pointer" @click="onClick">
    <AdvIcon v-if="checked">
      <i-ri-checkbox-line />
    </AdvIcon>
    <AdvIcon v-else>
      <i-ri-checkbox-blank-line />
    </AdvIcon>
  </span>
</template>

<script setup lang="ts">
// import type { AdvCheckboxProps } from '@advjs/theme-default'

export interface AdvCheckboxProps {
  checked: boolean
  onClick?: (val: string) => void
}

withDefaults(defineProps<AdvCheckboxProps>(), {
  checked: false,
})

// do not need emit update:checked, because it is controlled by parent
</script>
