import gameMessages from 'virtual:advjs-game-locales'
import { createI18n } from 'vue-i18n'
import en from './locales/en.json'
import zhCN from './locales/zh-CN.json'

/**
 * Detect initial locale from browser or localStorage.
 */
function getInitialLocale(): string {
  const saved = globalThis.localStorage?.getItem('advjs-studio-locale')
  if (saved)
    return saved

  const browserLang = globalThis.navigator?.language || 'en'
  if (browserLang.startsWith('zh'))
    return 'zh-CN'

  return 'en'
}

const i18n = createI18n({
  legacy: false,
  locale: getInitialLocale(),
  fallbackLocale: 'en',
  messages: { 'en': {}, 'zh-CN': {} },
})

// Preserve game settings labels alongside Studio's settings namespace.
i18n.global.mergeLocaleMessage('en', gameMessages.en)
i18n.global.mergeLocaleMessage('zh-CN', gameMessages['zh-CN'])
i18n.global.mergeLocaleMessage('en', en)
i18n.global.mergeLocaleMessage('zh-CN', zhCN)

export default i18n
