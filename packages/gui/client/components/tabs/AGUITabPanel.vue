<script lang="ts" setup>
import { TabsContent } from 'reka-ui'

const props = defineProps<{
  /**
   * tab key
   */
  value: string | number
}>()
</script>

<template>
  <TabsContent
    class="relative h-full w-full text-sm text-white"
    v-bind="props"
    :value="value"
  >
    <slot />
  </TabsContent>
</template>
