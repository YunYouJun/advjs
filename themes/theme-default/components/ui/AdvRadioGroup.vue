<script lang="ts" setup>
import type { AdvRadioGroupProps } from '@advjs/theme-default'

defineProps<{ props: AdvRadioGroupProps }>()
</script>

<template>
  <div class="adv-radio" role="group">
    <AdvTextButton
      v-for="item in props.options"
      :key="item.value"
      :active="props.checked === item.value"
      :aria-pressed="props.checked === item.value"
      @click="props.onClick?.(item)"
    >
      {{ item.label }}
    </AdvTextButton>
  </div>
</template>

<style scoped>
.adv-radio {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25em;
}
</style>
