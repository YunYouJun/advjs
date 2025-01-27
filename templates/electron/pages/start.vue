<script lang="ts" setup>
import type { StartMenuItem } from '@advjs/theme-default'
import { useAdvConfig, useAppStore } from 'advjs/client'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { quitApp } from '../electron/ipc/renderer'

const advConfig = useAdvConfig()
const images = computed(() => advConfig.value.assets.images)
const app = useAppStore()

const { t } = useI18n()
const router = useRouter()

const rippleAnimation = ref(true)
onMounted(() => {
  rippleAnimation.value = false
})

const menuItems = computed<StartMenuItem[]>(() =>
  [
    {
      title: t('menu.new_game'),
      do: () => {
        router.push('/game')
      },
    },
    {
      title: t('menu.load_game'),
      do: () => {
        app.toggleShowLoadMenu()
      },
    },
    {
      title: t('menu.settings'),
      do: () => {
        app.toggleShowMenu()
      },
    },
    {
      title: t('menu.help'),
      do: () => {
        router.push('/help')
      },
    },
    {
      title: t('menu.quit'),
      do: () => {
        quitApp()
      },
    },
  ],
)
</script>

<template>
  <div
    class="animate__animated animate__fadeIn adv-start-game-logo inline-flex flex-col animate-delay-600 items-center mix-blend-hard-light"
  >
    <NewYunLogo class="text-8xl text-blue-600 mix-blend-screen" m="t-20" alt="YunYouJun Logo" />
    <h1 class="adv-game-title gradient-text shadow-co z-1 mt-2 from-purple-500 to-blue-500 bg-gradient-to-r text-xl text-shadow-lg" font="bold">
      Doki Doki ADV.JS
    </h1>
  </div>

  <img
    class="animate__animated animate__slideInUp absolute bottom-0 animate-delay-500 -right-2"
    h="15"
    w="15"
    :src="images.yunGoodAlphaUrl"
  >

  <img
    class="animate__animated animate__fadeInRight absolute top-5 z-2 h-200 drop-shadow-lg filter -left-5"
    :src="images.yunAlphaUrl"
  >
  <div class="animate__animated animate__fadeInRight animate-delay-200">
    <img
      class="absolute left-89 top-5 z-1 h-200 transform drop-shadow-lg filter -rotate-y-180"
      :src="images.yunAlphaUrl"
    >
  </div>

  <small class="absolute bottom-3 right-13 mt-10" text="xs">小云的恋💗爱物语，绝赞制作中！</small>

  <div class="adv-bubble-breath circle-pattern opacity-10 shadow-lg -right-15 -top-20" bg="blue-600 " />
  <div class="adv-bubble-breath circle-pattern absolute opacity-10 shadow-lg -bottom-25 -left-35" bg="blue-500" />
  <div class="adv-bubble-breath circle-pattern absolute bottom-15 right-50 opacity-5 shadow-lg" bg="red-500" />
  <div class="adv-bubble-breath circle-pattern absolute left-20 top-20 opacity-10 shadow-lg" bg="blue-500" style="--circle-size: 20rem;" />

  <Transition>
    <div v-if="rippleAnimation" bg="blue-400" class="adv-ripple absolute top-0" />
  </Transition>
  <Transition
    :duration="{ enter: 200, leave: 1200 }"
  >
    <div v-if="rippleAnimation" bg="orange-400" class="adv-ripple absolute right-0 top-0 animate-delay-200" />
  </Transition>

  <StartMenu :menu-items="menuItems" />

  <AdvModal header="加载存档" :show="app.showLoadMenu" @close="app.toggleShowLoadMenu">
    <LoadMenu />
  </AdvModal>

  <AdvModal :show="app.showMenu" @close="app.toggleShowMenu">
    <MenuPanel />
  </AdvModal>
</template>

<route lang="yaml">
meta:
  layout: start
</route>

<style lang="scss">
.adv-start-game-logo {
  position: absolute;
  left: 20rem;
  top: 0rem;
}

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
