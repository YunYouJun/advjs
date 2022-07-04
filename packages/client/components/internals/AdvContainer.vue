<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue'
import { useElementSize } from '@vueuse/core'
import { advAspect, advHeight, advWidth, configs } from '~/env'
import { useAppStore } from '~/stores/app'

const props = defineProps<{
  width?: number
  meta?: any
  scale?: number | string
}>()

const app = useAppStore()

const root = ref<HTMLDivElement>()
const element = useElementSize(root)

const width = computed(() => (props.width ? props.width : element.width.value))
const height = computed(() =>
  props.width ? props.width / advAspect : element.height.value,
)

if (props.width) {
  watchEffect(() => {
    if (root.value) {
      root.value.style.width = `${width.value}px`
      root.value.style.height = `${height.value}px`
    }
  })
}

const screenAspect = computed(() => app.isHorizontal ? width.value / height.value : height.value / width.value)

const scale = computed(() => {
  if (props.scale)
    return props.scale

  if (screenAspect.value < advAspect)
    return app.isHorizontal ? (width.value / advWidth) : (height.value / advWidth)

  return app.isHorizontal ? (height.value * advAspect) / advWidth : (width.value / advHeight)
})

const style = computed(() => ({
  '--adv-screen-width': `${advWidth}px`,
  '--adv-screen-height': `${advHeight}px`,
  'transform': `translate(-50%, -50%) scale(${scale.value}) rotate(${app.rotation}deg)`,
}))

const className = computed(() => ({
  'select-none': !configs.selectable,
}))
</script>

<template>
  <div ref="root" class="adv-screen relative overflow-hidden" bg="black" :class="className">
    <div id="adv-content" class="transition" :style="style">
      <slot />
    </div>
    <slot name="controls" />
  </div>
</template>

<style lang="scss">
// #adv-container will be hidden by adblock plugin

#adv-content {
  @apply relative overflow-hidden absolute left-1/2 top-1/2;

  width: var(--adv-screen-width);
  height: var(--adv-screen-height);
}
</style>
