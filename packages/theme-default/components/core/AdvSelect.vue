<template>
  <!-- eslint-disable vue/no-mutating-props -->
  <select
    v-model="selected"
    class="adv-select w-full rounded"
    border="~ 1"
    p="x-2"
    text="lg"
    @change="onChange"
  >
    <option v-for="item in options" :key="item.value" :value="item.value">
      {{ item.label }}
    </option>
  </select>
</template>

<script setup lang="ts">
// import type { AdvSelectProps } from '@advjs/theme-default'
import type { AdvItemOption } from '@advjs/theme-default'

export interface AdvSelectProps {
  selected: string
  change?: (value: string) => void
  options?: AdvItemOption[]
}

const props = withDefaults(defineProps<AdvSelectProps>(), {
  selected: '',
  options: () => [],
  change: () => {},
})

const onChange = (val: Event | any) => {
  if (val.target && val.target.value)
    props.change(val.target.value)
}
</script>
