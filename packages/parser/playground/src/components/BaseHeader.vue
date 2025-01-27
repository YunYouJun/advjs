<script setup lang="ts">
// import * as pkg from '~/../package.json'
import { useI18n } from 'vue-i18n'
import { isDark, toggleDark } from '../composables'
import { useAppStore } from '../stores/app'

const appStore = useAppStore()

const { t, availableLocales, locale } = useI18n()

function toggleLocales() {
  // change to some real logic
  const locales = availableLocales
  locale.value = locales[(locales.indexOf(locale.value) + 1) % locales.length]
}
</script>

<template>
  <nav class="pt-2 text-xl">
    <RouterLink
      active-class="text-blue-500"
      class="mx-2 icon-btn"
      to="/"
      :title="t('button.home')"
    >
      <div i-ri-home-2-line />
    </RouterLink>

    <button
      class="mx-2 icon-btn !outline-none"
      :title="t('button.toggle_dark')"
      @click="appStore.toggleLeftRight"
    >
      <div
        i-ri-arrow-left-right-line
        class="transform transition <sm:hidden"
        :class="appStore.isPositive ? '-rotate-y-180' : 0"
      />
      <div
        i-ri-arrow-up-down-line
        class="transform transition sm:hidden"
        :class="appStore.isPositive ? '-rotate-x-180' : 0"
      />
    </button>

    <button
      class="mx-2 icon-btn !outline-none"
      :title="t('button.toggle_dark')"
      @click="toggleDark()"
    >
      <div v-if="isDark" i-ri-moon-line />
      <div v-else i-ri-sun-line />
    </button>

    <a class="mx-2 transform transition icon-btn" :class="{ '-rotate-y-180': locale === 'zh-CN' }" :title="t('button.toggle_langs')" @click="toggleLocales">
      <div i-ri-translate />
    </a>

    <RouterLink
      class="mx-2 icon-btn"
      href
      to="/about"
      :title="t('button.about')"
      active-class="text-blue-500"
    >
      <div i-carbon-dicom-overlay />
    </RouterLink>

    <a
      class="mx-2 icon-btn"
      rel="noreferrer"
      href="https://github.com/YunYouJun/advjs"
      target="_blank"
      title="GitHub"
    >
      <div i-ri-github-line />
    </a>
  </nav>
</template>
