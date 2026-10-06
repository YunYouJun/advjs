<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'

const props = defineProps<{
  src?: string
  fallbackSrc?: string
  alt: string
}>()

const failedSources = shallowRef<string[]>([])
watch(() => [props.src, props.fallbackSrc], () => {
  failedSources.value = []
})
const imageSource = computed(() => [props.src, props.fallbackSrc].find(src => src && !failedSources.value.includes(src)))

function onError() {
  if (imageSource.value)
    failedSources.value = [...failedSources.value, imageSource.value]
}
</script>

<template>
  <img v-if="imageSource" :src="imageSource" :alt="alt" :data-avatar-fallback="imageSource !== src" @error="onError">
</template>
