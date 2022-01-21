<template>
  <div class="adv-radio">
    <AdvTextButton v-for="(item, i) in options" :key="i" :class="checked === item.value ? 'active' : ''" m="r-8" @click="onClick && onClick(item)">
      {{ item.label }}
    </AdvTextButton>
  </div>
</template>

<script lang="ts" setup>
import type { AdvItemOption } from '@advjs/theme-default'

// todo import
export interface AdvRadioGroupProps<T extends AdvItemOption = AdvItemOption> {
  checked: T['value']
  options: T[]
  onClick?: (value: T) => void
}

defineProps<AdvRadioGroupProps>()
</script>
