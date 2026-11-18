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
    class="agui-tab-panel text-$agui-c-text-1 h-full w-full relative"
    v-bind="props"
    :value="value"
  >
    <slot />
  </TabsContent>
</template>

<style lang="scss">
.agui-tab-panel {
  font-size: var(--agui-font-size-title);

  &:focus-visible {
    outline: var(--agui-focus-width) solid var(--agui-c-focus);
    outline-offset: var(--agui-focus-offset);
  }
}
</style>
