<script setup lang="ts">
import { advAspect, advHeight, advWidth } from '~/client/env'
import config from '~/config'

const props = defineProps<{
  width?: number
  meta?: any
  scale?: number | string
}>()

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

const screenAspect = computed(() => width.value / height.value)

const scale = computed(() => {
  if (props.scale)
    return props.scale
  if (screenAspect.value < advAspect)
    return width.value / advWidth
  return (height.value * advAspect) / advWidth
})

const style = computed(() => ({
  height: `${advHeight}px`,
  width: `${advWidth}px`,
  transform: `translate(-50%, -50%) scale(${scale.value})`,
}))

const className = computed(() => ({
  'select-none': !config.selectable,
}))
</script>

<template>
  <div ref="root" class="adv-container relative overflow-hidden" :class="className">
    <div id="adv-content" :style="style">
      <slot />
    </div>
    <slot name="controls" />
  </div>
</template>

<style lang="scss">
// #adv-container will be hidden by adblock plugin
.adv-container {
  background: var(--adv-container-bg, var(--adv-bg-color));
}

#adv-content {
  @apply relative overflow-hidden absolute left-1/2 top-1/2;
}
</style>