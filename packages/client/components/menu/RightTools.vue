<script lang="ts" setup>
import type { MenuButtonItem } from '~/types/menu'
import { isDark, toggleDark } from '@advjs/core'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useAppStore, useSettingsStore } from '../../stores'

const { t, locale, availableLocales } = useI18n()

const app = useAppStore()
const settings = useSettingsStore()

function toggleLocales() {
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

<template>
  <div col="span-6" class="flex flex-col items-start justify-center" h="full" m="l-4">
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
        <div v-if="isDark" i-ri-moon-line />
        <div v-else i-ri-sun-line />
      </AdvIconButton>

      <AdvIconButton m="x-2" :title="t('button.toggle_langs')" @click="toggleLocales">
        <div i-ri-translate class="transform transition" :class="locale === 'en' ? 'rotate-y-180' : ''" />
      </AdvIconButton>
    </div>

    <AdvButton @click="app.toggleShowMenu()">
      {{ t('button.close') }}
    </AdvButton>
  </div>
</template>
