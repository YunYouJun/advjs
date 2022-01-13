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
const props = withDefaults(defineProps<{
  selected: string
  change?: (value: string) => void
  options?: {
    label: string
    value: string
  }[]
}>(), {
  selected: '',
  options: () => [],
  change: (value) => {},
})

const onChange = (val: Event | any) => {
  if (val.target && val.target.value)
    props.change(val.target.value)
}
</script>
