<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useGameColorMode } from '../../composables/useGameColorMode'

const { t, locale, availableLocales } = useI18n()
const { isDark, toggle } = useGameColorMode()

function nextLocale() {
  const next = availableLocales[(availableLocales.indexOf(locale.value) + 1) % availableLocales.length]
  if (next)
    locale.value = next
}
</script>

<template>
  <div class="adv-settings-utilities" role="group" :aria-label="t('settings.appearance_language')">
    <AdvIconButton :title="t('button.toggle_dark')" :aria-pressed="isDark" @click="toggle()">
      <span :class="isDark ? 'i-ri-moon-line' : 'i-ri-sun-line'" aria-hidden="true" />
    </AdvIconButton>
    <AdvIconButton :title="t('button.toggle_langs')" @click="nextLocale">
      <span i-ri-translate aria-hidden="true" />
    </AdvIconButton>
  </div>
</template>
