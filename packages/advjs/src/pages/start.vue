<template>
  <div class="grid grid-cols-3 gap-0 h-full">
    <div
      class="
        relative
        h-full
        col-span-2
        flex flex-col
        justify-center
        items-center
      "
    >
      <NewYunLogo class="text-8xl" alt="YunYouJun Logo" />
      <h1 class="text-4xl mt-10 z-1">
        Doki Doki ADV.JS
      </h1>
      <small class="mt-10">假装这里有立绘，而且是会动的</small>
      <div class="w-full h-2/3 absolute bottom-0">
        <img
          class="h-80 absolute left-5 bottom-0 h-full animate-bounce"
          src="/img/characters/he/he.png"
          style="animation-delay: 0.5s"
        >
        <img
          class="h-80 absolute right-5 bottom-0 h-full animate-bounce"
          src="/img/characters/she/she.png"
        >
      </div>
    </div>
    <div>
      <StartMenu :menu-items="menuItems" />
    </div>

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
      window.alert('为什么不直接关浏览器窗口呢？╮(￣▽￣"")╭')
    },
  },
]
</script>
