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
  <AdvHelper class="fixed bottom-5 left-5 z-1" text="white" />
  <!-- <AdvFullscreenBtn class="fixed right-5 top-5 z-1" text="white" /> -->

  <div class="animate__animated animate__fadeIn h-full w-full">
    <AdvAdblock />
    <AdvContainer class="h-full w-full">
      <main
        class="adv-page start h-full w-full text-white transition"
      >
        <RouterView />
      </main>

      <Transition>
        <div v-if="gameTitle" class="absolute bottom-22 left-20 rounded bg-black/30 px-8 py-6">
          <h1
            class="adv-game-title gradient-text bg-linear-to-r max-w-250 from-purple-500 to-blue-500 text-7xl leading-snug text-shadow-lg dark:to-blue-300"
            font="bold"
          >
            {{ gameTitle }}
          </h1>
        </div>
      </Transition>
    </AdvContainer>
  </div>
</template>
