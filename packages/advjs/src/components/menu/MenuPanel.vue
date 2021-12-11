<template>
  <div class="menu-panel grid grid-cols-12" gap="15" h="full" text="2xl">
    <div class="col-span-8">
      <div grid="~ cols-12 gap-5">
        <h1
          col="span-12"
          class="adv-font-serif font-black mt-6"
          text="4xl"
        >
          {{ t('settings.title') }}
        </h1>

        <MenuItem v-for="item, i in items" :key="i" :item="item" />
        <SpeechSynthesis />
      </div>
    </div>

    <div class="col-span-4 flex flex-col justify-center items-center" p="5" h="full" border="gray left-2">
      <AdvButton v-for="item,i in menuItems" :key="i" class="flex" @click="item.do">
        {{ item.title }}
      </AdvButton>

      <AdvIconButton
        :title="t('button.toggle_dark')"
        m="x-2 y-5"
        @click="toggleDark()"
      >
        <i-ri-moon-line v-if="isDark" />
        <i-ri-sun-line v-else />
      </AdvIconButton>

      <AdvButton @click="app.toggleShowMenu()">
        取消
      </AdvButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useFullscreen } from '@vueuse/core'
import { useI18n } from 'vue-i18n'

import { useScreenLock } from '@advjs/shared'
import { isDark, toggleDark } from '~/composables'
import { useSettingsStore } from '~/stores/settings'
import { useAppStore } from '~/stores/app'
import { MenuButtonItem } from '~/types/menu'
const { t } = useI18n()

const { orientation, toggle } = useScreenLock()
const { isFullscreen, enter, exit } = useFullscreen()

const app = useAppStore()

const settings = useSettingsStore()
const items = computed(() => {
  return [
    {
      type: 'checkbox',
      label: '是否横屏',
      checked: orientation.value === 'landscape',
      click: async() => {
        if (isFullscreen.value) {
          await exit()
          toggle('portrait')
        }
        else {
          await enter()
          toggle('landscape')
        }
      },
    },
    {
      label: t('settings.fullscreen'),
      type: 'checkbox',
      checked: settings.isFullscreen,
      click: settings.toggleFullScreen,
    },
  ]
})

const router = useRouter()

const menuItems: MenuButtonItem[] = [
  {
    title: '保存游戏',
    do: () => {
      // todo
    },
  },
  {
    title: '加载游戏',
    do: () => {
      // todo load game
      window.alert('存档？不存在的 ╮(￣▽￣"")╭')
    },
  },
  {
    title: '回到主菜单',
    do: () => {
      app.toggleShowMenu()
      router.push('/start')
    },
  },
  {
    title: t('start-menu.help'),
    do: () => {
      // todo
      // help dialog
    },
  },
]
</script>
