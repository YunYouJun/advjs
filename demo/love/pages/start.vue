<script lang="ts" setup>
import { useGameConfig } from '@advjs/client'
import { images, useThemeDefaultStore } from '@advjs/theme-default'

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
        class="adv-game-title gradient-text shadow-co z-1 mt-2 from-purple-500 to-blue-500 bg-gradient-to-r text-4xl text-shadow-lg dark:to-blue-300"
        font="bold"
      >
        {{ gameConfig.title }}
      </h1>
    </slot>
  </div>

  <slot name="cover">
    <!-- custom cover -->
    <ATDCover />

    <img
      class="animate__animated animate__slideInUp absolute bottom-0 animate-delay-500 -right-2"
      h="15"
      w="15"
      :src="images.yunGoodAlphaUrl"
    >

    <small class="absolute bottom-3 right-13 mt-10" text="xs">小云的恋💗爱物语，绝赞制作中！</small>
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
