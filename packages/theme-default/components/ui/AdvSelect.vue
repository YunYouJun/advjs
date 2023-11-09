<script setup lang="ts">
import type { AdvItemOption, AdvSelectProps } from '@advjs/theme-default'

const iProps = withDefaults(defineProps<{ props: AdvSelectProps }>(), {
  props: () => ({
    selected: '',
    options: [] as AdvItemOption[],
    change: () => {},
  }),
})

function onChange(val: Event | any) {
  if (iProps.props.change && val.target && val.target.value)
    iProps.props.change(val.target.value)
}
</script>

<template>
  <!-- eslint-disable vue/no-mutating-props -->
  <select
    v-model="props.selected"
    class="adv-select w-full rounded"
    border="~ 1"
    p="x-2"
    text="lg"
    @change="onChange"
  >
    <option v-for="item in props.options" :key="item.value" :value="item.value">
      {{ item.label }}
    </option>
  </select>
</template>
@advjs/
