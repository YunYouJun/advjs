<template>
  <div class="adv-radio">
    <span v-for="(item, i) in options" :key="i" m="r-8" class="adv-text-button" :class="checked === item.value ? 'active' : ''" @click="onClick(item.value)">
      {{ item.label }}
    </span>
  </div>
</template>

<script lang="ts" setup>
// import type { AdvRadioGroupProps } from '@advjs/theme-default'
import type { AdvItemOption } from '@advjs/theme-default'

export interface AdvRadioGroupProps {
  checked: string
  options: AdvItemOption[]
  onClick: (val: string) => void
}

defineProps<AdvRadioGroupProps>()
</script>
