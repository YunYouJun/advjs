<script setup lang="ts">
import { useAdvContext } from '@advjs/client'
import { computed } from 'vue'

import { useRoute } from 'vue-router'

const { $adv } = useAdvContext()

// Game Start Menu Page Layout
const route = useRoute()
const gameTitle = computed(() => {
  return $adv.gameConfig.value.title || route.meta.title
})
</script>

<template>
  <AdvHelper class="bottom-5 left-5 fixed z-1" text="white" />
  <!-- <AdvFullscreenBtn class="fixed right-5 top-5 z-1" text="white" /> -->

  <div class="animate__animated animate__fadeIn h-full w-full">
    <AdvAdblock />
    <AdvContainer class="h-full w-full">
      <main
        class="adv-page start text-white h-full w-full transition"
      >
        <RouterView />
      </main>

      <Transition>
        <div v-if="gameTitle" class="px-8 py-6 rounded bg-black/30 bottom-22 left-20 absolute">
          <h1
            class="adv-game-title gradient-text text-7xl leading-snug max-w-250 from-purple-500 to-$adv-theme-title-gradient-end bg-gradient-to-r"
            font="bold"
          >
            {{ gameTitle }}
          </h1>
        </div>
      </Transition>
    </AdvContainer>
  </div>
</template>

<style>
:root,
[data-adv-ui='game'][data-adv-color-scheme='light'] {
  --adv-theme-title-gradient-end: #3b82f6;
}

.dark,
[data-adv-ui='game'][data-adv-color-scheme='dark'] {
  --adv-theme-title-gradient-end: #93c5fd;
}
</style>
