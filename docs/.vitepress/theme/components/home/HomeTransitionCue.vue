<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useHomeSkin } from '../../composables/skin'
import { SKIN_TRANSITIONS } from './data/skin-ids'
import { stories } from './data/skins'

/**
 * While a skin switch plays, shows the `.adv.md` block that would stage the same entrance:
 * the new world's background, brought in with one of the engine's transition presets.
 * It stays a moment after the entrance so it can be read.
 */
const { skin, phase, incoming } = useHomeSkin()

const LINGER = 1600
const shown = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined

watch(phase, (now) => {
  clearTimeout(timer)
  if (now !== 'idle')
    shown.value = true
  else
    timer = setTimeout(() => shown.value = false, LINGER)
})

const target = computed(() => incoming.value ?? skin.value)
const cue = computed(() => SKIN_TRANSITIONS[target.value].enter)
</script>

<template>
  <Transition name="cue">
    <pre v-if="shown" class="cue" aria-hidden="true"><span class="k">type</span>: <span class="v">background</span>
<span class="k">name</span>: <span class="v">{{ stories[target].id }}</span>
<span class="k">transition</span>:
  <span class="k">name</span>: <span class="s">{{ cue.name }}</span>
  <span class="k">duration</span>: <span class="n">{{ cue.duration }}</span></pre>
  </Transition>
</template>

<style scoped>
.cue {
  position: absolute;
  z-index: 5;
  right: 16px;
  bottom: 16px;
  margin: 0;
  padding: 10px 14px;
  border-radius: 8px;
  font-family: var(--h-mono);
  font-size: 12px;
  line-height: 1.6;
  color: #e9e7e1;
  background: rgba(12, 13, 14, 0.86);
  box-shadow: 0 0 0 1px rgba(233, 231, 225, 0.12);
  pointer-events: none;
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}

.k {
  color: #8d8a83;
}

.v {
  color: #e9e7e1;
}

.s {
  color: #ffb13b;
}

.n {
  color: #7cc4ff;
}

.cue-enter-active,
.cue-leave-active {
  transition:
    opacity 0.3s ease,
    transform 0.3s ease;
}

.cue-enter-from,
.cue-leave-to {
  opacity: 0;
  transform: translateY(6px);
}

@media (prefers-reduced-motion: reduce) {
  .cue-enter-active,
  .cue-leave-active {
    transition: none;
  }
}
</style>
