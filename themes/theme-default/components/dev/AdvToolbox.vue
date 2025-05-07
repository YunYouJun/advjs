<script setup lang="ts">
import { ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  position?: 'left' | 'right'
  defaultStatus?: boolean
}>(), {
  position: 'left',
  defaultStatus: false,
})

const el = ref<HTMLElement | null>(null)
const open = ref(props.defaultStatus)

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
    <div v-show="open" class="adv-toolbox-inner fixed top-0 shadow" :style="position === 'left' ? 'left:0' : 'right:0'">
      <slot />
    </div>
  </div>
</template>

<style lang="scss">
.adv-toolbox {
  box-sizing: border-box;
  position: fixed;
  z-index: 999;
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
