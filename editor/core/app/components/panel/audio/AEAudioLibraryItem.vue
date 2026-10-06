<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps<{ name: string, description: string, src: string }>()
const player = ref<HTMLAudioElement>()
const failed = ref(false)
watch(() => props.src, () => failed.value = false)
onBeforeUnmount(() => player.value?.pause())
function retry() {
  failed.value = false
  player.value?.load()
}
</script>

<template>
  <li class="ae-audio-library-item">
    <div class="ae-resource-name">
      {{ name }}
    </div>
    <audio ref="player" :src="src" :aria-label="$t('audio.preview', { name })" preload="none" controls @error="failed = true" />
    <p v-if="description" class="ae-resource-caption">
      {{ description }}
    </p>
    <div v-if="failed" class="ae-resource-error" role="alert">
      {{ $t('audio.playFailed') }}
      <AGUIButton @click="retry">
        {{ $t('audio.retry') }}
      </AGUIButton>
    </div>
  </li>
</template>

<style scoped>
.ae-audio-library-item {
  min-width: 0;
  padding: 8px;
  border-bottom: 1px solid var(--agui-c-divider);
}
audio {
  display: block;
  width: 100%;
  min-width: 0;
  height: 32px;
  margin-top: 6px;
  color-scheme: light;
}
:global(.dark .ae-audio-library-item audio) {
  color-scheme: dark;
}
p {
  margin: 4px 0 0;
}
</style>
