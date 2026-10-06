<script setup lang="ts">
import { useGameConfig } from '@advjs/client'
// Game Start Menu Page Layout
import { images } from '../assets'

withDefaults(defineProps<{
  bgImage?: string
}>(), {
  bgImage: images.defaultBgUrl,
})

const gameConfig = useGameConfig()
</script>

<template>
  <AdvHelper class="fixed bottom-5 left-5 z-1" text="white" />
  <!-- <AdvFullscreenBtn class="fixed right-5 top-5 z-1" text="white" /> -->

  <div class="animate__animated animate__fadeIn h-full w-full">
    <AdvAdblock />
    <AdvContainer class="h-full w-full">
      <div
        class="adv-start-bg absolute h-full w-full -z-1"
        bg="cover no-repeat center"
        :style="{ backgroundImage: gameConfig.cover || bgImage ? `url(${gameConfig.cover || bgImage})` : undefined }"
      />
      <main
        class="page-start h-full w-full text-$adv-c-text"
      >
        <RouterView />
      </main>
    </AdvContainer>
  </div>
</template>

<style scoped>
.adv-start-bg {
  filter: var(--adv-theme-start-bg-filter);
}
</style>
