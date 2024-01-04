<script lang="ts" setup>
import { ref } from 'vue'
import AGUIDetails from '@advjs/gui/client/components/AGUIDetails.vue'

withDefaults(defineProps<{
  inPanel?: boolean
  title: string
}>(), {
  title: 'Untitled',
  inPanel: true,
})

const isDark = ref(true)
</script>

<template>
  <div
    :class="isDark ? 'dark' : 'light'"

    class="agui-demo-block bg-$agui-c-bg-panel" border="solid 1px $agui-c-divider-dark-2"
    relative rounded-2px shadow
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
  max-width: 420px;
  margin: auto;
}
</style>
