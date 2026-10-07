<script setup lang="ts">
import { useAdvContext, useAppStore, useGameConfig } from '@advjs/client'
import GameIconButton from '@advjs/client/components/ui/GameIconButton.vue'
import { useGameControlsI18n } from '@advjs/client/composables/useGameControlsI18n'
import { computed } from 'vue'
// Game Start Menu Page Layout
import { images } from '../assets'

withDefaults(defineProps<{
  bgImage?: string
}>(), {
  bgImage: images.defaultBgUrl,
})

const gameConfig = useGameConfig()
const { $adv } = useAdvContext()
const theme = computed(() => ({ ...$adv.themeConfig.value, ui: { colorScheme: 'dark' as const, ...$adv.themeConfig.value?.ui } }))
const app = useAppStore()
const { t } = useGameControlsI18n()
</script>

<template>
  <div class="animate__animated animate__fadeIn h-full w-full">
    <AdvAdblock />
    <AdvContainer class="h-full w-full" :config="$adv.config.value" :theme="theme">
      <template #controls>
        <GameIconButton class="adv-start-rotate" :label="t('controls.rotate')" :description="t('hints.rotate')" @click="app.rotate()">
          <span class="i-ri-clockwise-line" />
        </GameIconButton>
      </template>
      <div
        class="adv-start-bg absolute h-full w-full -z-1"
      >
        <div class="adv-start-art absolute h-full w-full" bg="cover no-repeat center" :style="{ backgroundImage: gameConfig.cover || bgImage ? `url(${gameConfig.cover || bgImage})` : undefined }" />
      </div>
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
  background-color: var(--adv-c-bg);
}
.adv-start-art {
  filter: var(--adv-theme-start-bg-filter);
}
.adv-screen :deep(.adv-start-rotate) {
  position: absolute;
  left: 12px;
  bottom: 12px;
  z-index: 5;
}
</style>
