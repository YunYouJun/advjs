<script setup lang="ts">
// Game Start Menu Page Layout
import { isDark } from '@advjs/core'
import { images } from '../assets'

withDefaults(defineProps<{
  bgImage?: string
}>(), {
  bgImage: images.defaultBgUrl,
})
</script>

<template>
  <AdvHelper class="fixed bottom-5 left-5 z-1" text="white" />
  <!-- <AdvFullscreenBtn class="fixed right-5 top-5 z-1" text="white" /> -->

  <div class="animate__animated animate__fadeIn h-full w-full">
    <AdvAdblock />
    <AdvContainer class="h-full w-full">
      <div
        class="adv-start-bg absolute h-full w-full -z-1" :class="isDark ? 'filter invert' : ''"
        bg="cover no-repeat center"
        :style="{ backgroundImage: `url(${bgImage})` }"
      />
      <main
        class="page-start h-full w-full text-gray-900 dark:text-gray-200"
      >
        <RouterView />
      </main>
    </AdvContainer>
  </div>
</template>
