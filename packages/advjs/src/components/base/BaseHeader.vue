<template>
  <nav class="text-xl my-5">
    <router-link class="icon-btn mx-2" to="/" :title="t('button.home')">
      <i-ri-home-2-line />
    </router-link>

    <button class="icon-btn mx-2 !outline-none" :title="t('button.toggle_dark')" @click="toggleDark()">
      <i-ri-moon-line v-if="isDark" />
      <i-ri-sun-line v-else />
    </button>

    <a class="icon-btn mx-2" :title="t('button.toggle_langs')" @click="toggleLocales">
      <i-ri-translate-2 />
    </a>

    <a class="icon-btn mx-2" href="https://www.yunyoujun.cn/posts/make-an-avg-engine/" target="_blank" :title="t('button.about')">
      <i-carbon-dicom-overlay />
    </a>

    <a class="icon-btn mx-2" rel="noreferrer" href="https://github.com/YunYouJun/advjs" target="_blank" title="GitHub">
      <i-ri-github-line />
    </a>

    <!-- wc-github-corners -->
    <!-- <github-corners color="#151513" :repo="pkg.repository.url"></github-corners> -->
  </nav>
</template>

<script setup lang="ts">
// import * as pkg from '~/../package.json'
import { isDark, toggleDark } from '~/logic'

const { t, availableLocales, locale } = useI18n()

const toggleLocales = () => {
  // change to some real logic
  const locales = availableLocales
  locale.value = locales[(locales.indexOf(locale.value) + 1) % locales.length]
}
</script>
