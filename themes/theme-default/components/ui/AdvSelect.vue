<script setup lang="ts">
import type { AdvItemOption, AdvSelectProps } from '@advjs/theme-default'

const iProps = withDefaults(defineProps<{
  props?: AdvSelectProps
}>(), {
  props: () => ({
    selected: '',
    options: [] as AdvItemOption[],
    change: () => {},
  }),
})

function onChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  const option = iProps.props.options?.find(option => option.value === value)
  if (option)
    iProps.props.change?.(option)
}
</script>

<template>
  <select :value="props.selected" class="adv-select" @change="onChange">
    <option v-for="item in props.options" :key="item.value" :value="item.value">
      {{ item.label }}
    </option>
  </select>
</template>
