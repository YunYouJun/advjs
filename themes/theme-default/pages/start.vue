<script lang="ts" setup>
import { useGameConfig } from '@advjs/client'
import { useThemeDefaultStore } from '@advjs/theme-default'

const gameConfig = useGameConfig()

const themeStore = useThemeDefaultStore()
</script>

<template>
  <div
    class="animate__animated animate__fadeIn adv-start-game-logo inline-flex flex-col animate-delay-600 items-center mix-blend-hard-light"
    absolute right-5rem min-w-25rem
  >
    <slot name="logo">
      <!-- custom logo -->
      <NewYunLogo
        class="text-9xl text-blue-600 mix-blend-screen dark:text-blue-400"
        m="t-20" alt="YunYouJun Logo"
      />
    </slot>

    <slot name="title">
      <h1
        class="adv-game-title gradient-text shadow-co bg-linear-to-r z-1 mt-2 from-purple-500 to-blue-500 text-4xl text-shadow-lg dark:to-blue-300"
        font="bold"
      >
        {{ gameConfig.title }}
      </h1>
    </slot>
  </div>

  <slot name="cover">
    <!-- custom cover -->
    <ATDCover />
  </slot>

  <StartMenu :menu-items="themeStore.$startMenu.menuItems" />

  <AdvGameModals />
</template>

<route lang="yaml">
meta:
  layout: start
</route>

<style lang="scss">
.adv-game-title {
  --text-shadow-color: #{rgba(#0078e7, 0.4)};
  text-shadow: 0 0 20px var(--text-shadow-color);
}

.circle-pattern {
  --circle-size: 15rem;
  width: var(--circle-size);
  height: var(--circle-size);

  mix-blend-mode: hard-light;
  border-radius: 50%;

  position: absolute;
}
</style>
