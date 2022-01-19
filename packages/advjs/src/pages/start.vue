<template>
  <div
    class="
        adv-start-game-logo
        inline-flex flex-col
        items-center
        animate-animated animate-fadeIn animate-delay-600 mix-blend-hard-light
      "
  >
    <NewYunLogo class="text-8xl mix-blend-screen text-blue-600" m="t-20" alt="YunYouJun Logo" />
    <h1 class="adv-game-title text-xl mt-2 z-1 gradient-text bg-gradient-to-r to-blue-500 from-purple-500 shadow-co text-shadow-lg" font="bold">
      Doki Doki ADV.JS
    </h1>
  </div>

  <img
    class="h-15 absolute -right-2 bottom-0 h-full animate-animated animate-slideInUp animate-delay-500"
    :src="yunGoodAlphaUrl"
  >

  <img
    class="h-200 absolute top-5 -left-5 h-full animate-animated animate-slideInRight animate-delay-200 animate-fadeIn z-2 filter drop-shadow-lg"
    :src="yunAlphaUrl"
  >
  <img
    class="h-170 absolute left-70 top-20 h-full animate-animated animate-slideInRight animate-delay-400 animate-fadeIn z-1 filter drop-shadow"
    :src="irisUrl"
  >

  <small class="mt-10 absolute bottom-3 right-13" text="xs">小云的恋💗爱物语，绝赞制作中！</small>

  <div class="adv-bubble-breath circle-pattern shadow-lg -top-20 -right-15 opacity-10" bg="blue-600 " />
  <div class="adv-bubble-breath circle-pattern absolute -left-35 -bottom-25 shadow-lg opacity-10" bg="blue-500" />
  <div class="adv-bubble-breath circle-pattern absolute right-50 bottom-15 shadow-lg opacity-5" bg="red-500" />
  <div class="adv-bubble-breath circle-pattern absolute left-20 top-20 shadow-lg opacity-10" bg="blue-500" style="--circle-size: 20rem;" />

  <div class="adv-ripple absolute top-0" />
  <div class="adv-ripple bg-orange-400 absolute top-0 right-0 animate-delay-300" />

  <StartMenu :menu-items="menuItems" />

  <AdvModal v-show="app.showMenu" @close="app.toggleShowMenu">
    <MenuPanel />
  </AdvModal>
</template>

<route lang="yaml">
meta:
  layout: start
</route>

<script lang="ts" setup>
import type { StartMenuItem } from '@advjs/theme-default'
import { useAppStore } from '~/stores/app'
import { irisUrl, yunAlphaUrl, yunGoodAlphaUrl } from '~/utils'
const app = useAppStore()

const { t } = useI18n()
const router = useRouter()

const menuItems: StartMenuItem[] = [
  {
    title: t('start-menu.new-game'),
    do: () => {
      router.push('/game')
    },
  },
  {
    title: t('start-menu.load-game'),
    do: () => {
      window.alert('存档？不存在的 ╮(￣▽￣"")╭')
    },
  },
  {
    title: t('start-menu.settings'),
    do: () => {
      app.toggleShowMenu()
    },
  },
  {
    title: t('start-menu.help'),
    do: () => {
      router.push('/help')
    },
  },
  {
    title: t('start-menu.quit'),
    do: () => {
      window.close()
      window.alert('为什么不直接关浏览器窗口呢？╮(￣▽￣"")╭')
    },
  },
]
</script>

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
