<template>
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
</template>

<script lang="ts" setup>
import type { MenuButtonItem } from '~/types/menu'

import { isDark, toggleDark } from '~/composables'
import { useAppStore } from '~/stores/app'
import { useSettingsStore } from '~/stores/settings'

const { t, locale, availableLocales } = useI18n()

const app = useAppStore()
const settings = useSettingsStore()

const toggleLocales = () => {
  // change to some real logic
  const locales = availableLocales
  locale.value = locales[(locales.indexOf(locale.value) + 1) % locales.length]
}

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
