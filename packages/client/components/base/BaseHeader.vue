<script setup lang="ts">
// import * as pkg from '~/../package.json'
import { useI18n } from 'vue-i18n'
import { useGameColorMode } from '../../composables/useGameColorMode'

const { isDark, toggle: toggleDark } = useGameColorMode()

const { t, availableLocales, locale } = useI18n()

function toggleLocales() {
  // change to some real logic
  const locales = availableLocales
  locale.value = locales[(locales.indexOf(locale.value) + 1) % locales.length]
}
</script>

<template>
  <nav class="text-xl p-4 flex w-full justify-between">
    <div class="flex gap-2">
      <RouterLink to="/" class="adv-icon-button" :title="t('button.home')" :aria-label="t('button.home')">
        <div i-ri-home-2-line aria-hidden="true" />
      </RouterLink>

      <AdvIconButton :title="t('button.toggle_langs')" @click="toggleLocales">
        <div i-ri-translate-2 />
      </AdvIconButton>

      <a
        class="adv-icon-button"
        href="https://www.yunyoujun.cn/posts/make-an-avg-engine/"
        target="_blank"
        :title="t('button.about')"
        :aria-label="t('button.about')"
      >
        <div i-carbon-dicom-overlay aria-hidden="true" />
      </a>

      <a
        class="adv-icon-button"
        rel="noreferrer"
        href="https://github.com/YunYouJun/advjs"
        target="_blank"
        title="GitHub"
        aria-label="GitHub"
      >
        <div i-ri-github-line aria-hidden="true" />
      </a>
    </div>

    <div>
      <AdvIconButton
        :title="t('button.toggle_dark')"
        :aria-pressed="isDark"
        @click="toggleDark()"
      >
        <div v-if="isDark" i-ri-moon-line />
        <div v-else i-ri-sun-line />
      </AdvIconButton>
    </div>
  </nav>
</template>
