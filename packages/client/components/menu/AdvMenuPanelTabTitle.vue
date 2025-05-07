<script setup lang="ts">
import { TabsTrigger } from 'reka-ui'

defineProps<{
  value: string
  title?: string
}>()
</script>

<template>
  <TabsTrigger
    class="flex flex-1 cursor-pointer items-center justify-center rounded-tr bg-white p-6 leading-none outline-none dark:bg-black/80 data-[state=active]:(bg-$adv-c-primary-light text-blue-500) focus-visible:shadow-[0_0_0_2px]"
    :value="value"
  >
    <slot>
      <h2 class="adv-font-serif font-black" text="6xl">
        {{ title }}
      </h2>
    </slot>
  </TabsTrigger>
</template>
