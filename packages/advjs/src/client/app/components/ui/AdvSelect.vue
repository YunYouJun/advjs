<template>
  <!-- eslint-disable vue/no-mutating-props -->
  <select
    v-model="selected"
    class="adv-select w-full rounded"
    border="~ 1"
    p="x-2"
    text="lg"
    @change="change"
  >
    <option v-for="item in options" :key="item.value" :value="item.value">
      {{ item.label }}
    </option>
  </select>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  selected: string
  change?: () => void
  options?: {
    label: string
    value: string
  }[]
}>(), {
  selected: '',
  options: () => [],
  change: () => {},
})
</script>
