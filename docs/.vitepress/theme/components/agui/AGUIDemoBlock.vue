<script lang="ts" setup>
import AGUIDetails from '@advjs/gui/client/components/AGUIDetails.vue'

withDefaults(defineProps<{
  inPanel?: boolean
  title?: string
}>(), {
  title: 'Untitled',
  inPanel: true,
})
</script>

<template>
  <div
    class="agui-demo-block bg-$agui-c-bg-panel w-full"
    border="solid 1px $agui-c-divider"
    rounded-2px shadow relative
  >
    <AGUIDetails v-if="inPanel" open :title="title">
      <slot />
    </AGUIDetails>
    <slot v-else />

    <!-- <button
      :class="isDark ? 'i-ri-moon-line' : 'i-ri-sun-line'"
      class="absolute right-2 top-2 text-$agui-c-text-2"
      @click="isDark = !isDark"
    /> -->
  </div>
</template>

<style lang="scss">
.agui-demo-block {
  margin-top: 1rem;
}
</style>
