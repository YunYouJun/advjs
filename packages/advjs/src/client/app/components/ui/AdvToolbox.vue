<script setup lang="ts">
import { ref, watch } from 'vue'

withDefaults(defineProps<{
  position?: 'left' | 'right'
}>(), {
  position: 'left',
})

const el = ref<HTMLElement | null>(null)
const open = ref(false)

watch(open, (value) => {
  if (!value)
    el.value!.scrollTop = 0
})
</script>

<template>
  <div ref="el" class="adv-toolbox" :class="{ open }">
    <span @click="open = !open">
      <slot name="icon" />
    </span>
    <div v-show="open" class="fixed adv-toolbox-inner shadow top-0" :class="position === 'left' ? 'left-0' : 'right-0'">
      <slot />
    </div>
  </div>
</template>

<style lang="scss">
.adv-toolbox {
  box-sizing: border-box;
  position: fixed;
  z-index: 9999;
  color: white;
  transition: all 0.2s ease;

  &-inner {
    background-color: rgba(0, 0, 0, 0.5);
    transition: all 0.2s;

    &:hover {
      background-color: rgba(0, 0, 0, 0.6);
    }
  }

  &.open {
    overflow: auto;
  }
}
</style>
