<script lang="ts" setup>
import { TabsContent } from 'reka-ui'

const props = defineProps<{
  /**
   * tab key
   */
  value: string | number
  forceMount?: boolean
}>()
</script>

<template>
  <TabsContent
    class="text-[13px] text-$agui-c-text-1 h-full w-full relative"
    v-bind="props"
    :value="value"
  >
    <slot />
  </TabsContent>
</template>
