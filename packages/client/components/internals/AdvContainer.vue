<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue'
import { useElementSize } from '@vueuse/core'
import { advAspect, advHeight, advWidth } from '../../config'
import { useAppStore } from '../../stores'
import { useAdvConfig } from '../../composables'

const props = withDefaults(defineProps<{
  width?: number
  meta?: any
  scale?: number | string
}>(), {})
const advConfig = useAdvConfig()
const app = useAppStore()

const root = ref<HTMLDivElement>()
const element = useElementSize(root)

const width = computed(() => props.width ? props.width : element.width.value)
const height = computed(() => props.width ? props.width / advAspect.value : element.height.value)

if (props.width) {
  watchEffect(() => {
    if (root.value) {
      root.value.style.width = `${width.value}px`
      root.value.style.height = `${height.value}px`
    }
  })
}

const screenAspect = computed(() => app.isHorizontal ? width.value / height.value : height.value / width.value)

const containerScale = computed(() => {
  if (props.scale)
    return props.scale

  if (screenAspect.value < advAspect.value)
    return app.isHorizontal ? (width.value / advWidth.value) : (height.value / advWidth.value)

  return app.isHorizontal ? (height.value * advAspect.value) / advWidth.value : (width.value / advHeight.value)
})

const style = computed(() => ({
  '--adv-screen-width': `${advWidth.value}px`,
  '--adv-screen-height': `${advHeight.value}px`,
  'transform': `translate(-50%, -50%) scale(${containerScale.value}) rotate(${app.rotation}deg)`,
}))

const className = computed(() => ({
  'select-none': !advConfig.value.selectable,
}))
</script>

<template>
  <div ref="root" class="adv-screen relative overflow-hidden" bg="black" :class="className">
    <div
      id="adv-content"
      class="relative h-$adv-screen-height w-$adv-screen-width flex transition"
      :style="style"
    >
      <slot />
    </div>
    <slot name="controls" />
  </div>
</template>

<style lang="scss">
// #adv-container will be hidden by adblock plugin

#adv-content {
  @apply overflow-hidden left-1/2 top-1/2;
}
</style>
