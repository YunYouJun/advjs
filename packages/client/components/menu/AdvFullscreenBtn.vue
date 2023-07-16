<script lang="ts" setup>
import { useFullscreen } from '@vueuse/core'

const { isFullscreen, toggle } = useFullscreen()
</script>

<template>
  <AdvIconButton @click="toggle()">
    <div v-if="!isFullscreen" i-ri-fullscreen-line />
    <div v-else i-ri-fullscreen-exit-line />
  </AdvIconButton>
</template>
