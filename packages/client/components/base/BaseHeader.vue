<script setup lang="ts">
// import * as pkg from '~/../package.json'
import { useI18n } from 'vue-i18n'
import { isDark, toggleDark } from '@advjs/core'

const { t, availableLocales, locale } = useI18n()

function toggleLocales() {
  // change to some real logic
  const locales = availableLocales
  locale.value = locales[(locales.indexOf(locale.value) + 1) % locales.length]
}
</script>

<template>
  <nav class="text-xl pt-4">
    <RouterLink class="icon-btn mx-2" to="/" :title="t('button.home')">
      <div i-ri-home-2-line />
    </RouterLink>

    <button
      class="icon-btn mx-2 !outline-none"
      :title="t('button.toggle_dark')"
      @click="toggleDark()"
    >
      <div v-if="isDark" i-ri-moon-line />
      <div v-else i-ri-sun-line />
    </button>

    <a class="icon-btn mx-2" :title="t('button.toggle_langs')" @click="toggleLocales">
      <div i-ri-translate-2 />
    </a>

    <a
      class="icon-btn mx-2"
      href="https://www.yunyoujun.cn/posts/make-an-avg-engine/"
      target="_blank"
      :title="t('button.about')"
    >
      <div i-carbon-dicom-overlay />
    </a>

    <a
      class="icon-btn mx-2"
      rel="noreferrer"
      href="https://github.com/YunYouJun/advjs"
      target="_blank"
      title="GitHub"
    >
      <div i-ri-github-line />
    </a>

    <!-- wc-github-corners -->
    <!-- <github-corners color="#151513" :repo="pkg.repository.url"></github-corners> -->
  </nav>
</template>
