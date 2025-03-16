<script setup lang="ts">
import { provideLocal, useElementSize } from '@vueuse/core'
import { computed, ref } from 'vue'
import { injectionAdvContent, injectionAdvScale } from '../../constants'
import { advAspect, advDataRef, advHeight, advWidth } from '../../data'
import { useAppStore } from '../../stores'

const props = withDefaults(defineProps<{
  width?: number
  meta?: any
  scale?: number
  contentStyle?: object
}>(), {})
const app = useAppStore()

const container = ref<HTMLDivElement>()
const advContentRef = ref<HTMLDivElement>()
const containerSize = useElementSize(container)

const width = computed(() => props.width ? props.width : containerSize.width.value)
const height = computed(() => props.width ? props.width / advAspect.value : containerSize.height.value)

const screenAspect = computed(() => app.isHorizontal ? width.value / height.value : height.value / width.value)

const scale = computed(() => {
  if (props.scale)
    return props.scale

  if (screenAspect.value < advAspect.value)
    return app.isHorizontal ? (width.value / advWidth.value) : (height.value / advWidth.value)

  return app.isHorizontal ? (height.value * advAspect.value) / advWidth.value : (width.value / advHeight.value)
})

const containerStyle = computed(() => props.width
  ? {
      width: `${props.width}px`,
      height: `${props.width / advAspect.value}px`,
    }
  : {},
)

const contentStyle = computed(() => ({
  ...props.contentStyle,
  '--adv-screen-width': `${advWidth.value}px`,
  '--adv-screen-height': `${advHeight.value}px`,
  '--adv-screen-scale': scale.value,
  'transform': `translate(-50%, -50%) scale(${scale.value}) rotate(${app.rotation}deg)`,
}))

const className = computed(() => ({
  'select-none': !advDataRef.value.config.selectable,
}))

provideLocal(injectionAdvScale, scale)
provideLocal(injectionAdvContent, advContentRef)
</script>

<template>
  <div
    ref="container"
    class="adv-screen relative overflow-hidden" bg="black"
    :class="className"
    :style="containerStyle"
  >
    <div
      id="adv-content"
      ref="advContentRef"
      class="relative h-$adv-screen-height w-$adv-screen-width flex transition"
      :style="contentStyle"
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
