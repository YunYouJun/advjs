<script lang="ts" setup>
import type { StartMenuItem } from '@advjs/theme-default'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useAppStore } from '../stores'
import { useAdvConfig } from '../composables'

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
        window.close()
        // eslint-disable-next-line no-alert
        window.alert('为什么不直接关浏览器窗口呢？╮(￣▽￣"")╭')
      },
    },
  ],
)
</script>

<template>
  <div
    class="
        adv-start-game-logo
        inline-flex flex-col
        items-center
        animate__animated animate__fadeIn animate-delay-600 mix-blend-hard-light
      "
  >
    <NewYunLogo class="text-8xl mix-blend-screen text-blue-600" m="t-20" alt="YunYouJun Logo" />
    <h1 class="adv-game-title text-xl mt-2 z-1 gradient-text bg-gradient-to-r to-blue-500 from-purple-500 shadow-co text-shadow-lg" font="bold">
      Doki Doki ADV.JS
    </h1>
  </div>

  <img
    class="absolute -right-2 bottom-0 animate__animated animate__slideInUp animate-delay-500"
    h="15"
    w="15"
    :src="images.yunGoodAlphaUrl"
  >

  <img
    class="h-200 absolute top-5 -left-5
    animate__animated animate__fadeInRight z-2 filter drop-shadow-lg"
    :src="images.yunAlphaUrl"
  >
  <div class="animate__animated animate__fadeInRight animate-delay-200">
    <img
      class="h-200 absolute left-89 top-5 z-1 filter drop-shadow-lg transform -rotate-y-180"
      :src="images.yunAlphaUrl"
    >
  </div>

  <small class="mt-10 absolute bottom-3 right-13" text="xs">小云的恋💗爱物语，绝赞制作中！</small>

  <div class="adv-bubble-breath circle-pattern shadow-lg -top-20 -right-15 opacity-10" bg="blue-600 " />
  <div class="adv-bubble-breath circle-pattern absolute -left-35 -bottom-25 shadow-lg opacity-10" bg="blue-500" />
  <div class="adv-bubble-breath circle-pattern absolute right-50 bottom-15 shadow-lg opacity-5" bg="red-500" />
  <div class="adv-bubble-breath circle-pattern absolute left-20 top-20 shadow-lg opacity-10" bg="blue-500" style="--circle-size: 20rem;" />

  <Transition>
    <div v-if="rippleAnimation" bg="blue-400" class="adv-ripple absolute top-0" />
  </Transition>
  <Transition
    :duration="{ enter: 200, leave: 1200 }"
  >
    <div v-if="rippleAnimation" bg="orange-400" class="adv-ripple absolute top-0 right-0 animate-delay-200" />
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
