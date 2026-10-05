<script setup lang="ts">
import type { ThemeConfig } from '@advjs/types'
import { themeConfigSymbol } from '@advjs/core'
import { provide } from 'vue'
import { provideGameColorMode } from '../../composables/useGameColorMode'
import { useGameUiTheme } from '../../composables/useGameUiTheme'
import '../../styles/game-ui.scss'

const props = withDefaults(defineProps<{
  as?: 'div' | 'main'
  theme?: ThemeConfig
  colorModeStorageKey?: string | false
}>(), { colorModeStorageKey: undefined })
const theme = useGameUiTheme(() => props.theme)
provide(themeConfigSymbol, theme.config)
const { colorScheme } = provideGameColorMode(theme.colorScheme, props.colorModeStorageKey)
</script>

<template>
  <component :is="as || 'div'" class="adv-theme-scope" data-adv-ui="game" :data-adv-color-scheme="colorScheme" :style="theme.style.value">
    <slot />
  </component>
</template>

<style scoped>
.adv-theme-scope {
  background-color: var(--adv-c-bg);
}
</style>
