<script lang="ts" setup>
import type { MenuButtonItem } from '../../types/menu'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useAppStore, useSettingsStore } from '../../stores'

const { t } = useI18n()

const app = useAppStore()
const settings = useSettingsStore()
const router = useRouter()
const route = useRoute()

const menuItems = computed<MenuButtonItem[]>(() => {
  const items
    = route.path === '/game'
      ? [
          {
            title: t('menu.save_game'),
            icon: 'i-ri-save-line',
            do: () => {
              app.menus.settings = false
              app.toggleShowSaveMenu()
            },
          },
        ]
      : []

  return [...items, {
    title: t('menu.load_game'),
    icon: 'i-ri-folder-upload-line',
    do: () => {
      app.menus.settings = false
      app.toggleShowLoadMenu()
    },
  }, {
    title: t('menu.back_home'),
    icon: 'i-ri-home-4-line',
    do: () => {
      app.menus.settings = false
      router.push('/start')
    },
  }, {
    title: t('menu.reset_settings'),
    icon: 'i-ri-restart-line',
    do: () => {
      settings.resetSettings()
    },
  }, {
    title: t('menu.help'),
    icon: 'i-ri-question-line',
    do: () => {
      app.menus.settings = false
      router.push('/help')
    },
  }]
})
</script>

<template>
  <nav class="adv-settings-tools" :aria-label="t('settings.title')">
    <AdvButton v-for="item in menuItems" :key="item.title" class="adv-settings-action" @click="item.do">
      <span v-if="item.icon" :class="item.icon" aria-hidden="true" />
      <span>{{ item.title }}</span>
    </AdvButton>
    <AdvButton class="adv-settings-action" @click="app.menus.settings = false">
      <span i-ri-close-line aria-hidden="true" />
      <span>{{ t('button.close') }}</span>
    </AdvButton>
  </nav>
</template>
