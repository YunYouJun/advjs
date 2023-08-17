<script lang="ts" setup>
import { ref } from 'vue'

withDefaults(defineProps<{
  title: string
}>(), {
  title: 'Untitled',
})

const isDark = ref(true)
</script>

<template>
  <div
    :class="isDark ? 'dark' : 'light'"
    relative
    class="agui-demo-block bg-$agui-c-bg-panel" shadow border="solid 1px $agui-c-divider-dark-2"
    rounded
  >
    <AGUIDetails open :title="title">
      <slot />
    </AGUIDetails>
    <!-- <button
      :class="isDark ? 'i-ri-moon-line' : 'i-ri-sun-line'"
      class="absolute right-2 top-2 text-$agui-c-text-2"
      @click="isDark = !isDark"
    /> -->
  </div>
</template>
