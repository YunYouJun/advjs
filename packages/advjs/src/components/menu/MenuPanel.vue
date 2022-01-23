<template>
  <div class="menu-panel grid grid-cols-24" gap="0" h="full" text="2xl">
    <div col="span-18" class="overflow-y-scroll">
      <div grid="~ cols-12 gap-5" p="4">
        <h1
          col="span-12"
          class="adv-font-serif font-black"
          text="4xl"
        >
          {{ t('settings.title') }}
        </h1>

        <HorizontalDivider />

        <TextPlayPreview />

        <HorizontalDivider />

        <MenuItem v-for="(item, i) in items" :key="i" :item="item" />
        <SpeechSynthesis />

        <HorizontalDivider />

        <ToggleSourceMd />

        <HorizontalDivider />
      </div>

      <!-- <div h="full" border="gray right-2" /> -->
    </div>

    <!-- <div col="span-1" class="flex justify-center items-center" /> -->

    <div col="span-6" class="flex flex-col justify-center items-start" h="full" m="l-4">
      <AdvButton
        v-for="(item, i) in menuItems"
        :key="i"
        class="flex"
        @click="item.do"
      >
        {{ item.title }}
      </AdvButton>

      <div m="y-5">
        <AdvIconButton :title="t('button.toggle_dark')" m="x-2" @click="toggleDark()">
          <i-ri-moon-line v-if="isDark" />
          <i-ri-sun-line v-else />
        </AdvIconButton>

        <AdvIconButton m="x-2" :title="t('button.toggle_langs')" @click="toggleLocales">
          <i-ri-translate class="transition transform" :class="locale === 'en' ? 'rotate-y-180' : ''" />
        </AdvIconButton>
      </div>

      <AdvButton @click="app.toggleShowMenu()">
        {{ t('button.close') }}
      </AdvButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useFullscreen } from '@vueuse/core'
import { useI18n } from 'vue-i18n'

import { useScreenLock } from '@advjs/shared'
import type { AdvMenuItemProps } from '@advjs/theme-default'
import { isDark, toggleDark } from '~/composables'
import { useSettingsStore } from '~/stores/settings'
import { useAppStore } from '~/stores/app'
import type { MenuButtonItem } from '~/types/menu'

const { t, locale, availableLocales } = useI18n()

const { orientation, toggle } = useScreenLock()
const { isFullscreen, enter, exit } = useFullscreen()

const app = useAppStore()

const toggleLocales = () => {
  // change to some real logic
  const locales = availableLocales
  locale.value = locales[(locales.indexOf(locale.value) + 1) % locales.length]
}

const settings = useSettingsStore()
const items = computed(() => {
  return [
    {
      type: 'Checkbox',
      label: t('settings.landscape'),
      props: {
        checked: orientation.value === 'landscape',
        onClick: async() => {
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
    },
    {
      label: t('settings.fullscreen'),
      type: 'Checkbox',
      props: {
        checked: settings.storage.isFullscreen,
        onClick: settings.toggleFullScreen,
      },
    },
  ] as AdvMenuItemProps[]
})

const router = useRouter()
const route = useRoute()

const menuItems = computed<MenuButtonItem[]>(() => {
  const items
    = route.path === '/game'
      ? [
        {
          title: t('menu.save_game'),
          do: () => {
            app.toggleShowMenu()
            app.toggleShowSaveMenu()
          },
        },
      ]
      : []

  return items.concat(
    {
      title: t('menu.load_game'),
      do: () => {
        app.toggleShowMenu()
        app.toggleShowLoadMenu()
      },
    },
    {
      title: t('menu.back_home'),
      do: () => {
        app.toggleShowMenu()
        router.push('/start')
      },
    },
    {
      title: t('menu.reset_settings'),
      do: () => {
        settings.resetSettings()
      },
    },
    {
      title: t('menu.help'),
      do: () => {
        router.push('/help')
      },
    },
  )
})
</script>
