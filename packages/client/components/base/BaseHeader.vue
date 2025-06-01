<script setup lang="ts">
import { isDark, toggleDark } from '@advjs/core'
// import * as pkg from '~/../package.json'
import { useI18n } from 'vue-i18n'

const { t, availableLocales, locale } = useI18n()

function toggleLocales() {
  // change to some real logic
  const locales = availableLocales
  locale.value = locales[(locales.indexOf(locale.value) + 1) % locales.length]
}
</script>

<template>
  <nav class="w-full flex justify-between p-4 text-xl">
    <div class="flex gap-2">
      <RouterLink to="/" :title="t('button.home')">
        <AdvIconButton>
          <div i-ri-home-2-line />
        </AdvIconButton>
      </RouterLink>

      <AdvIconButton :title="t('button.toggle_langs')" @click="toggleLocales">
        <div i-ri-translate-2 />
      </AdvIconButton>

      <a
        href="https://www.yunyoujun.cn/posts/make-an-avg-engine/"
        target="_blank"
        :title="t('button.about')"
      >
        <AdvIconButton>
          <div i-carbon-dicom-overlay />
        </AdvIconButton>
      </a>

      <a
        rel="noreferrer"
        href="https://github.com/YunYouJun/advjs"
        target="_blank"
        title="GitHub"
      >
        <AdvIconButton>
          <div i-ri-github-line />
        </AdvIconButton>
      </a>
    </div>

    <div>
      <AdvIconButton
        :title="t('button.toggle_dark')"
        @click="toggleDark()"
      >
        <div v-if="isDark" i-ri-moon-line />
        <div v-else i-ri-sun-line />
      </AdvIconButton>
    </div>
  </nav>
</template>
