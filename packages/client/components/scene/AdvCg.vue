<script setup lang="ts">
import type { AdvGalleryItem, SceneTransition } from '@advjs/types'
import { useAdvContext, useSettingsStore } from '@advjs/client'
import { computed, ref, watch } from 'vue'

const { $adv } = useAdvContext()
const settings = useSettingsStore()
const current = ref<AdvGalleryItem>()
const transitionName = ref('crossfade')
const duration = ref(650)
const easing = ref('ease-in-out')
let requestId = 0

const stageCg = computed(() => $adv.store.state.stage.cg)
const cue = computed(() => $adv.resources.cgCueRef.value)
const style = computed(() => ({
  '--adv-cg-duration': `${duration.value}ms`,
  '--adv-cg-easing': easing.value,
}))

function resolveTransition(value?: SceneTransition) {
  const data = typeof value === 'string' ? { name: value } : value
  const motion = settings.storage.animation.motion ?? 'full'
  const requestedDuration = data?.duration ?? (data?.name === 'cut' ? 0 : 650)
  return {
    name: motion === 'reduced' && data?.name !== 'cut' ? 'crossfade' : data?.name ?? 'crossfade',
    duration: motion === 'none' ? 0 : motion === 'reduced' ? Math.min(140, requestedDuration) : requestedDuration,
    easing: data?.easing ?? 'ease-in-out',
  }
}

async function preload(src: string) {
  if (typeof Image === 'undefined')
    return
  const image = new Image()
  image.src = src
  if (typeof image.decode === 'function') {
    await image.decode()
    return
  }
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject(new Error(`Unable to load CG: ${src}`))
  })
}

async function present(id: string, action: 'show' | 'hide', transition?: SceneTransition) {
  const requested = ++requestId
  const resolved = resolveTransition(transition)
  transitionName.value = resolved.name
  duration.value = resolved.duration
  easing.value = resolved.easing
  if (action === 'hide' || !id) {
    current.value = undefined
    return
  }
  const item = $adv.gameConfig.value.gallery?.items.find(item => item.id === id)
  if (!item) {
    console.warn(`[advjs] CG retained because gallery item is missing: ${id}`)
    return
  }
  try {
    await preload(item.src)
  }
  catch (error) {
    console.warn('[advjs] CG retained after preload failure', error)
    $adv.compileDiagnostics.value = [
      ...$adv.compileDiagnostics.value.filter(diagnostic => (
        diagnostic.code !== 'ADV_RUNTIME_RESOURCE_LOAD_FAILED' || !diagnostic.message.includes(item.src)
      )),
      {
        code: 'ADV_RUNTIME_RESOURCE_LOAD_FAILED',
        severity: 'warning',
        message: `Unable to load CG: ${item.src}`,
      },
    ]
    return
  }
  if (requested === requestId)
    current.value = item
}

watch(cue, (value) => {
  if (value)
    void present(value.value.id, value.value.action, value.value.transition)
})
watch(stageCg, (id) => {
  if (id !== cue.value?.value.id || (id && !current.value))
    void present(id, id ? 'show' : 'hide', 'cut')
}, { immediate: true })
</script>

<template>
  <Transition name="adv-cg" mode="out-in">
    <figure
      v-if="current"
      :key="current.id"
      class="adv-cg"
      :data-cg-id="current.id"
      :data-transition="transitionName"
      :style="style"
    >
      <img :src="current.src" :alt="current.alt || current.title">
      <figcaption class="sr-only">
        {{ current.title }}
      </figcaption>
    </figure>
  </Transition>
</template>

<style scoped>
.adv-cg {
  position: absolute;
  z-index: 2;
  inset: 0;
  margin: 0;
  overflow: hidden;
  background: #050812;
}

.adv-cg img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.adv-cg-enter-active,
.adv-cg-leave-active {
  transition:
    opacity var(--adv-cg-duration) var(--adv-cg-easing),
    filter var(--adv-cg-duration) var(--adv-cg-easing),
    transform var(--adv-cg-duration) var(--adv-cg-easing),
    clip-path var(--adv-cg-duration) var(--adv-cg-easing);
}

.adv-cg-enter-from,
.adv-cg-leave-to {
  opacity: 0;
  filter: blur(6px);
}

.adv-cg[data-transition='cut'] {
  --adv-cg-duration: 0ms !important;
}

.adv-cg[data-transition='wipe-left'].adv-cg-enter-from {
  clip-path: inset(0 0 0 100%);
  opacity: 1;
  filter: none;
}
.adv-cg[data-transition='wipe-right'].adv-cg-enter-from {
  clip-path: inset(0 100% 0 0);
  opacity: 1;
  filter: none;
}
.adv-cg[data-transition='rise'].adv-cg-enter-from {
  transform: translateY(5%) scale(1.02);
}
.adv-cg[data-transition='dissolve'].adv-cg-enter-from {
  transform: scale(1.025);
  filter: blur(12px) saturate(0.7);
}

@media (prefers-reduced-motion: reduce) {
  .adv-cg-enter-active,
  .adv-cg-leave-active {
    transition-duration: 1ms !important;
  }
}
</style>
