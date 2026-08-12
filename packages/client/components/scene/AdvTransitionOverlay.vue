<script setup lang="ts">
import { useAdvContext, useSettingsStore } from '@advjs/client'
import { computed, onBeforeUnmount, ref, watch } from 'vue'

const { $adv } = useAdvContext()
const settings = useSettingsStore()
const visible = ref(false)
const name = ref('fade')
const duration = ref(650)
const easing = ref('ease-in-out')
let timer: ReturnType<typeof setTimeout> | undefined

const cue = computed(() => $adv.resources.transitionCueRef.value)
const style = computed(() => ({
  '--adv-overlay-duration': `${duration.value}ms`,
  '--adv-overlay-easing': easing.value,
}))

watch(cue, (value) => {
  if (!value || settings.storage.animation.motion === 'none')
    return
  if (timer)
    clearTimeout(timer)
  if (value.value.name === 'cut' || value.value.duration === 0) {
    visible.value = false
    return
  }
  name.value = value.value.name
  duration.value = settings.storage.animation.motion === 'reduced'
    ? Math.min(value.value.duration ?? 650, 140)
    : value.value.duration ?? 650
  easing.value = value.value.easing ?? 'ease-in-out'
  visible.value = false
  requestAnimationFrame(() => {
    visible.value = true
    timer = setTimeout(() => {
      visible.value = false
    }, duration.value)
  })
})

onBeforeUnmount(() => {
  if (timer)
    clearTimeout(timer)
})
</script>

<template>
  <div
    v-if="visible"
    class="adv-transition-overlay"
    :data-transition="name"
    :style="style"
    aria-hidden="true"
  />
</template>

<style scoped>
.adv-transition-overlay {
  position: absolute;
  z-index: 8;
  inset: 0;
  pointer-events: none;
  animation: adv-overlay-fade var(--adv-overlay-duration) var(--adv-overlay-easing) both;
}

.adv-transition-overlay[data-transition='flash-white'] {
  background: white;
}

.adv-transition-overlay[data-transition='fade'] {
  background: black;
}

.adv-transition-overlay[data-transition='rise'] {
  background: linear-gradient(0deg, rgb(255 255 255 / 0%), rgb(117 221 235 / 24%), transparent);
  animation-name: adv-overlay-rise;
}

@keyframes adv-overlay-fade {
  0%,
  100% {
    opacity: 0;
  }
  45%,
  55% {
    opacity: 1;
  }
}

@keyframes adv-overlay-rise {
  from {
    opacity: 0;
    transform: translateY(24%);
  }
  45% {
    opacity: 1;
  }
  to {
    opacity: 0;
    transform: translateY(-24%);
  }
}
</style>
