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
  <nav class="pt-4 text-xl">
    <RouterLink class="mx-2 icon-btn" to="/" :title="t('button.home')">
      <div i-ri-home-2-line />
    </RouterLink>

    <button
      class="mx-2 icon-btn !outline-none"
      :title="t('button.toggle_dark')"
      @click="toggleDark()"
    >
      <div v-if="isDark" i-ri-moon-line />
      <div v-else i-ri-sun-line />
    </button>

    <a class="mx-2 icon-btn" :title="t('button.toggle_langs')" @click="toggleLocales">
      <div i-ri-translate-2 />
    </a>

    <a
      class="mx-2 icon-btn"
      href="https://www.yunyoujun.cn/posts/make-an-avg-engine/"
      target="_blank"
      :title="t('button.about')"
    >
      <div i-carbon-dicom-overlay />
    </a>

    <a
      class="mx-2 icon-btn"
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
