<script lang="ts" setup>
import { useGameConfig } from '@advjs/client'
import { useAdvMotionPreference } from '@advjs/client/composables/useAdvMotionPreference'
import { useThemeDefaultStore } from '@advjs/theme-default'

const gameConfig = useGameConfig()
const themeStore = useThemeDefaultStore()
const motion = useAdvMotionPreference()
</script>

<template>
  <div class="adv-start-page" :data-motion="motion">
    <slot name="cover">
      <ATDCover />
    </slot>
    <div class="adv-start-shell">
      <section class="adv-start-panel" :aria-label="gameConfig.title">
        <header class="adv-start-game-logo">
          <slot name="logo">
            <NewYunLogo class="adv-start-logo" aria-hidden="true" />
          </slot>
          <slot name="title">
            <h1 class="adv-game-title">
              {{ gameConfig.title }}
            </h1>
          </slot>
        </header>
        <StartMenu :menu-items="themeStore.$startMenu.menuItems" inline />
      </section>
    </div>
    <AdvGameModals />
  </div>
</template>

<route lang="yaml">
meta:
  layout: start
</route>

<style scoped lang="scss">
.adv-start-page {
  position: relative;
  width: 100%;
  height: 100%;
}
.adv-start-shell {
  position: absolute;
  inset: 0;
  z-index: 3;
  display: flex;
  flex-direction: column;
  padding: calc(28px / var(--adv-screen-scale, 1));
  overflow: auto;
  pointer-events: none;
}
.adv-start-panel {
  flex: none;
  align-self: flex-end;
  width: min(100%, calc(300px / var(--adv-screen-scale, 1)));
  margin-block: auto;
  display: flex;
  flex-direction: column;
  gap: calc(var(--adv-theme-start-title-gap, 36px) / var(--adv-screen-scale, 1));
  pointer-events: auto;
  animation: adv-start-in 180ms ease-out;
}
.adv-start-game-logo {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: calc(16px / var(--adv-screen-scale, 1));
}
.adv-start-logo {
  font-size: calc(64px / var(--adv-screen-scale, 1));
  color: var(--adv-theme-logo-color, var(--adv-c-primary));
}
.adv-game-title {
  margin: 0;
  color: var(--adv-theme-start-title-color, var(--adv-c-text));
  font-family: var(--adv-font-family, system-ui), sans-serif;
  font-size: calc(var(--adv-theme-start-title-size, 30px) / var(--adv-screen-scale, 1));
  font-weight: 600;
  line-height: 1.25;
  overflow-wrap: anywhere;
  text-wrap: balance;
}
@container adv-game (max-width: 600px) {
  .adv-start-shell {
    bottom: calc(56px / var(--adv-screen-scale, 1));
    padding: calc(20px / var(--adv-screen-scale, 1));
  }
  .adv-start-logo {
    font-size: calc(48px / var(--adv-screen-scale, 1));
  }
  .adv-start-game-logo {
    gap: calc(12px / var(--adv-screen-scale, 1));
  }
  .adv-start-panel {
    align-self: center;
  }
}
.adv-start-page[data-motion='reduced'] .adv-start-panel {
  animation-duration: 80ms;
}
.adv-start-page[data-motion='none'] .adv-start-panel {
  animation: none;
}
@media (prefers-reduced-motion: reduce) {
  .adv-start-panel {
    animation: none;
  }
}
@keyframes adv-start-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
</style>
