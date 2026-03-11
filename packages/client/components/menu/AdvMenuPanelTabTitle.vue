<script setup lang="ts">
import { TabsTrigger } from 'reka-ui'

defineProps<{
  value: string
  title?: string
}>()
</script>

<template>
  <TabsTrigger
    class="leading-none p-6 outline-none rounded-tr bg-white flex flex-1 cursor-pointer items-center justify-center data-[state=active]:(text-blue-500 bg-$adv-c-primary-light) dark:bg-black/80 focus-visible:shadow-[0_0_0_2px]"
    :value="value"
  >
    <slot>
      <h2 class="adv-font-serif font-black" text="6xl">
        {{ title }}
      </h2>
    </slot>
  </TabsTrigger>
</template>
