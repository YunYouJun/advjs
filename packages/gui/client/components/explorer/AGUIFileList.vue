<script lang="ts" setup>
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  /**
   * The size of the icon.
   * @default 32
   * px
   */
  size?: number
}>(), {
  size: 32,
})

const cssVars = computed(() => ({
  '--icon-size': `${props.size}px`,
}))
</script>

<template>
  <div class="agui-file-list grid" :style="cssVars">
    <AGUIFileItem :size="size" name="TEST" />
    <AGUIFileItem :size="size" name="TEST" />
    <AGUIFileItem :size="size" name="TEST" />
  </div>
</template>

<style lang="scss">
.agui-file-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(var(--icon-size), 1fr));
  grid-gap: 4px;
}
</style>
