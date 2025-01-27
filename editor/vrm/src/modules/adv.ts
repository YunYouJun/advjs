import type { UserModule } from '../types'
import { themeConfigSymbol } from '@advjs/core'
import { computed } from 'vue'

// https://github.com/antfu/vite-plugin-pwa#automatic-reload-when-new-content-available
export const install: UserModule = ({ app }) => {
  // install theme
  const themeConfig = computed(() => {})
  app.provide(themeConfigSymbol, themeConfig)
}
