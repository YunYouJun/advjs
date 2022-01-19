<template>
  <div class="grid gap-0 h-full">
    <div
      class="
        absolute
        left-0
        w-120
        h-full
        flex flex-col
        items-center
      "
    >
      <NewYunLogo class="text-8xl" m="t-25" alt="YunYouJun Logo" />
      <h1 class="text-4xl mt-10 z-1" font="serif black">
        Doki Doki ADV.JS
      </h1>
      <small class="mt-10" text="xl" font="serif black">小云的恋爱物语</small>
      <img
        class="h-50 absolute left-35 bottom-0 h-full animate-animated animate-slideInUp"
        :src="yunGoodAlphaUrl"
      >
      <!-- <img
          class="h-80 absolute left-5 bottom-0 h-full animate-animated animate-bounce"
          src="/img/characters/he/he.png"
          style="animation-delay: 0.5s"
        >
        <img
          class="h-80 absolute right-5 bottom-0 h-full animate-animated animate-bounce"
          src="/img/characters/she/she.png"
        > -->
    </div>

    <img
      class="h-200 absolute top-0 right-40 h-full animate-animated animate-delay-500 animate-fadeIn"
      :src="yunAlphaUrl"
    >

    <StartMenu :menu-items="menuItems" />

    <AdvModal v-show="app.showMenu" @close="app.toggleShowMenu">
      <MenuPanel />
    </AdvModal>
  </div>
</template>

<route lang="yaml">
meta:
  layout: start
</route>

<script lang="ts" setup>
import type { StartMenuItem } from '@advjs/theme-default'
import { useAppStore } from '~/stores/app'
import { yunAlphaUrl, yunGoodAlphaUrl } from '~/utils'
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
