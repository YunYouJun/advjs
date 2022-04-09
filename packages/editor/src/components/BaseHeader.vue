<script setup lang="ts">
// import * as pkg from '~/../package.json'
import { useAppStore } from '../stores/app'
import { isDark, toggleDark } from '../composables'

const appStore = useAppStore()

const { t, availableLocales, locale } = useI18n()

// const toggleLocales = () => {
//   // change to some real logic
//   const locales = availableLocales
//   locale.value = locales[(locales.indexOf(locale.value) + 1) % locales.length]
// }

// initoptions
</script>

<template>
  <nav class="text-xl pt-2">
    <router-link
      active-class="text-blue-500"
      class="icon-btn mx-2"
      to="/"
      :title="t('button.home')"
    >
      <i-ri-home-2-line />
    </router-link>

    <button
      class="icon-btn mx-2 !outline-none"
      :title="t('button.toggle_dark')"
      @click="appStore.toggleLeftRight"
    >
      <i-ri-arrow-left-right-line
        class="transition transform <sm:hidden"
        :class="appStore.isPositive ? '-rotate-y-180' : 0"
      />
      <i-ri-arrow-up-down-line
        class="transition transform sm:hidden"
        :class="appStore.isPositive ? '-rotate-x-180' : 0"
      />
    </button>

    <button
      class="icon-btn mx-2 !outline-none"
      :title="t('button.toggle_dark')"
      @click="toggleDark()"
    >
      <i-ri-moon-line v-if="isDark" />
      <i-ri-sun-line v-else />
    </button>

    <!-- <a class="icon-btn mx-2" :title="t('button.toggle_langs')" @click="toggleLocales">
      <i-ri-translate-2 />
    </a>-->

    <router-link
      class="icon-btn mx-2"
      href
      to="/about"
      :title="t('button.about')"
      active-class="text-blue-500"
    >
      <i-carbon-dicom-overlay />
    </router-link>

    <a
      class="icon-btn mx-2"
      rel="noreferrer"
      href="https://github.com/YunYouJun/advjs"
      target="_blank"
      title="GitHub"
    >
      <i-ri-github-line />
    </a>
  </nav>
</template>
