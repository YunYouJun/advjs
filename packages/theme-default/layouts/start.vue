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
  <AdvHelper class="z-1 fixed left-5 bottom-5" text="white" />
  <AdvFullscreenBtn class="z-1 fixed right-5 top-5" text="white" />

  <div class="w-full h-full animate__animated animate__fadeIn">
    <AdvAdblock />
    <AdvContainer class="w-full h-full">
      <div
        class="adv-start-bg absolute w-full h-full -z-1" :class="isDark ? 'filter invert' : ''"
        bg="cover no-repeat center"
        :style="{ backgroundImage: `url(${bgImage})` }"
      />
      <main
        class="page-start w-full h-full text-gray-900 dark:text-gray-200"
      >
        <RouterView />
      </main>
    </AdvContainer>
  </div>
</template>
