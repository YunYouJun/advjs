<script lang="ts" setup>
import type { AdvItemOption } from '@advjs/theme-default'

defineProps<{ props: AdvRadioGroupProps }>()

// todo import
export interface AdvRadioGroupProps<T extends AdvItemOption = AdvItemOption> {
  checked: T['value']
  options: T[]
  onClick?: (value: T) => void
}
</script>

<template>
  <div class="adv-radio">
    <AdvTextButton v-for="(item, i) in props.options" :key="i" :class="props.checked === item.value ? 'active' : ''" m="r-8" @click="props.onClick && props.onClick(item)">
      {{ item.label }}
    </AdvTextButton>
  </div>
</template>
