<script setup lang="ts">
import { TabsTrigger } from 'reka-ui'

defineProps<{
  value: string
  title?: string
}>()
</script>

<template>
  <TabsTrigger
    class="leading-none p-6 rounded-tr bg-$adv-c-bg flex flex-1 cursor-pointer items-center justify-center data-[state=active]:(text-$adv-c-primary bg-$adv-c-primary-light)"
    :value="value"
  >
    <slot>
      <h2 class="adv-font-serif font-black" text="6xl">
        {{ title }}
      </h2>
    </slot>
  </TabsTrigger>
</template>
