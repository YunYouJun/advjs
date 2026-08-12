<script setup lang="ts">
import type { SceneTransition } from '@advjs/types'
import { resolveSceneBackground, useAdvContext, useAppStore, useSettingsStore } from '@advjs/client'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'

interface BackgroundLayer {
  id: number
  raw: string
  src: string
}

const { $adv } = useAdvContext()
const app = useAppStore()
const settings = useSettingsStore()
const current = ref<BackgroundLayer>()
const previous = ref<BackgroundLayer>()
const active = ref(true)
const preset = ref('cut')
const duration = ref(0)
const easing = ref('ease-in-out')
let layerId = 0
let clearTimer: ReturnType<typeof setTimeout> | undefined
let requestId = 0

const background = computed(() => $adv.store.state.stage.background)
const cue = computed(() => $adv.resources.backgroundCueRef.value)
const motion = computed(() => settings.storage.animation.motion ?? 'full')
const transitionStyle = computed(() => ({
  '--adv-scene-transition-duration': `${duration.value}ms`,
  '--adv-scene-transition-easing': easing.value,
}))

function backgroundStyle(src: string) {
  return { backgroundImage: `url(${JSON.stringify(src)})` }
}

function normalizedTransition(value?: SceneTransition) {
  const data = typeof value === 'string' ? { name: value } : value
  const fullDuration = data?.duration ?? (data?.name === 'cut' ? 0 : 650)
  const resolvedDuration = motion.value === 'none'
    ? 0
    : motion.value === 'reduced'
      ? Math.min(fullDuration, 140)
      : fullDuration
  return {
    name: motion.value === 'reduced' && data?.name && data.name !== 'cut' ? 'crossfade' : data?.name ?? 'crossfade',
    duration: resolvedDuration,
    easing: data?.easing ?? 'ease-in-out',
  }
}

function resolveSource(raw: string): string {
  return resolveSceneBackground(raw, $adv.gameConfig.value.scenes)
}

async function preload(src: string): Promise<void> {
  if (typeof Image === 'undefined')
    return
  await new Promise<void>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve()
    image.onerror = () => reject(new Error(`Unable to load scene background: ${src}`))
    image.src = src
    if (image.complete && image.naturalWidth > 0)
      resolve()
  })
}

async function present(raw: string, transition?: SceneTransition) {
  if (current.value?.raw === raw)
    return
  if (!raw) {
    requestId++
    if (clearTimer)
      clearTimeout(clearTimer)
    previous.value = undefined
    current.value = undefined
    active.value = true
    preset.value = 'cut'
    duration.value = 0
    return
  }
  const id = ++requestId
  const src = resolveSource(raw)
  try {
    await preload(src)
  }
  catch (error) {
    console.warn('[advjs] Scene background retained after preload failure', error)
    $adv.compileDiagnostics.value = [
      ...$adv.compileDiagnostics.value.filter(item => (
        item.code !== 'ADV_RUNTIME_RESOURCE_LOAD_FAILED' || !item.message.includes(src)
      )),
      {
        code: 'ADV_RUNTIME_RESOURCE_LOAD_FAILED',
        severity: 'warning',
        message: `Unable to load scene background: ${src}`,
      },
    ]
    return
  }
  if (id !== requestId)
    return

  const resolved = normalizedTransition(transition)
  preset.value = resolved.name
  duration.value = resolved.duration
  easing.value = resolved.easing
  previous.value = current.value
  current.value = { id: ++layerId, raw, src }
  active.value = resolved.duration === 0
  await nextTick()
  requestAnimationFrame(() => {
    active.value = true
  })
  if (clearTimer)
    clearTimeout(clearTimer)
  clearTimer = setTimeout(() => {
    previous.value = undefined
  }, resolved.duration + 80)
}

watch(cue, (value) => {
  if (value)
    void present(value.value.url, value.value.transition)
})
watch(background, (value) => {
  if (value !== cue.value?.value.url)
    void present(value, 'cut')
}, { immediate: true })

onBeforeUnmount(() => {
  if (clearTimer)
    clearTimeout(clearTimer)
})
</script>

<template>
  <div
    v-if="app.showBg && current"
    class="adv-background size-full absolute overflow-hidden"
    :data-transition="preset"
    :style="transitionStyle"
  >
    <div
      v-if="previous"
      :key="previous.id"
      class="adv-background__layer adv-background__layer--previous"
      :class="{ 'is-leaving': active }"
      :style="backgroundStyle(previous.src)"
    />
    <div
      :key="current.id"
      class="adv-background__layer adv-background__layer--current"
      :class="{ 'is-active': active }"
      :style="backgroundStyle(current.src)"
    />
  </div>
</template>

<style scoped>
.adv-background__layer {
  position: absolute;
  inset: 0;
  background-position: center;
  background-repeat: no-repeat;
  background-size: cover;
  transition-duration: var(--adv-scene-transition-duration);
  transition-timing-function: var(--adv-scene-transition-easing);
}

.adv-background__layer--current {
  opacity: 0;
  transition-property: opacity, transform, clip-path, filter;
}

.adv-background__layer--current.is-active {
  opacity: 1;
}

.adv-background__layer--previous {
  opacity: 1;
  transition-property: opacity, transform, filter;
}

.adv-background[data-transition='flash-white']::before {
  position: absolute;
  z-index: 2;
  inset: 0;
  background: white;
  content: '';
  pointer-events: none;
  animation: adv-background-flash var(--adv-scene-transition-duration) var(--adv-scene-transition-easing) both;
}

.adv-background[data-transition='crossfade'] .adv-background__layer--previous.is-leaving,
.adv-background[data-transition='fade'] .adv-background__layer--previous.is-leaving,
.adv-background[data-transition='dissolve'] .adv-background__layer--previous.is-leaving {
  opacity: 0;
}

.adv-background[data-transition='dissolve'] .adv-background__layer--current {
  filter: blur(8px) saturate(0.75);
  transform: scale(1.025);
}

.adv-background[data-transition='dissolve'] .adv-background__layer--current.is-active {
  filter: none;
  transform: scale(1);
}

.adv-background[data-transition='wipe-left'] .adv-background__layer--current {
  clip-path: inset(0 0 0 100%);
  opacity: 1;
}

.adv-background[data-transition='wipe-left'] .adv-background__layer--current.is-active {
  clip-path: inset(0);
}

.adv-background[data-transition='wipe-right'] .adv-background__layer--current {
  clip-path: inset(0 100% 0 0);
  opacity: 1;
}

.adv-background[data-transition='wipe-right'] .adv-background__layer--current.is-active {
  clip-path: inset(0);
}

.adv-background[data-transition='rise'] .adv-background__layer--current {
  opacity: 0;
  transform: translateY(4%) scale(1.02);
}

.adv-background[data-transition='rise'] .adv-background__layer--current.is-active {
  opacity: 1;
  transform: none;
}

@keyframes adv-background-flash {
  0%,
  100% {
    opacity: 0;
  }
  45%,
  55% {
    opacity: 0.92;
  }
}
</style>
